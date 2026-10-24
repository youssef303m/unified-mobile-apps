// M5 player services (01-product/player.md), platform-free.
import { FIXTURE_SRT } from "@/api/__fixtures__/services";
import { fixtureStreamFor } from "@/api/__fixtures__/playback";
import { FIXTURE_BROKEN_CHANNEL, FIXTURE_TS_CHANNEL, TEST_STREAMS } from "@/api/__fixtures__/hosts";
import { memoryStore } from "@/api/store";
import { continueWatchingIds, movieProgress } from "@/content/rules/library";
import { globalKeys } from "@/storage/keys";

import { aspectLayout, pinchAspect } from "../aspect";
import { classifyPlaybackError, httpStatusOf } from "../errors";
import { languageCode, languageName } from "../languages";
import { debounce, zapIndex } from "../live";
import {
  backgroundAudioOn,
  BG_COLORS,
  cycle,
  readSubtitleStyle,
  saveSubtitleStyle,
  setBackgroundAudio,
  stepValue,
  SUBTITLE_DELAY,
  SUBTITLE_SIZE,
  TEXT_COLORS,
} from "../playerSettings";
import { ProgressTracker } from "../progress";
import { endAction, EndDebouncer, nextEpisodeCard, nextInQueue, previousInQueue } from "../queue";
import { REMOTE_PAUSE_SETTLE_MS, RemotePause } from "../remotePause";
import { clampSeek, SeekAccumulator, SeekController, seekLanded } from "../seek";
import { playbackPlan, sourceType, urlPath } from "../streamPlan";
import {
  FIRST_FRAME_TIMEOUT_MS,
  HEALTHY_RESET_MS,
  PlaybackSupervisor,
  RECONNECT_DELAY_MS,
  RECONNECT_MAX,
  type LoadReason,
  type SupervisorState,
} from "../supervisor";
import { findSubtitles, groupLanguages, resolveTmdbId } from "../subtitles/lookup";
import { cueSpans, normalizeTimestamp, parseSrt, SubtitleCursor } from "../subtitles/srt";
import { audioPickerState, audioUnplayable, trackOptions } from "../tracks";

describe("§2.6 stream plan", () => {
  it("gives Media3 an explicit type, and a progressive → HLS mini-chain for ambiguous URLs", () => {
    expect(urlPath("http://h:8080/Live/u/p/1.M3U8?token=a#x")).toBe("/live/u/p/1.m3u8");
    expect(playbackPlan("http://h/live/u/p/1.m3u8?t=1")).toEqual(["hls"]);
    expect(playbackPlan("http://h/x/manifest.mpd")).toEqual(["dash"]);
    expect(playbackPlan("http://h/movie/u/p/5.mkv")).toEqual(["progressive"]);
    expect(playbackPlan("http://h/live/u/p/1.ts")).toEqual(["progressive", "hls"]);
    expect(playbackPlan("http://h/streaming/timeshift.php?stream=1")).toEqual([
      "progressive",
      "hls",
    ]);
    expect(playbackPlan("http://cdn/play/1?play_token=x")).toEqual(["progressive", "hls"]);
    expect(["hls", "dash", "progressive"].map((k) => sourceType(k as "hls"))).toEqual([
      "m3u8",
      "mpd",
      "mp4",
    ]);
  });
});

