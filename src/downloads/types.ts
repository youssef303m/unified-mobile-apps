// Downloads (N-03, player.md §8): the manifest record kept per download, and the native
// transfer the manager drives. Platform-free: the app passes the background downloader and
// expo-file-system (native.ts), the tests fakes.
import type { CatalogueItem, Episode } from "@/content/types";

export type DownloadStatus = "queued" | "downloading" | "paused" | "done" | "failed";

/** Why a download stopped (the Downloads screen explains it). */
export type DownloadError = "network" | "no_space" | "access" | "not_found" | "source" | "unknown";

/**
 * What the app needs to resolve the stream again and to play the file offline. No stream URL is
 * stored (player.md §8.3: Xtream and M3U URLs hold the credentials; Stalker links expire): the
 * URL is rebuilt from these ids whenever a download starts.
 */
export type DownloadTarget =
  | { kind: "movie"; item: CatalogueItem }
  | { kind: "episode"; series: CatalogueItem; episode: Episode };

export interface DownloadRecord {
  /** `<playlist>:<kind>:<item or episode id>`. */
  id: string;
  playlistId: string;
  target: DownloadTarget;
  title: string;
  /** Episodes: the series name, for grouping. */
  seriesName?: string;
  poster?: string;
  /** R-061 / R-063: asks for the PIN every time, never saves a position. */
  isAdult: boolean;
  /** File name in the downloads folder. */
  fileName: string;
  status: DownloadStatus;
  bytesDone: number;
  /** 0 until the server says (Content-Length). */
  bytesTotal: number;
  error?: DownloadError;
  /** The server ignores Range: an interrupted download starts again (player.md §8.2). */
  noResume?: boolean;
  /** The user chose to download this one on mobile data although Wi-Fi only is on. */
  mobileData?: boolean;
  /**
   * Its native task was started Wi-Fi only. The library fixes that rule per task, so once mobile
   * data is allowed the task is replaced by a new one.
   */
  wifiOnlyTask?: boolean;
  /** Unix milliseconds. */
  createdAt: number;
  /** Subtitle files next to the video (player.md §8.2), by language code. */
  subtitles?: { lang: string; fileName: string }[];
}

export interface TransferEvents {
  onBegin: (bytesTotal: number) => void;
  onProgress: (bytesDone: number, bytesTotal: number) => void;
  onDone: (bytesTotal: number) => void;
  onError: (error: DownloadError) => void;
}

export interface TransferSpec {
  id: string;
  url: string;
  headers?: Record<string, string>;
  /** Absolute path of the file. */
  destination: string;
  /** Shown in the progress notification (never the URL). */
  title: string;
  allowMetered: boolean;
}

export interface ExistingTransfer {
  id: string;
  state: "running" | "paused" | "done" | "failed";
  bytesDone: number;
  bytesTotal: number;
}

/** The background downloader. */
export interface Transfer {
  start(spec: TransferSpec, events: TransferEvents): void;
  /** Tasks that survived an app restart; `attach` receives their events again. */
  existing(): Promise<ExistingTransfer[]>;
  attach(id: string, events: TransferEvents): void;
  pause(id: string): Promise<void>;
  resume(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  setAllowMetered(allow: boolean): void;
}

/** The downloads folder. */
export interface DownloadFiles {
  path(fileName: string): string;
  /** Size on disk, or undefined when the file does not exist. */
  size(fileName: string): number | undefined;
  remove(fileName: string): void;
  write(fileName: string, text: string): void;
  read(fileName: string): string | undefined;
  freeBytes(): number;
}

/** The phone's connection, as far as downloads care (unknown until the first reading). */
export type Connection = "unmetered" | "metered" | "none" | "unknown";

/** What a HEAD (or a one-byte Range GET) says about the file before starting. */
export interface Probe {
  bytes?: number;
  ranges: boolean;
}
