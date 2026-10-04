// N-03 rules (01-product/new-features.md, player.md §8.1): what can be downloaded, the space
// check, and the names the manager uses.
import type { CatalogueItem, Episode, SourceType } from "@/content/types";
import { COMPLETE_FILES, urlPath } from "@/player/streamPlan";

import type { Connection, DownloadRecord, DownloadTarget } from "./types";

/** N-03: free space must cover the file plus this margin. */
export const SPACE_MARGIN_BYTES = 200 * 1024 * 1024;

/**
 * Downloads run one at a time (player.md §8.2 "Limits": a download takes one of the account's
 * connections; new-features.md allows up to 2, docs/decisions.md D-078).
 */
export const MAX_PARALLEL = 1;

const extensionOf = (value: string | undefined) => value?.toLowerCase().replace(/^\./, "").trim();

function progressiveExtension(ext: string | undefined): boolean {
  return ext !== undefined && COMPLETE_FILES.includes(`.${ext}`);
}

/** The file's own address and extension for a target, from the catalogue data. */
function targetFile(target: DownloadTarget): { extension?: string; url?: string; cmd?: string } {
  if (target.kind === "movie")
    return { extension: target.item.extension, url: target.item.url, cmd: target.item.cmd };
  return { extension: target.episode.extension, url: target.episode.url, cmd: target.episode.cmd };
}

/**
 * N-03: Xtream movies and episodes with a file container, M3U entries pointing at a file, and
 * Stalker VOD (the file behind create_link). Never live channels or HLS: the button is hidden.
 */
export function isDownloadable(source: SourceType, target: DownloadTarget): boolean {
  const file = targetFile(target);
  switch (source) {
    case "xtream":
      return progressiveExtension(extensionOf(file.extension));
    case "m3u": {
      const path = urlPath(file.url ?? "");
      return COMPLETE_FILES.some((ext) => path.endsWith(ext));
    }
    case "stalker":
      return Boolean(file.cmd);
  }
}

export function downloadId(playlistId: string, target: DownloadTarget): string {
  return target.kind === "movie"
    ? `${playlistId}:movie:${target.item.item_id}`
    : `${playlistId}:episode:${target.series.item_id}:${target.episode.id}`;
}

/** The file name: the record id made safe, and the container (mp4 when unknown). */
export function fileNameFor(id: string, source: SourceType, target: DownloadTarget): string {
  const file = targetFile(target);
  const fromUrl = urlPath(file.url ?? "").match(/\.([a-z0-9]{2,4})$/)?.[1];
  const ext =
    source === "m3u"
      ? fromUrl
      : progressiveExtension(extensionOf(file.extension))
        ? extensionOf(file.extension)
        : undefined;
  return `${id.replace(/[^a-zA-Z0-9_-]/g, "_")}.${ext ?? "mp4"}`;
}

/** N-03: enough space for the file plus the margin? Unknown sizes need only the margin. */
export function spaceCheck(
  freeBytes: number,
  fileBytes: number | undefined,
): { ok: true } | { ok: false; neededBytes: number } {
  const neededBytes = (fileBytes ?? 0) + SPACE_MARGIN_BYTES;
  return freeBytes >= neededBytes ? { ok: true } : { ok: false, neededBytes };
}

/** N-03: the Wi-Fi only rule applies to this download (on, and mobile data not allowed for it). */
export function needsWifi(record: DownloadRecord, wifiOnly: boolean): boolean {
  return wifiOnly && !record.mobileData;
}

/**
 * Why a running or queued download does not move, for the screens (docs/decisions.md D-083): no
 * connection, or a Wi-Fi only download on mobile data. A running task keeps the rule it started
 * with, so its own flag decides; a queued one follows the setting.
 */
export function waitingFor(
  record: DownloadRecord,
  wifiOnly: boolean,
  connection: Connection,
): "wifi" | "connection" | undefined {
  if (record.status !== "downloading" && record.status !== "queued") return undefined;
  if (connection === "none") return "connection";
  const wifiRule =
    record.status === "downloading" ? record.wifiOnlyTask === true : needsWifi(record, wifiOnly);
  return connection === "metered" && wifiRule ? "wifi" : undefined;
}

/** D-083: tapping Download asks first when Wi-Fi only is on and the phone is on mobile data. */
export function asksBeforeDownload(wifiOnly: boolean, connection: Connection): boolean {
  return wifiOnly && connection === "metered";
}

/**
 * player.md §8.3: nothing in the stored target can rebuild a credentialed URL. M3U file URLs
 * carry the account in the query, so they are dropped and read again from the catalogue at start.
 */
export function storableTarget(source: SourceType, target: DownloadTarget): DownloadTarget {
  if (source !== "m3u") return target;
  const strip = <T extends { url?: string }>(v: T): T => ({ ...v, url: undefined });
  return target.kind === "movie"
    ? { kind: "movie", item: strip<CatalogueItem>(target.item) }
    : { kind: "episode", series: strip(target.series), episode: strip<Episode>(target.episode) };
}

/** Downloads of a series, grouped for the Downloads screen (movies first, then each series). */
export function groupDownloads(records: readonly DownloadRecord[]): {
  movies: DownloadRecord[];
  series: { seriesId: string; name: string; episodes: DownloadRecord[] }[];
} {
  const movies = records.filter((r) => r.target.kind === "movie");
  const bySeries = new Map<
    string,
    { seriesId: string; name: string; episodes: DownloadRecord[] }
  >();
  for (const r of records) {
    if (r.target.kind !== "episode") continue;
    const seriesId = `${r.playlistId}:${r.target.series.item_id}`;
    const group = bySeries.get(seriesId) ?? {
      seriesId,
      name: r.seriesName ?? r.title,
      episodes: [],
    };
    group.episodes.push(r);
    bySeries.set(seriesId, group);
  }
  for (const group of bySeries.values())
    group.episodes.sort((a, b) => {
      const ea = a.target.kind === "episode" ? a.target.episode : undefined;
      const eb = b.target.kind === "episode" ? b.target.episode : undefined;
      return (
        (ea?.seasonNumber ?? 0) - (eb?.seasonNumber ?? 0) ||
        (ea?.episodeNumber ?? 0) - (eb?.episodeNumber ?? 0)
      );
    });
  return { movies, series: [...bySeries.values()] };
}

/** The storage the downloads use (done ones by their size, running ones by what arrived). */
export function storageUsed(records: readonly DownloadRecord[]): number {
  return records.reduce((sum, r) => sum + (r.status === "done" ? r.bytesTotal : r.bytesDone), 0);
}