describe("§2.3–2.4 supervisor", () => {
  function harness(attempts: number) {
    jest.useFakeTimers();
    const loads: [number, LoadReason][] = [];
    const states: SupervisorState[] = [];
    const s = new PlaybackSupervisor(attempts, {
      load: (a, r) => loads.push([a, r]),
      state: (st) => states.push(st),
    });
    return { s, loads, states, last: () => states.at(-1) };
  }
  afterEach(() => jest.useRealTimers());

  it("moves to the next attempt on an error or a missed 12 s first frame, only before playback", () => {
    const { s, loads } = harness(2);
    s.start();
    jest.advanceTimersByTime(FIRST_FRAME_TIMEOUT_MS);
    expect(loads).toEqual([
      [0, "start"],
      [1, "fallback"],
    ]);
    // The last attempt has no watchdog.
    jest.advanceTimersByTime(FIRST_FRAME_TIMEOUT_MS * 2);
    expect(loads).toHaveLength(2);
    s.dispose();
  });

  it("after playback started, errors reconnect (6 s, fresh URL) instead of switching attempt", () => {
    const { s, loads, last } = harness(2);
    s.start();
    s.firstFrame();
    s.error();
    expect(last()?.status).toBe("reconnecting");
    jest.advanceTimersByTime(RECONNECT_DELAY_MS);
    expect(loads.at(-1)).toEqual([0, "reconnect"]);
    expect(last()).toMatchObject({ status: "reconnecting", reconnects: 1 });
    s.firstFrame();
    expect(last()?.status).toBe("playing");
    s.dispose();
  });

  it("stops after 10 reconnects; 5 s of healthy playback resets the counter; Retry starts over", () => {
    const { s, last } = harness(1);
    s.start();
    for (let i = 0; i < RECONNECT_MAX; i++) {
      s.error();
      jest.advanceTimersByTime(RECONNECT_DELAY_MS);
    }
    s.error();
    expect(last()).toMatchObject({ status: "failed", reconnects: RECONNECT_MAX });
    s.start();
    expect(last()).toMatchObject({ status: "loading", reconnects: 0 });

    s.error();
    jest.advanceTimersByTime(RECONNECT_DELAY_MS);
    s.firstFrame();
    jest.advanceTimersByTime(HEALTHY_RESET_MS);
    expect(last()?.reconnects).toBe(0);
    s.dispose();
  });

  it("an error while a reconnect is scheduled is ignored; errors during a reconnect load count", () => {
    const { s, loads } = harness(2);
    s.start();
    s.firstFrame();
    s.error();
    s.error();
    jest.advanceTimersByTime(RECONNECT_DELAY_MS);
    expect(loads.filter(([, r]) => r === "reconnect")).toHaveLength(1);
    s.error();
    expect(loads.at(-1)).toEqual([1, "fallback"]);
    s.dispose();
  });
});

describe("§3.1 seeking", () => {
  it("clamps to [0, duration − 5 s]; quick presses add up for 3 s", () => {
    expect(clampSeek(-4, 100)).toBe(0);
    expect(clampSeek(99, 100)).toBe(95);
    let now = 0;
    const acc = new SeekAccumulator(() => now);
    expect(acc.step(30, 100, 1000)).toBe(130);
    now = 1000;
    expect(acc.step(30, 101, 1000)).toBe(160);
    now = 2000;
    expect(acc.step(30, 102, 1000)).toBe(190);
    now = 6000;
    expect(acc.step(-10, 150, 1000)).toBe(140);
  });

  it("a seek lands within ±3 s of the target plus the time elapsed", () => {
    expect(seekLanded(100, 97, 0)).toBe(true);
    expect(seekLanded(100, 104.5, 2)).toBe(true);
    expect(seekLanded(100, 96, 0)).toBe(false);
    expect(seekLanded(100, 110, 1)).toBe(false);
  });

  function clock() {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => void (t += ms) };
  }

  it("verifies each seek; a failed one gets one reload and re-seek; still failing → failed", async () => {
    const positions = [0, 0, 0];
    let reloads = 0;
    const seeks: number[] = [];
    const failing = new SeekController(
      {
        seek: (t) => seeks.push(t),
        position: async () => positions[0] ?? 0,
        reload: async () => void (reloads += 1),
      },
      clock(),
    );
    expect(await failing.seek(600)).toBe("failed");
    expect(reloads).toBe(1);
    expect(seeks).toEqual([600, 600]);

    let pos = 0;
    const working = new SeekController(
      {
        seek: (t) => void (pos = t),
        position: async () => pos,
      },
      clock(),
    );
    expect(await working.seek(300)).toBe("ok");
  });

  it("a seek that killed the stream disables seeking for the session", async () => {
    const c = new SeekController({ seek: () => undefined, position: async () => 0 }, clock());
    c.seekKilledStream();
    expect(c.seekingDisabled).toBe(true);
    expect(await c.seek(10)).toBe("disabled");
  });
});

