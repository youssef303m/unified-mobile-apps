// The EPG guide and catch-up (R-096, R-097; 02-backend/epg-and-catchup.md §3, §4).
//
// Guide rows load lazily, at most 4 at a time, the rows on screen first, each with a 15 s timeout.
// Results are cached per playlist for the session; failed rows are dropped when the guide is
// opened again. If the first 8 rows requested all come back empty, the category has no EPG ("EPG
// could not be loaded" when none of them answered at all).
import { CancelledError, ParseError } from "@/api/errors";
import type { ContentSource } from "@/content/ContentSource";
import { GUIDE, guideGivesUp, hiddenCategories, replayAvailability } from "@/content/rules/live";
import type { CatalogueItem } from "@/content/types";
import { archiveCategories, archiveChannels, type CategoryRow } from "@/db/queries/catalogue";
import type { SortKey } from "@/storage/settings";
import {
  groupFinishedByDay,
  type CatchupDay,
  type EpgProgramme,
  type GuideProgramme,
} from "@/utils/epgTime";

import type { BrowseContext } from "./context";

export type GuideRow =
  { status: "loading" } | { status: "done"; programmes: GuideProgramme[] } | { status: "error" };

export type GuideProbe = "pending" | "ok" | "no_epg" | "failed";

interface CacheEntry {
  status: "done" | "error";
  programmes: GuideProgramme[];
}

const caches = new Map<string, Map<string, CacheEntry>>();

/** The session cache of one playlist (cleared when the app restarts). */
function cacheFor(playlistId: string): Map<string, CacheEntry> {
  let cache = caches.get(playlistId);
  if (!cache) {
    cache = new Map();
    caches.set(playlistId, cache);
  }
  return cache;
}

/** Tests only: forget every cached row. */
export function clearGuideCache(): void {
  caches.clear();
}

export class GuideLoader {
  private readonly cache: Map<string, CacheEntry>;
  private readonly queue: CatalogueItem[] = [];
  private readonly running = new Map<string, AbortController>();
  private readonly probed: (number | "error")[] = [];
  private probeState: GuideProbe = "pending";
  private probeTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  constructor(
    private readonly source: ContentSource,
    playlistId: string,
    private readonly onChange: () => void,
  ) {
    this.cache = cacheFor(playlistId);
    // Opening the guide again retries the rows that failed last time.
    for (const [id, entry] of this.cache) if (entry.status === "error") this.cache.delete(id);
  }

  get probe(): GuideProbe {
    return this.probeState;
  }

  row(channel: CatalogueItem): GuideRow {
    const entry = this.cache.get(channel.item_id);
    if (!entry) return { status: "loading" };
    return entry.status === "done"
      ? { status: "done", programmes: entry.programmes }
      : { status: "error" };
  }

  /** The rows on screen, in order: they go to the front of the queue. */
  request(channels: readonly CatalogueItem[]): void {
    if (this.disposed || !this.source.guide) return;
    const wanted = channels.filter(
      (c) => !this.cache.has(c.item_id) && !this.running.has(c.item_id),
    );
    const rest = this.queue.filter((q) => !wanted.some((w) => w.item_id === q.item_id));
    this.queue.splice(0, this.queue.length, ...wanted, ...rest);
    if (this.probeTimer === undefined && this.probeState === "pending") {
      this.probeTimer = setTimeout(() => this.finishProbe(true), GUIDE.requestTimeoutMs);
    }
    this.pump();
  }

  dispose(): void {
    this.disposed = true;
    if (this.probeTimer !== undefined) clearTimeout(this.probeTimer);
    for (const controller of this.running.values()) controller.abort();
    this.running.clear();
    this.queue.length = 0;
  }

  private pump(): void {
    while (!this.disposed && this.running.size < GUIDE.maxConcurrent && this.queue.length > 0) {
      const channel = this.queue.shift();
      if (channel && !this.cache.has(channel.item_id)) void this.load(channel);
    }
  }

  private async load(channel: CatalogueItem): Promise<void> {
    const controller = new AbortController();
    this.running.set(channel.item_id, controller);
    const timer = setTimeout(() => controller.abort(), GUIDE.requestTimeoutMs);
    let entry: CacheEntry;
    try {
      const programmes = (await this.source.guide?.(channel, controller.signal)) ?? [];
      entry = { status: "done", programmes };
    } catch (error) {
      if (this.disposed && error instanceof CancelledError) return;
      entry = { status: "error", programmes: [] };
    } finally {
      clearTimeout(timer);
      this.running.delete(channel.item_id);
    }
    if (this.disposed) return;
    this.cache.set(channel.item_id, entry);
    this.recordProbe(entry);
    this.onChange();
    this.pump();
  }

