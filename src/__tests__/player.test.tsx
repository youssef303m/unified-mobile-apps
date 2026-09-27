// M5 player screens and components (player.md, screens.md), with a fake catalogue source. The
// flows run end to end on the phone (e2e/flow-02, 03, 04).
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Video from "react-native-video";

import type { Playlist } from "@/api/ibo/types";
import type { GuideRow } from "@/browse/guide";
import { EpgTimeline } from "@/components/EpgTimeline";
import { ToastHost } from "@/components/Toast";
import type { CatalogueSession } from "@/content/catalogue";
import type { ContentSource } from "@/content/ContentSource";
import { movieProgress, saveMovieProgress } from "@/content/rules/library";
import type { CatalogueItem, Episode } from "@/content/types";
import { i18n, initI18n } from "@/i18n";
import { orientationFor } from "@/navigation/useRouteOrientation";
import { SeekBar } from "@/player/controls/SeekBar";
import { TrackSheet } from "@/player/controls/TrackSheet";
import { LivePlayerScreen } from "@/player/LivePlayerScreen";
import { PlayerScreen } from "@/player/PlayerScreen";
import { readSubtitleStyle } from "@/player/playerSettings";
import { setLiveRequest, setVodRequest, type VodItem } from "@/player/session";
import { useSession } from "@/session/store";
import { globalKeys } from "@/storage/keys";
import { kvStore } from "@/storage/kv";
import { TestProviders } from "@/testing/TestProviders";
import { subtitlePalettes } from "@/theme/colors";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  usePathname: () => "/player",
  useFocusEffect: jest.fn(),
}));

const PID = "p-test";
const video = (Video as unknown as { videoMethods: { seek: jest.Mock } }).videoMethods;

const item = (kind: CatalogueItem["kind"], id: string, extra: Partial<CatalogueItem> = {}) =>
  ({
    kind,
    item_id: id,
    name: `${kind} ${id}`,
    icon: "",
    category_id: "10",
    tv_archive: 0,
    tv_archive_duration: 0,
    ...extra,
  }) satisfies CatalogueItem;

const episode = (n: number): Episode => ({
  id: `e${n}`,
  title: `Episode ${n}`,
  seasonNumber: 2,
  episodeNumber: n,
});

function useFakeSource(source: Partial<ContentSource> = {}) {
  const streamUrl = jest.fn(async () => ({ url: "http://cdn.example.test/movie/1.mp4" }));
  const full = {
    id: PID,
    type: "xtream",
    capabilities: { replay: true, liveFavorites: true, epg: true, paged: false, downloads: true },
    categories: async () => [],
    movieInfo: async () => undefined,
    seriesInfo: async () => undefined,
    epg: async () => [],
    streamUrl,
    ...source,
  } as unknown as ContentSource;
  const catalogue = { playlistId: PID, db: {}, source: full } as unknown as CatalogueSession;
  useSession.setState({
    active: { playlist: {} as Playlist, catalogue, provider: {} as never },
  });
  return { streamUrl: full.streamUrl as jest.Mock, source: full };
}

/** Lets the URL resolve and the supervisor load the video. */
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

async function renderVod(items: VodItem[], start: "ask" | number, index = 0) {
  setVodRequest({ items, index }, start);
  await render(
    <TestProviders>
      <PlayerScreen />
      <ToastHost />
    </TestProviders>,
  );
  await settle();
}

const fire = (name: string, payload?: unknown) =>
  act(async () => {
    const handler = screen.getByTestId("player-video").props[name] as (e?: unknown) => void;
    handler(payload);
  });

const loaded = (duration: number) => ({
  currentTime: 0,
  duration,
  naturalSize: { width: 1280, height: 720, orientation: "landscape" },
  audioTracks: [
    { index: 0, language: "eng", selected: true },
    { index: 1, language: "ara" },
  ],
  textTracks: [],
  videoTracks: [],
});

beforeAll(async () => {
  initI18n();
  await i18n.changeLanguage("en");
});
beforeEach(() => {
  for (const key of [globalKeys.autoPlay, globalKeys.subtitleSize]) kvStore.remove(key);
  video.seek.mockClear();
});