describe("R-073 / R-075 progress during playback", () => {
  const PID = "p1";

  it("R-073: writes at most once a minute, only ≥ 10 s in and ≥ 10 s before the end", () => {
    const store = memoryStore();
    let now = 0;
    const t = new ProgressTracker(store, PID, { kind: "movie", movieId: "m" }, false, () => now);
    now = 30_000;
    expect(t.tick(40, 600)).toBe(false);
    now = 61_000;
    expect(t.tick(5, 600)).toBe(false);
    expect(t.tick(70, 600)).toBe(true);
    expect(movieProgress(store, PID, "m")?.time).toBe(70);
    now = 90_000;
    expect(t.tick(100, 600)).toBe(false);
    now = 125_000;
    expect(t.tick(595, 600)).toBe(false);
  });

  it("R-073: leaving within the last 10 s finishes the movie; it leaves Continue Watching", () => {
    const store = memoryStore();
    const t = new ProgressTracker(store, PID, { kind: "movie", movieId: "m" }, false);
    expect(t.leave(300, 600)).toBe("save");
    expect(continueWatchingIds(store, PID, "movie")).toEqual(["m"]);
    expect(t.leave(595, 600)).toBe("finished");
    expect(continueWatchingIds(store, PID, "movie")).toEqual([]);
  });

  it("R-075: nothing is written while the resume prompt shows or a restore runs", () => {
    const store = memoryStore();
    let now = 0;
    const t = new ProgressTracker(store, PID, { kind: "movie", movieId: "m" }, false, () => now);
    t.block("prompt");
    now = 120_000;
    expect(t.tick(200, 600)).toBe(false);
    t.unblock("prompt");
    expect(t.tick(200, 600)).toBe(true);
  });

  it("R-075: after a failed restore, the old bookmark is protected until playback passes it", () => {
    const store = memoryStore();
    const t = new ProgressTracker(store, PID, { kind: "movie", movieId: "m" }, false);
    t.leave(1800, 6000);
    t.protect(1800);
    expect(t.leave(60, 6000)).toBe("ignore");
    expect(movieProgress(store, PID, "m")?.time).toBe(1800);
    expect(t.leave(1900, 6000)).toBe("save");
    expect(movieProgress(store, PID, "m")?.time).toBe(1900);
  });

  it("R-063 / R-076: adult items are never saved; episodes are keyed by episode id", () => {
    const store = memoryStore();
    const adult = new ProgressTracker(store, PID, { kind: "movie", movieId: "x" }, true);
    expect(adult.leave(300, 600)).toBe("ignore");
    const ep = new ProgressTracker(
      store,
      PID,
      { kind: "episode", seriesId: "s", episode: { id: "e7", seasonNumber: 2, episodeNumber: 3 } },
      false,
    );
    expect(ep.leave(300, 1800)).toBe("save");
    expect(continueWatchingIds(store, PID, "series")).toEqual(["s"]);
  });
});

