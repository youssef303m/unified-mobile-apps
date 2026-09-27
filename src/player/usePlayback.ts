// One play of one item: resolve the URL, drive the supervisor (first-frame watchdog, fallback,
// reconnect loop), and hand react-native-video its source and event handlers. Shared by the VOD
// player, the live player and the Live tab's mini player. All state belongs to one `playKey`: a
// new key starts from fresh state without an effect resetting it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  OnAudioTracksData,
  OnLoadData,
  OnPlaybackStateChangedData,
  OnProgressData,
  OnTextTracksData,
  OnVideoErrorData,
} from "react-native-video";

import { classifyPlaybackError, type PlaybackErrorKind } from "./errors";
import { playerSource, type PlayerSourceOptions, type ResolvedStream } from "./resolve";
import { PlaybackSupervisor, type LoadReason, type SupervisorStatus } from "./supervisor";
import type { TrackInfo } from "./tracks";

export interface PlaybackInput {
  /** A new key is a new play. */
  playKey: string;
  resolve: (signal: AbortSignal) => Promise<ResolvedStream>;
  /** Seconds to start at on the first load. */
  startAt?: number;
  /** VOD: a reconnect reloads at the last position (player.md §4.4); live reloads at the edge. */
  restoreOnReconnect: boolean;
  metadata?: PlayerSourceOptions["metadata"];
  /** Called on every fatal player error, before the supervisor reacts (seek checks use it). */
  onFatalError?: () => void;
}

export type PlaybackStatus = SupervisorStatus | "resolving";

interface LoadState {
  stream?: ResolvedStream;
  attempt: number;
  generation: number;
  startPositionMs?: number;
}

interface PlayState {
  key: string;
  load: LoadState;
  status: PlaybackStatus;
  /** Why the play failed (after the reconnect loop, or when the URL could not be resolved). */
  error: PlaybackErrorKind | "not_started" | undefined;
  /** The first frame of this load has been shown. */
  started: boolean;
  loaded: boolean;
  buffering: boolean;
  position: number;
  duration: number;
  audioTracks: TrackInfo[];
  textTracks: TrackInfo[];
  videoSize: { width: number; height: number } | undefined;
}

export interface Playback extends Omit<PlayState, "key" | "load"> {
  source: ReturnType<typeof playerSource> | undefined;
  /** Remounts the video for every (re)load, so the same URL reloads. */
  videoKey: string;
  retry: () => void;
  /** Reload the same stream at `positionS` (the seek retry). */
  reload: (positionS: number) => void;
  handlers: {
    onLoad: (e: OnLoadData) => void;
    onReadyForDisplay: () => void;
    onPlaybackStateChanged: (e: OnPlaybackStateChangedData) => void;
    onProgress: (e: OnProgressData) => void;
    onBuffer: (e: { isBuffering: boolean }) => void;
    onError: (e: OnVideoErrorData) => void;
    onAudioTracks: (e: OnAudioTracksData) => void;
    onTextTracks: (e: OnTextTracksData) => void;
  };
}

const fresh = (key: string, startAt: number): PlayState => ({
  key,
  load: { attempt: 0, generation: 0 },
  status: "resolving",
  error: undefined,
  started: false,
  loaded: false,
  buffering: false,
  position: startAt,
  duration: 0,
  audioTracks: [],
  textTracks: [],
  videoSize: undefined,
});

