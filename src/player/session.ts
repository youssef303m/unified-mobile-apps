// What the player plays (04-build/architecture.md: the player queue lives in zustand). Route params
// cannot carry catalogue items, so screens put the request here and navigate to the player.
import { create } from "zustand";

import type { CatalogueItem, Episode } from "@/content/types";
import type { EpgProgramme } from "@/utils/epgTime";

import type { PlayQueue } from "./queue";

export type VodItem =
  | { kind: "movie"; item: CatalogueItem; isAdult: boolean }
  | { kind: "episode"; series: CatalogueItem; episode: Episode; isAdult: boolean; tmdbId?: string }
  | { kind: "catchup"; channel: CatalogueItem; programme: EpgProgramme };

/** "ask": offer the resume prompt when a position is saved (R-075); a number: start there. */
export type StartAt = "ask" | number;

export interface VodRequest {
  queue: PlayQueue<VodItem>;
  start: StartAt;
  /** Bumped on every open, so reopening the same item restarts it. */
  id: number;
}

export interface LiveRequest {
  /** The channels of the current category (zapping stays inside it, player.md §3.2). */
  channels: readonly CatalogueItem[];
  index: number;
  /** Adult categories (R-063: never recorded as recent). */
  adultCategories: readonly string[];
  id: number;
}

/** The EPG guide's channels: the category the user was on (R-096). */
export interface GuideRequest {
  title: string;
  channels: readonly CatalogueItem[];
  adultCategories: readonly string[];
}

interface PlayerState {
  vod?: VodRequest;
  live?: LiveRequest;
  guide?: GuideRequest;
}

export const usePlayerStore = create<PlayerState>(() => ({}));

let nextId = 1;

export function setVodRequest(queue: PlayQueue<VodItem>, start: StartAt): VodRequest {
  const vod = { queue, start, id: nextId++ };
  usePlayerStore.setState({ vod });
  return vod;
}

export function setLiveRequest(
  channels: readonly CatalogueItem[],
  index: number,
  adultCategories: readonly string[],
): LiveRequest {
  const live = { channels, index, adultCategories, id: nextId++ };
  usePlayerStore.setState({ live });
  return live;
}

/** A stable key for an item (progress, resume, subtitles). */
export function vodKey(item: VodItem): string {
  if (item.kind === "movie") return `movie:${item.item.item_id}`;
  if (item.kind === "episode") return `episode:${item.series.item_id}:${item.episode.id}`;
  return `catchup:${item.channel.item_id}:${item.programme.start}`;
}