describe("§5.4 SRT", () => {
  it("parses commas or dots, CRLF, and normalises timestamps", () => {
    expect(normalizeTimestamp("0:00:28.9")).toBe("00:00:28,900");
    expect(normalizeTimestamp("01:02:03,4567")).toBe("01:02:03,456");
    const cues = parseSrt(FIXTURE_SRT);
    expect(cues.map((c) => [c.id, c.start, c.end])).toEqual([
      ["1", 1, 4],
      ["2", 5.5, 9],
      ["3", 10, 600],
    ]);
    expect(cues[0]?.text).toBe("<i>Fixture</i> subtitle one");
    const dots = parseSrt("1\n00:00:01.5 --> 00:00:02.25\nHi\n");
    expect(dots[0]).toMatchObject({ start: 1.5, end: 2.25, text: "Hi" });
    expect(parseSrt("")).toEqual([]);
  });

  it("finds the cue for a time: inside, between cues, the next one, and after a jump", () => {
    const cursor = new SubtitleCursor(parseSrt(FIXTURE_SRT));
    expect(cursor.at(2)?.id).toBe("1");
    expect(cursor.at(4.5)).toBeUndefined();
    expect(cursor.at(6)?.id).toBe("2");
    expect(cursor.at(300)?.id).toBe("3");
    expect(cursor.at(0.5)).toBeUndefined();
    expect(cursor.at(1.2)?.id).toBe("1");
  });

  it("a positive delay (whole seconds) shows subtitles later", () => {
    const cursor = new SubtitleCursor(parseSrt(FIXTURE_SRT));
    cursor.setDelay(2.7);
    expect(cursor.at(2)).toBeUndefined();
    expect(cursor.at(3.5)?.id).toBe("1");
    cursor.setDelay(-1);
    expect(cursor.at(0.2)?.id).toBe("1");
  });

  it("keeps only <i> <b> <u> <br>; other tags are stripped with their text kept", () => {
    expect(cueSpans('<font color="red">A</font> <b>B<i>C</i></b><br>D')).toEqual([
      { text: "A", bold: false, italic: false, underline: false },
      { text: " ", bold: false, italic: false, underline: false },
      { text: "B", bold: true, italic: false, underline: false },
      { text: "C", bold: true, italic: true, underline: false },
      { text: "\n", bold: false, italic: false, underline: false },
      { text: "D", bold: false, italic: false, underline: false },
    ]);
  });
});