export function usePlayback(input: PlaybackInput): Playback {
  const { playKey } = input;
  const startAt = input.startAt ?? 0;
  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  });

  const [stored, setStored] = useState<PlayState>(() => fresh(playKey, startAt));
  const state = stored.key === playKey ? stored : fresh(playKey, startAt);

  /** Update the state of `key` (updates for an older key start from fresh state). */
  const update = useCallback(
    (key: string, patch: Partial<PlayState> | ((s: PlayState) => Partial<PlayState>)) =>
      setStored((prev) => {
        const base = prev.key === key ? prev : fresh(key, inputRef.current.startAt ?? 0);
        return { ...base, ...(typeof patch === "function" ? patch(base) : patch), key };
      }),
    [],
  );

  const supervisor = useRef<PlaybackSupervisor | undefined>(undefined);
  const stream = useRef<ResolvedStream | undefined>(undefined);
  const positionRef = useRef(0);
  const startedRef = useRef(false);
  const lastError = useRef<PlaybackErrorKind | undefined>(undefined);
  const abort = useRef<AbortController | undefined>(undefined);

  /** A new load of `stream` (a new video mount). */
  const bump = useCallback(
    (key: string, next: Omit<LoadState, "generation">) => {
      startedRef.current = false;
      update(key, (s) => ({
        started: false,
        loaded: false,
        load: { ...next, generation: s.load.generation + 1 },
      }));
    },
    [update],
  );

  /** Resolve, then start the supervisor; a failed resolve is "not started" (no automatic retry). */
  const begin = useCallback(
    (key: string, controller: AbortController) => {
      // VOD reloads where it was (the start position before the first frame); live at the edge.
      const at = () => (inputRef.current.restoreOnReconnect ? positionRef.current : 0) * 1000;
      const onLoadRequest = (attempt: number, reason: LoadReason) => {
        if (reason !== "reconnect") {
          bump(key, { stream: stream.current, attempt, startPositionMs: at() });
          return;
        }
        // Every reconnect asks for a fresh URL (Q-behaviour-fixes #10).
        void inputRef.current
          .resolve(controller.signal)
          .then((next) => {
            if (controller.signal.aborted) return;
            stream.current = next;
            bump(key, { stream: next, attempt, startPositionMs: at() });
          })
          .catch(() => {
            if (!controller.signal.aborted) supervisor.current?.error();
          });
      };
      void inputRef.current
        .resolve(controller.signal)
        .then((first) => {
          if (controller.signal.aborted) return;
          stream.current = first;
          const sup = new PlaybackSupervisor(first.plan.length, {
            load: onLoadRequest,
            state: (st) =>
              update(key, {
                status: st.status,
                error: st.status === "failed" ? (lastError.current ?? "generic") : undefined,
              }),
          });
          supervisor.current = sup;
          sup.start();
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          // player.md §6 "Stalker failure": the screen shows the message and offers Retry.
          update(key, { status: "failed", error: "not_started" });
        });
    },
    [bump, update],
  );

  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    positionRef.current = inputRef.current.startAt ?? 0;
    lastError.current = undefined;
    begin(playKey, controller);
    return () => {
      controller.abort();
      supervisor.current?.dispose();
      supervisor.current = undefined;
      stream.current = undefined;
    };
  }, [playKey, begin]);

  const retry = useCallback(() => {
    lastError.current = undefined;
    update(playKey, { error: undefined });
    if (supervisor.current) supervisor.current.start();
    else if (abort.current) {
      update(playKey, { status: "resolving" });
      begin(playKey, abort.current);
    }
  }, [begin, playKey, update]);

  const attempt = state.load.attempt;
  const reload = useCallback(
    (positionS: number) => {
      positionRef.current = positionS;
      bump(playKey, { stream: stream.current, attempt, startPositionMs: positionS * 1000 });
    },
    [bump, playKey, attempt],
  );

  const handlers = useMemo<Playback["handlers"]>(() => {
    const markStarted = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      update(playKey, { started: true });
      supervisor.current?.firstFrame();
    };
    return {
      onLoad: (e) =>
        update(playKey, {
          loaded: true,
          duration: e.duration > 0 && Number.isFinite(e.duration) ? e.duration : 0,
          audioTracks: e.audioTracks,
          textTracks: e.textTracks,
          ...(e.naturalSize.width > 0 ? { videoSize: e.naturalSize } : {}),
        }),
      onReadyForDisplay: markStarted,
      onPlaybackStateChanged: (e) => {
        if (e.isPlaying) markStarted();
      },
      onProgress: (e) => {
        positionRef.current = e.currentTime;
        update(playKey, { position: e.currentTime });
      },
      onBuffer: (e) => update(playKey, { buffering: e.isBuffering }),
      onError: (e) => {
        lastError.current = classifyPlaybackError(e.error);
        inputRef.current.onFatalError?.();
        supervisor.current?.error();
      },
      onAudioTracks: (e) => update(playKey, { audioTracks: e.audioTracks }),
      onTextTracks: (e) => update(playKey, { textTracks: e.textTracks }),
    };
  }, [playKey, update]);

  const { load } = state;
  const metadata = input.metadata;
  const source = useMemo(
    () =>
      load.stream
        ? playerSource(load.stream, load.attempt, {
            startPositionMs: load.startPositionMs,
            metadata,
          })
        : undefined,
    // Metadata changes alone do not reload the stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );

  return {
    source,
    videoKey: `${playKey}:${load.generation}`,
    status: state.status,
    error: state.error,
    started: state.started,
    loaded: state.loaded,
    buffering: state.buffering,
    position: state.position,
    duration: state.duration,
    audioTracks: state.audioTracks,
    textTracks: state.textTracks,
    videoSize: state.videoSize,
    retry,
    reload,
    handlers,
  };
}