describe("VOD player", () => {
  it("resolves the stream at play time and plays it with an explicit type", async () => {
    const { streamUrl } = useFakeSource();
    const movie = item("movie", "55001");
    await renderVod([{ kind: "movie", item: movie, isAdult: false }], 0);
    expect(streamUrl).toHaveBeenCalledWith({ kind: "movie", item: movie });
    const source = screen.getByTestId("player-video").props.source as { uri: string; type: string };
    expect(source).toMatchObject({ uri: "http://cdn.example.test/movie/1.mp4", type: "mp4" });
    expect(screen.getByTestId("player-title")).toHaveTextContent("movie 55001");
  });

  it("R-075: the resume prompt appears once the media is ready; Yes seeks to the saved position", async () => {
    useFakeSource();
    saveMovieProgress(kvStore, PID, "55001", 1834, 6000, false);
    await renderVod([{ kind: "movie", item: item("movie", "55001"), isAdult: false }], "ask");
    expect(screen.queryByTestId("resume-prompt")).toBeNull();
    await fire("onLoad", loaded(6000));
    expect(screen.getByTestId("resume-prompt")).toHaveTextContent(/Continue from where you left/);
    expect(screen.getByTestId("resume-prompt")).toHaveTextContent(/30:34/);
    await fireEvent.press(screen.getByTestId("resume-yes"));
    expect(video.seek).toHaveBeenCalledWith(1834);
    expect(screen.queryByTestId("resume-prompt")).toBeNull();
  });

  it("R-073: leaving the player saves the position (≥ 10 s in, ≥ 10 s left)", async () => {
    useFakeSource();
    await renderVod([{ kind: "movie", item: item("movie", "55002"), isAdult: false }], 0);
    await fire("onLoad", loaded(600));
    await fire("onProgress", { currentTime: 300, playableDuration: 320, seekableDuration: 600 });
    await act(async () => screen.unmount());
    expect(movieProgress(kvStore, PID, "55002")?.time).toBe(300);
  });

  it("a stream that cannot be resolved says so and offers Retry (player.md §6)", async () => {
    useFakeSource({
      streamUrl: jest.fn(async () => {
        throw new Error("create_link failed");
      }),
    });
    await renderVod([{ kind: "movie", item: item("movie", "1"), isAdult: false }], 0);
    expect(screen.getByTestId("player-error")).toHaveTextContent(
      /This stream could not be started/,
    );
    expect(screen.getByTestId("player-retry")).toBeTruthy();
  });

  it("the audio picker waits for the media; then lists the tracks by language", async () => {
    useFakeSource();
    await renderVod([{ kind: "movie", item: item("movie", "3"), isAdult: false }], 0);
    await fireEvent.press(screen.getByTestId("player-tracks"));
    expect(screen.getByTestId("toast")).toHaveTextContent("Video not loaded yet");
    await fire("onLoad", loaded(600));
    await fireEvent.press(screen.getByTestId("player-tracks"));
    expect(screen.getByTestId("audio-track-0")).toHaveTextContent("English");
    expect(screen.getByTestId("audio-track-1")).toHaveTextContent("Arabic");
  });

  it("N-07: the last 30 s of an episode show Next episode; it plays the next one", async () => {
    useFakeSource();
    const series = item("series", "3301");
    const items: VodItem[] = [episode(3), episode(4)].map((e) => ({
      kind: "episode",
      series,
      episode: e,
      isAdult: false,
    }));
    await renderVod(items, 0);
    await fire("onLoad", loaded(1800));
    await fire("onProgress", { currentTime: 1700, playableDuration: 1700, seekableDuration: 1800 });
    expect(screen.queryByTestId("next-episode-card")).toBeNull();
    await fire("onProgress", { currentTime: 1775, playableDuration: 1775, seekableDuration: 1800 });
    expect(screen.getByTestId("next-episode-card")).toHaveTextContent(/Next episode/);
    await fireEvent.press(screen.getByTestId("next-episode-play"));
    await settle();
    expect(screen.getByTestId("player-title")).toHaveTextContent("S2:E4 · Episode 4");
  });

  it("autoplay on: the card counts down, and the end of an episode plays the next at once", async () => {
    useFakeSource();
    kvStore.set(globalKeys.autoPlay, "on");
    const series = item("series", "3302");
    const items: VodItem[] = [episode(1), episode(2)].map((e) => ({
      kind: "episode",
      series,
      episode: e,
      isAdult: false,
    }));
    await renderVod(items, 0);
    await fire("onLoad", loaded(1800));
    await fire("onProgress", { currentTime: 1771, playableDuration: 1771, seekableDuration: 1800 });
    expect(screen.getByTestId("next-episode-card")).toHaveTextContent(/Next episode in 10 s/);
    await fire("onEnd");
    await settle();
    expect(screen.getByTestId("player-title")).toHaveTextContent("S2:E2 · Episode 2");
  });
});