describe("§5.1–5.3 tracks and external subtitles", () => {
  it("labels tracks by language; unnamed ones are Track N", () => {
    expect(languageCode("eng")).toBe("en");
    expect(languageCode("pt-BR")).toBe("pt");
    expect(languageCode("und")).toBeUndefined();
    expect(languageName("ara", "en")).toBe("Arabic");
    const options = trackOptions(
      [
        { index: 0, language: "eng", selected: true },
        { index: 1, title: "Commentary", language: "en" },
        { index: 2 },
      ],
      (n) => `Track ${n}`,
      "en",
    );
    expect(options.map((o) => o.label)).toEqual(["English", "English · Commentary", "Track 3"]);
    expect(audioPickerState(false, [])).toBe("not_loaded");
    expect(audioPickerState(true, [])).toBe("none");
  });

  it("Q-ffmpeg-audio: Dolby or DTS audio the phone did not select is unplayable", () => {
    expect(
      audioUnplayable([
        { index: 0, type: "audio/ac3" },
        { index: 1, type: "audio/vnd.dts" },
      ]),
    ).toBe(true);
    expect(audioUnplayable([{ index: 0, type: "audio/ac3", selected: true }])).toBe(false);
    // A playable track exists: the player picks it, nothing to report.
    expect(
      audioUnplayable([
        { index: 0, type: "audio/ac3" },
        { index: 1, type: "audio/mp4a-latm" },
      ]),
    ).toBe(false);
    expect(audioUnplayable([{ index: 0, type: "audio/mp4a-latm" }])).toBe(false);
    expect(audioUnplayable([])).toBe(false);
  });

  it("groups ibosub languages (first file each), sorted, the app language first", () => {
    const list = {
      files: [
        { fileId: "1", language: "fr" },
        { fileId: "2", language: "en" },
        { fileId: "3", language: "en" },
        { fileId: "4", language: "ar" },
      ],
      srtMap: {},
      movieListId: "9",
    };
    expect(groupLanguages(list, "en").map((l) => [l.code, l.fileId])).toEqual([
      ["en", "2"],
      ["ar", "4"],
      ["fr", "1"],
    ]);
    expect(groupLanguages(list, "ar")[0]?.code).toBe("ar");
  });

  it("resolves the TMDB id: known, one result, the release date, or exactly one title match", async () => {
    const r = (id: number, title: string, release_date?: string) => ({ id, title, release_date });
    expect(await resolveTmdbId({ kind: "movie", tmdbId: "7", name: "x" }, undefined)).toBe("7");
    expect(await resolveTmdbId({ kind: "movie", name: "x" }, undefined)).toBeUndefined();
    const two = async () => [r(1, "Dune", "2021-09-15"), r(2, "Dune Part Two", "2024-02-27")];
    expect(
      await resolveTmdbId(
        { kind: "movie", name: "EN - Dune (2024)", releaseDate: "2024-02-27" },
        two,
      ),
    ).toBe("2");
    expect(await resolveTmdbId({ kind: "movie", name: "EN - Dune Part Two" }, two)).toBeUndefined();
    const series = async () => [
      { id: 5, title: "The Bear", overview: "Kitchen" },
      { id: 6, title: "Bear Grylls", original: "bear", overview: "Wild" },
    ];
    expect(await resolveTmdbId({ kind: "tv", name: "Bear" }, series)).toBe("6");
    expect(await resolveTmdbId({ kind: "tv", name: "Kitchen show", plot: "Kitchen" }, series)).toBe(
      "5",
    );
  });

  it("finds subtitles on the fixtures; srt_map files need no second call", async () => {
    const found = await findSubtitles(
      { tmdb: { kind: "movie", tmdbId: "693134", name: "Dune" } },
      { uiLanguage: "en" },
    );
    expect(found?.languages.map((l) => l.code)).toEqual(["en", "ar", "fr"]);
    const en = found?.languages[0];
    const fr = found?.languages[2];
    expect(en && (await found?.load(en))).toBe(FIXTURE_SRT);
    expect(fr && (await found?.load(fr))).toContain("<i>31</i> subtitle one");
    const none = await findSubtitles(
      { tmdb: { kind: "movie", tmdbId: "1", name: "x" } },
      { uiLanguage: "en" },
    );
    expect(none).toBeUndefined();
    const episode = await findSubtitles(
      {
        tmdb: { kind: "tv", tmdbId: "136315", name: "Fixture Series" },
        episode: { seasonNumber: 2, episodeNumber: 3 },
      },
      { uiLanguage: "en" },
    );
    expect(episode?.languages).toHaveLength(3);
  });
});

describe("§3.1 queue, end of video and N-07", () => {
  const q = { items: ["a", "b", "c"], index: 0 };

  it("Next/Previous stop at the ends", () => {
    expect(nextInQueue(q)?.index).toBe(1);
    expect(previousInQueue(q)).toBeUndefined();
    expect(nextInQueue({ ...q, index: 2 })).toBeUndefined();
  });

  it("the end: autoplay off stops; on plays the next at once, or closes when the list ran out", () => {
    expect(endAction(false, true)).toBe("stop");
    expect(endAction(true, true)).toBe("next");
    expect(endAction(true, false)).toBe("close");
    let now = 0;
    const d = new EndDebouncer(() => now);
    expect(d.accept()).toBe(true);
    now = 900;
    expect(d.accept()).toBe(false);
    now = 2000;
    expect(d.accept()).toBe(true);
  });

  it("N-07: a Next episode card in the last 30 s; with autoplay it counts down 10 s", () => {
    const base = {
      isEpisode: true,
      hasNext: true,
      autoPlay: true,
      dismissed: false,
      duration: 1800,
      shownAt: undefined,
    };
    expect(nextEpisodeCard({ ...base, position: 1700 })).toEqual({ kind: "hidden" });
    expect(nextEpisodeCard({ ...base, position: 1771 })).toEqual({
      kind: "countdown",
      seconds: 10,
    });
    expect(nextEpisodeCard({ ...base, position: 1775.5, shownAt: 1771 })).toEqual({
      kind: "countdown",
      seconds: 6,
    });
    expect(nextEpisodeCard({ ...base, position: 1790, shownAt: 1771 })).toEqual({
      kind: "countdown",
      seconds: 0,
    });
    expect(nextEpisodeCard({ ...base, autoPlay: false, position: 1780 })).toEqual({
      kind: "button",
    });
    expect(nextEpisodeCard({ ...base, dismissed: true, position: 1780 }).kind).toBe("hidden");
    expect(nextEpisodeCard({ ...base, hasNext: false, position: 1780 }).kind).toBe("hidden");
    expect(nextEpisodeCard({ ...base, isEpisode: false, position: 1780 }).kind).toBe("hidden");
  });
});