  private recordProbe(entry: CacheEntry): void {
    if (this.probeState !== "pending") return;
    this.probed.push(entry.status === "error" ? "error" : entry.programmes.length);
    if (this.probed.some((n) => n !== "error" && n > 0)) return this.finishProbe(false);
    if (this.probed.length >= GUIDE.probeRows) this.finishProbe(false);
  }

  private finishProbe(timedOut: boolean): void {
    if (this.probeState !== "pending") return;
    if (this.probeTimer !== undefined) clearTimeout(this.probeTimer);
    this.probeTimer = undefined;
    const answered = this.probed.filter((n): n is number => n !== "error");
    if (answered.some((n) => n > 0)) this.probeState = "ok";
    else if (answered.length === 0) this.probeState = "failed";
    else if (timedOut || guideGivesUp(this.probed.map((n) => (n === "error" ? 0 : n))))
      this.probeState = "no_epg";
    else return;
    this.onChange();
  }
}

/** The whole guide days on screen: the distinct local days of the loaded rows, and today. */
export function guideDays(rows: readonly GuideRow[], now: Date = new Date()): Date[] {
  const keys = new Set<number>([startOfDay(now).getTime()]);
  for (const row of rows) {
    if (row.status !== "done") continue;
    for (const p of row.programmes) keys.add(startOfDay(p.start).getTime());
  }
  return [...keys].sort((a, b) => a - b).map((t) => new Date(t));
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Mobile guide taps (03-design/screens.md "EPG guide", testing.md flow 4): now → play the
 * channel; past with an archive (Xtream, R-097) → the catch-up; future → the details; past
 * without an archive → nothing to play. R-096's TV rule (past programmes never play) is kept in
 * `guideTapAction`; the phone follows its own design here (docs/decisions.md).
 */
export function mobileGuideTap(
  programme: GuideProgramme,
  canReplay: boolean,
  now: Date = new Date(),
): "play_live" | "catchup" | "details" | "no_archive" {
  const t = now.getTime();
  if (t >= programme.start.getTime() && t < programme.stop.getTime()) return "play_live";
  if (t < programme.start.getTime()) return "details";
  return canReplay && programme.archive ? "catchup" : "no_archive";
}

export type CatchupResult =
  | { kind: "ok"; days: CatchupDay[] }
  | { kind: "empty" }
  | { kind: "error"; reason: "bad_reply" | "request_failed" };

/** R-097: the finished programmes with an archive, grouped by day (oldest first). */
export async function loadCatchup(
  source: ContentSource,
  channel: CatalogueItem,
  signal?: AbortSignal,
  now: Date = new Date(),
): Promise<CatchupResult> {
  if (!source.catchup) return { kind: "empty" };
  let programmes: EpgProgramme[];
  try {
    programmes = await source.catchup(channel, signal);
  } catch (error) {
    if (error instanceof CancelledError) throw error;
    // §3.2: no epg_listings → "Something went wrong"; an HTTP error → "…or no EPG available".
    return { kind: "error", reason: error instanceof ParseError ? "bad_reply" : "request_failed" };
  }
  const days = groupFinishedByDay(programmes, now);
  return days.length > 0 ? { kind: "ok", days } : { kind: "empty" };
}

/**
 * R-097 Replay: the live categories (hidden ones left out) that hold channels with an archive.
 * "none" when the source has no Replay (Stalker is blocked, M3U has none) or nothing is left.
 */
export async function replayCategories(
  ctx: BrowseContext,
): Promise<{ kind: "ok"; categories: CategoryRow[] } | { kind: "none" }> {
  const source = ctx.catalogue.source;
  if (replayAvailability(source.type) !== "available") return { kind: "none" };
  const pid = ctx.catalogue.playlistId;
  const hidden = new Set(hiddenCategories(ctx.store, pid, "live"));
  const categories = (await archiveCategories(ctx.db, pid)).filter(
    (c) => !hidden.has(c.category_id),
  );
  return categories.length > 0 ? { kind: "ok", categories } : { kind: "none" };
}

/** R-097 / R-090: a category's channels with an archive, in the `live_sort` order. */
export function replayChannels(
  ctx: BrowseContext,
  categoryId: string,
  sort: SortKey,
): Promise<CatalogueItem[]> {
  return archiveChannels(ctx.db, ctx.catalogue.playlistId, categoryId, sort);
}