describe("live player", () => {
  it("zapping shows the next channel at once and plays it after 400 ms (player.md §3.2)", async () => {
    const { streamUrl } = useFakeSource({
      streamUrl: jest.fn(async (r: { item: CatalogueItem }) => ({
        url: `http://cdn.example.test/live/${r.item.item_id}.ts`,
      })),
    } as Partial<ContentSource>);
    const channels = [item("live", "1", { num: 1 }), item("live", "2", { num: 2 })];
    setLiveRequest(channels, 0, []);
    await render(
      <TestProviders>
        <LivePlayerScreen />
      </TestProviders>,
    );
    await settle();
    expect(screen.getByTestId("live-channel-name")).toHaveTextContent("1  live 1");
    expect(screen.getByTestId("live-video").props.source).toMatchObject({
      uri: "http://cdn.example.test/live/1.ts",
      // Raw TS: progressive first (HLS is the fallback).
      type: "mp4",
    });
    await fireEvent.press(screen.getByTestId("live-next"));
    expect(screen.getByTestId("live-channel-name")).toHaveTextContent("2  live 2");
    expect(streamUrl).toHaveBeenCalledTimes(1);
    await act(async () => new Promise((r) => setTimeout(r, 450)));
    await settle();
    expect(streamUrl).toHaveBeenCalledTimes(2);
    // The end of the category: no wrap.
    expect(screen.getByTestId("live-next")).toBeDisabled();
  });
});

describe("player controls", () => {
  it("the seek bar shows elapsed and remaining time and steps ±30 s for TalkBack", async () => {
    const onSeek = jest.fn();
    await render(<SeekBar position={65} duration={3725} onSeek={onSeek} testID="bar" />);
    expect(screen.getByTestId("seek-elapsed")).toHaveTextContent(/^0?1:05$/);
    expect(screen.getByTestId("seek-remaining")).toHaveTextContent(/^-0?1:01:00$/);
    await fireEvent(screen.getByTestId("bar"), "accessibilityAction", {
      nativeEvent: { actionName: "increment" },
    });
    expect(onSeek).toHaveBeenCalledWith(95);
  });

  it("the track sheet: no external subtitles found, and the style saved from a swatch", async () => {
    const onStyle = jest.fn();
    await render(
      <TestProviders>
        <TrackSheet
          visible
          onClose={() => undefined}
          audio={[]}
          onAudio={() => undefined}
          embedded={[]}
          external={{ kind: "none" }}
          subtitle={{ kind: "off" }}
          onSubtitle={() => undefined}
          style={readSubtitleStyle(kvStore)}
          onStyle={onStyle}
        />
      </TestProviders>,
    );
    expect(screen.getByText("No Audios exist")).toBeTruthy();
    expect(screen.getByTestId("subtitle-none")).toHaveTextContent("No subtitles found");
    await fireEvent.press(screen.getByTestId("subtitle-text-color-yellow"));
    expect(onStyle).toHaveBeenCalledWith(
      expect.objectContaining({ textColor: subtitlePalettes.text[2] }),
    );
  });

  it("orientation follows the route: players landscape, the guide free, the rest portrait", () => {
    expect(orientationFor("/player")).toBe("landscape");
    expect(orientationFor("/channel/10001")).toBe("landscape");
    expect(orientationFor("/guide")).toBe("free");
    expect(orientationFor("/home")).toBe("portrait");
  });
});

describe("EpgTimeline", () => {
  it("R-096: programmes of the day, a now-line, and the catch-up mark on archived past ones", async () => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    const at = (h: number) => new Date(day.getTime() + h * 3_600_000);
    const now = at(12.5);
    const rows: Record<string, GuideRow> = {
      a: {
        status: "done",
        programmes: [
          { start: at(10), stop: at(11), title: "Morning", description: "", archive: true },
          { start: at(12), stop: at(13), title: "Noon", description: "", archive: false },
        ],
      },
      b: { status: "error" },
    };
    const onPress = jest.fn();
    await render(
      <EpgTimeline
        channels={[item("live", "a"), item("live", "b")]}
        rowFor={(c) => rows[c.item_id] ?? { status: "loading" }}
        day={day}
        now={now}
        canReplay={() => true}
        onVisibleRows={() => undefined}
        onPressProgramme={onPress}
        onPressChannel={() => undefined}
        scrollToNow={0}
      />,
    );
    expect(screen.getByText("Morning")).toBeTruthy();
    expect(screen.getByText("Noon")).toBeTruthy();
    expect(screen.getByTestId("guide-now-line")).toBeTruthy();
    expect(screen.getAllByTestId("guide-archive")).toHaveLength(1);
    expect(screen.getByText("Failed to load EPG for this channel")).toBeTruthy();
    await fireEvent.press(screen.getByText("Morning"));
    expect(onPress).toHaveBeenCalledWith(
      expect.objectContaining({ item_id: "a" }),
      expect.objectContaining({ title: "Morning" }),
    );
  });
});