describe("§6 errors, §3.1 aspect, §3.2 live", () => {
  it("maps Media3 errors to plain messages", () => {
    const http = (code: number) => ({
      errorCode: "22004",
      errorStackTrace: `Caused by: HttpDataSource$InvalidResponseCodeException: Response code: ${code}`,
    });
    expect(httpStatusOf(http(403))).toBe(403);
    expect(classifyPlaybackError(http(401))).toBe("access_denied");
    expect(classifyPlaybackError(http(404))).toBe("not_found");
    expect(classifyPlaybackError({ errorCode: "24003" })).toBe("unsupported");
    expect(classifyPlaybackError({ errorCode: "23003" })).toBe("unsupported");
    expect(classifyPlaybackError({ errorCode: "22001" })).toBe("network");
    expect(classifyPlaybackError({})).toBe("generic");
  });

  it("fixed ratios box a stretched video; pinch toggles fit and fill", () => {
    expect(aspectLayout("fit", 800, 400)).toEqual({
      resizeMode: "contain",
      width: 800,
      height: 400,
    });
    expect(aspectLayout("fill", 800, 400).resizeMode).toBe("cover");
    const box = aspectLayout("4:3", 800, 400);
    expect(box.resizeMode).toBe("stretch");
    expect(box.width).toBeCloseTo(533.33, 1);
    expect(box.height).toBe(400);
    expect(aspectLayout("21:9", 800, 400).width).toBe(800);
    expect(pinchAspect(true)).toBe("fill");
    expect(pinchAspect(false)).toBe("fit");
  });

  it("zapping clamps at the ends; playback starts after a 400 ms debounce", () => {
    expect(zapIndex(3, 0, "previous")).toBeUndefined();
    expect(zapIndex(3, 0, "next")).toBe(1);
    expect(zapIndex(3, 2, "next")).toBeUndefined();
    jest.useFakeTimers();
    const played: number[] = [];
    const d = debounce((n: number) => played.push(n), 400);
    d.call(1);
    jest.advanceTimersByTime(300);
    d.call(2);
    jest.advanceTimersByTime(399);
    expect(played).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(played).toEqual([2]);
    jest.useRealTimers();
  });
});

