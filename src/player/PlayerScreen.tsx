import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import Video, { SelectedTrackType, type VideoRef } from "react-native-video";
import { Film, LockOpen } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/EmptyState";
import { EpisodeRow } from "@/components/EpisodeRow";
import { IconButton } from "@/components/IconButton";
import { ListSheet } from "@/components/Sheet";
import { showToast } from "@/components/Toast";
import { downloads } from "@/downloads";
import {
  episodeResumePosition,
  movieResumePosition,
  shouldOfferResume,
} from "@/content/rules/library";
import { refreshBrowse } from "@/hooks/queryClient";
import { useBrowse } from "@/hooks/useBrowse";
import { kvStore } from "@/storage/kv";
import { colors, motion, spacing } from "@/theme/tokens";
import { epgClock } from "@/utils/epgTime";
import { durationParts } from "@/utils/format";

import { aspectLayout, pinchAspect, type AspectMode } from "./aspect";
import { GestureLayer } from "./controls/GestureLayer";
import { MoreSheet } from "./controls/MoreSheet";
import { NextEpisodeCard } from "./controls/NextEpisodeCard";
import { PlayerStatus } from "./controls/PlayerStatus";
import { ResumePrompt } from "./controls/ResumePrompt";
import { SubtitleText } from "./controls/SubtitleText";
import { TrackSheet, type SubtitleChoice } from "./controls/TrackSheet";
import { VodControls } from "./controls/VodControls";
import { PlayerChrome, useKeepAwakeWhile } from "./PlayerChrome";
import {
  autoPlayOn,
  backgroundAudioOn,
  readSubtitleStyle,
  saveSubtitleStyle,
  setAutoPlay,
  setBackgroundAudio,
} from "./playerSettings";
import { ProgressTracker, type ProgressTarget } from "./progress";
import {
  endAction,
  EndDebouncer,
  nextEpisodeCard,
  nextInQueue,
  previousInQueue,
  type PlayQueue,
} from "./queue";
import { localStream, resolveVod } from "./resolve";
import { SeekAccumulator, SeekController } from "./seek";
import { usePlayerStore, vodKey, type StartAt, type VodItem, type VodRequest } from "./session";
import { audioUnplayable, trackOptions } from "./tracks";
import { usePlayback, type Playback } from "./usePlayback";
import { useExternalSubtitles } from "./useSubtitles";

// The VOD player (movies, episodes, catch-up): 01-product/player.md §3.1, §3.3, §4, §5;
// 03-design/screens.md "VOD player"; N-04, N-05, N-06, N-07.

/** A seek followed by a fatal error within this window "killed the stream" (§3.1 point 5). */
const SEEK_KILL_WINDOW_MS = 3_000;
const UNLOCK_HINT_MS = 3_000;

function titleOf(item: VodItem): { title: string; subtitle?: string } {
  if (item.kind === "movie") return { title: item.item.name };
  if (item.kind === "episode")
    return {
      title: `S${item.episode.seasonNumber}:E${item.episode.episodeNumber} · ${item.episode.title}`,
      subtitle: item.series.name,
    };
  const p = item.programme;
  return {
    title: `${p.title} ${epgClock(p.start)}~${epgClock(p.stop)}`,
    subtitle: item.channel.name,
  };
}

function progressTarget(item: VodItem): ProgressTarget | undefined {
  if (item.kind === "movie") return { kind: "movie", movieId: item.item.item_id };
  if (item.kind === "episode")
    return {
      kind: "episode",
      seriesId: item.series.item_id,
      episode: {
        id: item.episode.id,
        seasonNumber: item.episode.seasonNumber,
        episodeNumber: item.episode.episodeNumber,
      },
    };
  return undefined;
}

export function PlayerScreen() {
  const { t } = useTranslation();
  const request = usePlayerStore((s) => s.vod);
  const ctx = useBrowse();
  if (!request || !ctx) {
    return (
      <View style={styles.empty}>
        <EmptyState
          icon={Film}
          title={t("msg_stream_could_not_be_started")}
          action={{ label: t("back"), onPress: () => router.back() }}
        />
      </View>
    );
  }
  return <VodPlayer key={request.id} request={request} />;
}

