// Stream URLs are resolved at play time and again before every reconnect (player.md §1.2: Stalker
// links are short-lived tokens; Q-behaviour-fixes #10). In fixture mode the URL becomes a public
// test stream (the native player cannot reach the fixture hosts).
import { playbackUrl } from "@/api/fixtureMode";
import type { ContentSource } from "@/content/ContentSource";
import type { CatalogueItem, StreamTarget } from "@/content/types";

import type { VodItem } from "./session";
import { BUFFER_CONFIG, playbackPlan, sourceType, type StreamKind } from "./streamPlan";

export interface ResolvedStream {
  url: string;
  headers?: Record<string, string>;
  plan: StreamKind[];
}

function resolved(target: StreamTarget): ResolvedStream {
  if (!target.url) throw new Error("No stream URL");
  const url = playbackUrl(target.url);
  return { url, headers: target.headers, plan: playbackPlan(url) };
}

/** A downloaded file (N-03): played as it is, offline too. */
export function localStream(path: string): ResolvedStream {
  return { url: path.startsWith("file://") ? path : `file://${path}`, plan: ["progressive"] };
}

export async function resolveVod(source: ContentSource, item: VodItem): Promise<ResolvedStream> {
  if (item.kind === "movie")
    return resolved(await source.streamUrl({ kind: "movie", item: item.item }));
  if (item.kind === "episode") {
    return resolved(
      await source.streamUrl({ kind: "episode", series: item.series, episode: item.episode }),
    );
  }
  if (!source.catchupUrl) throw new Error("No catch-up for this source");
  return resolved(await source.catchupUrl(item.channel, item.programme));
}

export async function resolveLive(
  source: ContentSource,
  channel: CatalogueItem,
): Promise<ResolvedStream> {
  return resolved(await source.streamUrl({ kind: "live", item: channel }));
}

export interface PlayerSourceOptions {
  /** Milliseconds (a reconnect restores the position, player.md §4.4). */
  startPositionMs?: number;
  metadata?: { title?: string; subtitle?: string; imageUri?: string };
}

/** react-native-video's `source` for one attempt of the plan. */
export function playerSource(
  stream: ResolvedStream,
  attempt: number,
  options: PlayerSourceOptions = {},
) {
  const kind = stream.plan[Math.min(attempt, stream.plan.length - 1)] ?? "progressive";
  return {
    uri: stream.url,
    type: sourceType(kind),
    headers: stream.headers,
    bufferConfig: BUFFER_CONFIG,
    // The reconnect loop is ours (supervisor.ts); Media3's own retries stay short.
    minLoadRetryCount: 2,
    ...(options.startPositionMs !== undefined && options.startPositionMs > 0
      ? { startPosition: Math.round(options.startPositionMs) }
      : {}),
    ...(options.metadata ? { metadata: options.metadata } : {}),
  };
}