describe("§5.2 / §7 player settings", () => {
  it("subtitle style: TV defaults, saved clamped to its steps; palettes cycle and wrap", () => {
    const store = memoryStore();
    expect(readSubtitleStyle(store)).toEqual({
      size: 50,
      textColor: TEXT_COLORS[0],
      bgColor: "transparent",
      position: 5,
    });
    saveSubtitleStyle(store, {
      size: 83,
      textColor: TEXT_COLORS[2] ?? "",
      bgColor: BG_COLORS[1] ?? "",
      position: 12,
    });
    expect(store.get(globalKeys.subtitleSize)).toBe("80");
    expect(readSubtitleStyle(store)).toMatchObject({ size: 80, position: 10 });
    expect(cycle(TEXT_COLORS, TEXT_COLORS[5], 1)).toBe(TEXT_COLORS[0]);
    expect(cycle(TEXT_COLORS, TEXT_COLORS[0], -1)).toBe(TEXT_COLORS[5]);
    expect(stepValue(SUBTITLE_SIZE, 80, 1)).toBe(80);
    expect(stepValue(SUBTITLE_DELAY, 0, -1)).toBe(-1);
  });

  it("N-06: background audio is off by default", () => {
    const store = memoryStore();
    expect(backgroundAudioOn(store)).toBe(false);
    setBackgroundAudio(store, true);
    expect(backgroundAudioOn(store)).toBe(true);
  });
});

describe("D-088 media session play and pause", () => {
  function harness() {
    jest.useFakeTimers();
    const events: boolean[] = [];
    const facts = { notAPause: false };
    const r = new RemotePause({
      notAPause: () => facts.notAPause,
      paused: (p) => events.push(p),
    });
    return { r, events, facts };
  }
  afterEach(() => jest.useRealTimers());

  it("follows a play at once and a pause once the player is still stopped", () => {
    const { r, events } = harness();
    r.playing(true);
    expect(events).toEqual([false]);
    r.playing(false);
    jest.advanceTimersByTime(REMOTE_PAUSE_SETTLE_MS - 1);
    expect(events).toEqual([false]);
    jest.advanceTimersByTime(1);
    expect(events).toEqual([false, true]);
  });

  it("ignores a short stop (a seek) and a stop for another reason (buffering, the app left)", () => {
    const { r, events, facts } = harness();
    r.playing(false);
    r.playing(true);
    jest.advanceTimersByTime(REMOTE_PAUSE_SETTLE_MS);
    expect(events).toEqual([false]);
    facts.notAPause = true;
    r.playing(false);
    jest.advanceTimersByTime(REMOTE_PAUSE_SETTLE_MS);
    expect(events).toEqual([false]);
  });

  it("does not pause after the video ended or the item changed", () => {
    const { r, events } = harness();
    r.playing(false);
    r.cancel();
    jest.advanceTimersByTime(REMOTE_PAUSE_SETTLE_MS);
    expect(events).toEqual([]);
  });
});

describe("fixture playback", () => {
  it("fixture stream URLs become public test streams by kind; other URLs are untouched", () => {
    const x = "http://xtream.fixture.test:8080";
    expect(fixtureStreamFor(`${x}/live/u/p/10000.ts`)).toBe(TEST_STREAMS.live);
    expect(fixtureStreamFor(`${x}/live/u/p/${FIXTURE_TS_CHANNEL}.ts`)).toBe(TEST_STREAMS.ts);
    expect(fixtureStreamFor(`${x}/live/u/p/${FIXTURE_BROKEN_CHANNEL}.ts`)).toBe(
      TEST_STREAMS.broken,
    );
    expect(fixtureStreamFor(`${x}/movie/u/p/55001.mkv`)).toBe(TEST_STREAMS.mkv);
    expect(fixtureStreamFor(`${x}/movie/u/p/55002.mp4`)).toBe(TEST_STREAMS.mp4);
    expect(fixtureStreamFor(`${x}/movie/u/p/55000.m3u8`)).toBe(TEST_STREAMS.hls);
    expect(fixtureStreamFor(`${x}/series/u/p/880203.mp4`)).toBe(TEST_STREAMS.hls);
    expect(fixtureStreamFor(`${x}/streaming/timeshift.php?stream=1`)).toBe(TEST_STREAMS.hls);
    expect(fixtureStreamFor("http://cdn.stalker.fixture.test/live/play/1200?stream=1200")).toBe(
      TEST_STREAMS.live,
    );
    expect(fixtureStreamFor("http://real.example.com/live/1.ts")).toBeUndefined();
  });
});