/** Per-item UI state: a new item starts from these values (no effect resets them). */
interface ItemUi {
  key: string;
  paused: boolean;
  aspect: AspectMode;
  audioIndex?: number;
  subtitle: SubtitleChoice;
  /** R-075: "pending" until the media is ready, then shown or skipped. */
  prompt: "pending" | "shown" | "done";
  /** N-07: where the next-episode card appeared (its countdown runs on playback time). */
  cardShownAt?: number;
  cardDismissed: boolean;
}

const freshUi = (key: string, start: StartAt): ItemUi => ({
  key,
  paused: false,
  aspect: "fit",
  subtitle: { kind: "off" },
  prompt: start === "ask" ? "pending" : "done",
  cardDismissed: false,
});

function VodPlayer({ request }: { request: VodRequest }) {
  const { t, i18n } = useTranslation();
  const ctx = useBrowse();
  const pid = ctx?.catalogue.playlistId ?? "";
  const { width, height } = useWindowDimensions();
  const [queue, setQueue] = useState<PlayQueue<VodItem>>(request.queue);
  const [startAt, setStartAt] = useState<StartAt>(request.start);
  const item = queue.items[queue.index] as VodItem;
  const key = vodKey(item);
  const isAdult = item.kind === "catchup" ? false : item.isAdult;

  const [storedUi, setStoredUi] = useState<ItemUi>(() => freshUi(key, startAt));
  const ui = storedUi.key === key ? storedUi : freshUi(key, startAt);
  const setUi = (patch: Partial<ItemUi>) =>
    setStoredUi((prev) => ({ ...(prev.key === key ? prev : freshUi(key, startAt)), ...patch }));

  const saved = useMemo(() => {
    if (item.kind === "movie") return movieResumePosition(kvStore, pid, item.item.item_id);
    if (item.kind === "episode")
      return episodeResumePosition(kvStore, pid, item.series.item_id, item.episode.id);
    return 0;
  }, [item, pid]);

  const videoRef = useRef<VideoRef>(null);
  const lastSeekAt = useRef(0);
  const seekRef = useRef<SeekController | undefined>(undefined);
  const { title, subtitle } = titleOf(item);

  const playback = usePlayback({
    playKey: key,
    resolve: async () => {
      if (!ctx) throw new Error("No playlist");
      // N-03: a finished download plays from the phone, with the same resume keys.
      const local =
        item.kind === "catchup"
          ? undefined
          : downloads().playableFile(
              ctx.catalogue.playlistId,
              item.kind === "movie"
                ? { kind: "movie", item: item.item }
                : { kind: "episode", series: item.series, episode: item.episode },
            );
      return local ? localStream(local) : resolveVod(ctx.catalogue.source, item);
    },
    startAt: typeof startAt === "number" ? startAt : 0,
    restoreOnReconnect: true,
    metadata: { title, subtitle },
    onFatalError: () => {
      if (Date.now() - lastSeekAt.current < SEEK_KILL_WINDOW_MS)
        seekRef.current?.seekKilledStream();
    },
  });

  // ---------- screen state ----------
  const [rate, setRate] = useState(1);
  const [autoPlay, setAutoPlayState] = useState(() => autoPlayOn(kvStore));
  const [backgroundAudio, setBackgroundAudioState] = useState(() => backgroundAudioOn(kvStore));
  const [inPip, setInPip] = useState(false);
  const [controls, setControls] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [locked, setLocked] = useState(false);
  const [unlockHint, setUnlockHint] = useState(false);
  const [sheet, setSheet] = useState<"tracks" | "more" | "episodes" | undefined>();
  const [subtitleStyle, setSubtitleStyle] = useState(() => readSubtitleStyle(kvStore));
  const external = useExternalSubtitles(item, key);
  const endDebouncer = useRef(new EndDebouncer());
  const accumulator = useRef(new SeekAccumulator());
  const loadWaiters = useRef<(() => void)[]>([]);
  const latest = useRef({ position: 0, duration: 0 });

  useKeepAwakeWhile(!ui.paused && playback.started);

  // The seek controller of this item (§3.1): verification, one reload for movies and episodes.
  const current = useRef<{ playback: Playback; resetCursor: () => void }>({
    playback,
    resetCursor: external.resetCursor,
  });
  useEffect(() => {
    current.current = { playback, resetCursor: external.resetCursor };
  });
  useEffect(() => {
    accumulator.current.clear();
    seekRef.current = new SeekController({
      seek: (target) => {
        lastSeekAt.current = Date.now();
        videoRef.current?.seek(target);
        current.current.resetCursor();
      },
      // The position from the progress events (every 250 ms): react-native-video 6.19's
      // getCurrentPosition cannot find the view on the New Architecture (D-073).
      position: async () => latest.current.position,
      reload:
        item.kind === "catchup"
          ? undefined
          : (target) =>
              new Promise<void>((resolve) => {
                loadWaiters.current.push(resolve);
                current.current.playback.reload(target);
              }),
    });
  }, [key, item.kind]);

  // ---------- progress (R-073) ----------
  const tracker = useMemo(() => {
    const target = progressTarget(item);
    return target ? new ProgressTracker(kvStore, pid, target, isAdult) : undefined;
  }, [item, pid, isAdult]);
  useEffect(
    () => () => {
      // Leaving this item (exit, next/previous, an episode switch): save, finish or nothing.
      const { position, duration } = latest.current;
      if (tracker && duration > 0) {
        tracker.leave(position, duration);
        refreshBrowse(pid);
      }
    },
    [tracker, pid],
  );

  // ---------- controls auto-hide (10 s, parity) ----------
  const [tick, setTick] = useState(0);
  const poke = () => setTick((n) => n + 1);
  useEffect(() => {
    if (!controls || ui.paused || scrubbing || sheet || !playback.started) return;
    const timer = setTimeout(() => setControls(false), motion.vodControlsHideMs);
    return () => clearTimeout(timer);
  }, [controls, ui.paused, scrubbing, sheet, playback.started, tick]);

  // ---------- seeking ----------
  const unavailable = () =>
    showToast({
      title: t("seeking_unavailable"),
      text: t("msg_this_provider_does_not_support_skipping_in"),
    });
  const runSeek = (target: number, kind: "seek" | "quick" | "resume" = "seek") => {
    const seek = seekRef.current;
    if (!seek) return;
    if (seek.seekingDisabled) return unavailable();
    if (kind === "resume") tracker?.block("restore");
    void seek.seek(target).then((outcome) => {
      if (kind === "resume") tracker?.unblock("restore");
      if (outcome === "disabled") unavailable();
      else if (outcome === "failed" && kind === "quick")
        showToast({ title: t("seek_failed"), text: t("msg_could_not_jump_to_that_position") });
      else if (outcome === "failed" && kind === "resume") {
        tracker?.protect(target);
        showToast({ title: t("resume_failed"), text: t("msg_could_not_jump_back_to_your_last") });
      }
    });
  };
  const skip = (delta: number) => {
    poke();
    runSeek(accumulator.current.step(delta, playback.position, playback.duration));
  };

  // ---------- resume prompt (R-075) ----------
  const answerResume = (resume: boolean) => {
    setUi({ prompt: "done", paused: false });
    tracker?.unblock("prompt");
    if (resume) runSeek(saved, "resume");
  };

  // ---------- queue ----------
  const next = nextInQueue(queue);
  const previous = previousInQueue(queue);
  const nextItem = next ? next.items[next.index] : undefined;
  const goTo = (q: PlayQueue<VodItem> | undefined) => {
    if (!q) return;
    setQueue(q);
    setStartAt("ask");
  };

  const onEnd = () => {
    if (!endDebouncer.current.accept()) return;
    latest.current = { position: playback.duration, duration: playback.duration };
    const action = endAction(autoPlay && !ui.cardDismissed, next !== undefined);
    if (action === "next") goTo(next);
    else if (action === "close") router.back();
    else {
      setUi({ paused: true });
      setControls(true);
    }
  };

  // ---------- media events ----------
  const onLoad: Playback["handlers"]["onLoad"] = (e) => {
    playback.handlers.onLoad(e);
    loadWaiters.current.splice(0).forEach((resolve) => resolve());
    if (ui.prompt !== "pending") return;
    // Once per video (Q-ffmpeg-audio): the phone has no decoder for any of its audio tracks.
    if (audioUnplayable(e.audioTracks)) showToast({ text: t("mobile_audio_unsupported") });
    // The prompt appears when the media is ready, and only if the stream can seek.
    if (shouldOfferResume(saved, e.duration > 0)) {
      setSheet(undefined);
      setUi({ prompt: "shown", paused: true });
      tracker?.block("prompt");
    } else setUi({ prompt: "done" });
  };

  const cardInput = {
    isEpisode: item.kind === "episode",
    hasNext: nextItem !== undefined,
    autoPlay,
    dismissed: ui.cardDismissed,
    duration: playback.duration,
    shownAt: ui.cardShownAt,
  };
  const card = nextEpisodeCard({ ...cardInput, position: playback.position });

  const onProgress: Playback["handlers"]["onProgress"] = (e) => {
    playback.handlers.onProgress(e);
    const position = e.currentTime;
    latest.current = { position, duration: playback.duration };
    if (!ui.paused) tracker?.tick(position, playback.duration);
    // N-07: remember where the card appeared; at 0 the countdown plays the next episode.
    const state = nextEpisodeCard({ ...cardInput, position });
    if (state.kind === "hidden") {
      if (ui.cardShownAt !== undefined) setUi({ cardShownAt: undefined });
    } else if (ui.cardShownAt === undefined) setUi({ cardShownAt: position });
    else if (state.kind === "countdown" && state.seconds === 0 && !ui.paused) goTo(next);
  };

  // ---------- tracks ----------
  const audio = trackOptions(
    playback.audioTracks.map((a) => ({
      ...a,
      selected: ui.audioIndex === undefined ? a.selected : a.index === ui.audioIndex,
    })),
    (n) => t("mobile_track_n", { n }),
    i18n.language,
  );
  const embedded = trackOptions(
    playback.textTracks,
    (n) => t("mobile_track_n", { n }),
    i18n.language,
  );
  const openTracks = () => {
    if (!playback.loaded) {
      showToast({ text: t("msg_video_not_loaded_yet") });
      return;
    }
    external.lookUp();
    setSheet("tracks");
  };
  const chooseSubtitle = (choice: SubtitleChoice) => {
    setUi({ subtitle: choice });
    external.select(choice.kind === "external" ? choice.code : undefined);
  };

  const box = aspectLayout(ui.aspect, width, height);
  const cue = ui.subtitle.kind === "external" ? external.cueAt(playback.position) : undefined;
  const showControls = controls && !locked && ui.prompt !== "shown";
  const seekable = playback.duration > 0;
  const episodes = item.kind === "episode" ? queue : undefined;

  return (
    <View style={styles.root} testID="player-screen">
      {!inPip ? <PlayerChrome /> : null}
      <View style={styles.videoBox}>
        {playback.source ? (
          <Video
            key={playback.videoKey}
            // Our own controls show what the stream is; no library "LIVE" badge.
            controlsStyles={NO_LIVE_BADGE}
            ref={videoRef}
            source={playback.source}
            style={{ width: box.width, height: box.height }}
            resizeMode={box.resizeMode}
            paused={ui.paused}
            rate={rate}
            progressUpdateInterval={250}
            selectedAudioTrack={
              ui.audioIndex === undefined
                ? undefined
                : { type: SelectedTrackType.INDEX, value: ui.audioIndex }
            }
            selectedTextTrack={
              ui.subtitle.kind === "embedded"
                ? { type: SelectedTrackType.INDEX, value: ui.subtitle.index }
                : { type: SelectedTrackType.DISABLED }
            }
            playInBackground={backgroundAudio}
            showNotificationControls={backgroundAudio}
            enterPictureInPictureOnLeave={!ui.paused && playback.started}
            onPictureInPictureStatusChanged={(e) => setInPip(e.isActive)}
            onLoad={onLoad}
            onReadyForDisplay={playback.handlers.onReadyForDisplay}
            onPlaybackStateChanged={playback.handlers.onPlaybackStateChanged}
            onProgress={onProgress}
            onBuffer={playback.handlers.onBuffer}
            onError={playback.handlers.onError}
            onAudioTracks={playback.handlers.onAudioTracks}
            onTextTracks={playback.handlers.onTextTracks}
            onEnd={onEnd}
            testID="player-video"
          />
        ) : null}
      </View>
      <SubtitleText cue={cue} style={subtitleStyle} />
      {inPip ? null : (
        <>
          <GestureLayer
            locked={locked}
            onTap={() => {
              if (locked) {
                setUnlockHint(true);
                setTimeout(() => setUnlockHint(false), UNLOCK_HINT_MS);
                return;
              }
              setControls((v) => !v);
              poke();
            }}
            onDoubleTapSeek={seekable ? skip : undefined}
            onPinch={(out) => setUi({ aspect: pinchAspect(out) })}
          />
          <PlayerStatus playback={playback} />
          {showControls ? (
            <VodControls
              title={title}
              subtitle={subtitle}
              playing={!ui.paused}
              position={playback.position}
              duration={playback.duration}
              seekable={seekable}
              onBack={() => router.back()}
              onPlayPause={() => {
                poke();
                setUi({ paused: !ui.paused });
              }}
              onSkip={skip}
              onSeek={(target) => {
                poke();
                runSeek(accumulator.current.absolute(target, playback.duration));
              }}
              onScrub={setScrubbing}
              onTracks={openTracks}
              onMore={() => setSheet("more")}
              onPip={() => videoRef.current?.enterPictureInPicture()}
              onLock={() => {
                setLocked(true);
                setControls(false);
              }}
              onPrevious={previous ? () => goTo(previous) : undefined}
              onNext={next ? () => goTo(next) : undefined}
              onEpisodes={episodes ? () => setSheet("episodes") : undefined}
            />
          ) : null}
          {locked && unlockHint ? (
            <View style={styles.unlock}>
              <IconButton
                icon={LockOpen}
                label={t("mobile_unlock_controls")}
                caption={t("mobile_unlock_controls")}
                onPress={() => {
                  setLocked(false);
                  setUnlockHint(false);
                  setControls(true);
                  poke();
                }}
                testID="player-unlock"
              />
            </View>
          ) : null}
          {card.kind !== "hidden" && nextItem && !locked ? (
            <View style={styles.card}>
              <NextEpisodeCard
                state={card}
                title={titleOf(nextItem).title}
                onPlay={() => goTo(next)}
                onCancel={() => setUi({ cardDismissed: true })}
              />
            </View>
          ) : null}
          {ui.prompt === "shown" ? <ResumePrompt position={saved} onAnswer={answerResume} /> : null}
          <TrackSheet
            visible={sheet === "tracks"}
            onClose={() => setSheet(undefined)}
            audio={audio}
            onAudio={(index) => setUi({ audioIndex: index })}
            embedded={embedded}
            external={item.kind === "catchup" ? undefined : external.state}
            subtitle={ui.subtitle}
            onSubtitle={chooseSubtitle}
            style={subtitleStyle}
            onStyle={(style) => {
              setSubtitleStyle(style);
              saveSubtitleStyle(kvStore, style);
            }}
            delay={ui.subtitle.kind === "external" ? external.delay : undefined}
            onDelay={external.setDelay}
          />
          <MoreSheet
            visible={sheet === "more"}
            onClose={() => setSheet(undefined)}
            aspect={ui.aspect}
            onAspect={(mode) => setUi({ aspect: mode })}
            speed={rate}
            onSpeed={setRate}
            autoPlay={item.kind === "catchup" ? undefined : autoPlay}
            onAutoPlay={(on) => {
              setAutoPlayState(on);
              setAutoPlay(kvStore, on);
            }}
            backgroundAudio={backgroundAudio}
            onBackgroundAudio={(on) => {
              setBackgroundAudioState(on);
              setBackgroundAudio(kvStore, on);
            }}
            quickSeekDuration={item.kind === "catchup" ? undefined : playback.duration}
            onQuickSeek={(target) => {
              setSheet(undefined);
              runSeek(accumulator.current.absolute(target, playback.duration), "quick");
            }}
          />
          {episodes ? (
            <ListSheet
              visible={sheet === "episodes"}
              onClose={() => setSheet(undefined)}
              title={t("mobile_episodes")}
              data={episodes.items.map((it, index) => ({ it, index }))}
              keyExtractor={({ it }) => vodKey(it)}
              testID="episodes-sheet"
              renderItem={({ it, index }) => {
                if (it.kind !== "episode") return <View />;
                const d = durationParts(it.episode.durationSecs);
                return (
                  <EpisodeRow
                    number={it.episode.episodeNumber}
                    title={it.episode.title}
                    duration={d ? t("mobile_duration", { h: d.h, m: d.m }) : undefined}
                    image={it.episode.image || it.series.icon}
                    onPress={() => {
                      setSheet(undefined);
                      if (index !== queue.index) goTo({ items: queue.items, index });
                    }}
                    testID={`player-episode-${it.episode.id}`}
                  />
                );
              }}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

const NO_LIVE_BADGE = { hideLiveBadge: true };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.overlay.video },
  empty: { flex: 1, backgroundColor: colors.bg.base, justifyContent: "center" },
  videoBox: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  unlock: { position: "absolute", top: spacing.lg, alignSelf: "center" },
  card: { position: "absolute", right: spacing.xl, bottom: 120 },
});
