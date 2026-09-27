// The phone side of the download manager: @kesha-antonov/react-native-background-downloader for
// the transfers (in-app downloader on every Android version, D-078), expo-file-system for the
// downloads folder, and a HEAD / one-byte Range probe for the size and Range support.
import {
  createDownloadTask,
  getExistingDownloadTasks,
  setConfig,
  type DownloadTask,
} from "@kesha-antonov/react-native-background-downloader";
import { Directory, File, Paths } from "expo-file-system";

import type {
  DownloadError,
  DownloadFiles,
  ExistingTransfer,
  Probe,
  Transfer,
  TransferEvents,
} from "./types";

const FOLDER = "downloads";
const PROBE_TIMEOUT_MS = 15_000;

export function errorFor(errorCode: number, message = ""): DownloadError {
  if (errorCode === 401 || errorCode === 403 || errorCode === 410) return "access";
  if (errorCode === 404) return "not_found";
  if (/ENOSPC|no space/i.test(message)) return "no_space";
  if (errorCode >= 400) return "source";
  return "network";
}

function stateOf(task: DownloadTask): ExistingTransfer["state"] {
  switch (task.state) {
    case "DONE":
      return "done";
    case "PAUSED":
      return "paused";
    case "FAILED":
    case "STOPPED":
      return "failed";
    default:
      return "running";
  }
}

export interface NotificationTexts {
  title: string;
  starting: string;
  progress: string;
  paused: string;
  finished: string;
  group: string;
}

export class NativeTransfer implements Transfer {
  private readonly tasks = new Map<string, DownloadTask>();

  constructor(texts: NotificationTexts, allowMetered: boolean) {
    setConfig({
      maxParallelDownloads: 1,
      allowsCellularAccess: allowMetered,
      progressInterval: 1000,
      showNotificationsEnabled: true,
      // Never: native logs would print the URL (player.md §8.3).
      isLogsEnabled: false,
      notificationsGrouping: {
        enabled: false,
        texts: {
          downloadTitle: texts.title,
          downloadStarting: texts.starting,
          downloadProgress: texts.progress,
          downloadPaused: texts.paused,
          downloadFinished: texts.finished,
          groupTitle: texts.group,
        },
      },
    });
  }

  private bind(task: DownloadTask, events: TransferEvents): void {
    task
      .begin(({ expectedBytes }) => events.onBegin(expectedBytes))
      .progress(({ bytesDownloaded, bytesTotal }) => events.onProgress(bytesDownloaded, bytesTotal))
      .done(({ bytesTotal }) => {
        this.tasks.delete(task.id);
        events.onDone(bytesTotal);
      })
      .error(({ error, errorCode }) => {
        this.tasks.delete(task.id);
        events.onError(errorFor(errorCode, error));
      });
  }

  start(spec: Parameters<Transfer["start"]>[0], events: TransferEvents): void {
    const task = createDownloadTask({
      id: spec.id,
      url: spec.url,
      destination: spec.destination,
      headers: spec.headers,
      isAllowedOverMetered: spec.allowMetered,
      notificationTitle: spec.title,
    });
    this.tasks.set(spec.id, task);
    this.bind(task, events);
    task.start();
  }

  async existing(): Promise<ExistingTransfer[]> {
    const tasks = await getExistingDownloadTasks();
    for (const task of tasks) this.tasks.set(task.id, task);
    return tasks.map((task) => ({
      id: task.id,
      state: stateOf(task),
      bytesDone: task.bytesDownloaded,
      bytesTotal: task.bytesTotal,
    }));
  }

  attach(id: string, events: TransferEvents): void {
    const task = this.tasks.get(id);
    if (task) this.bind(task, events);
  }

  async pause(id: string): Promise<void> {
    await this.tasks.get(id)?.pause();
  }

  async resume(id: string): Promise<void> {
    await this.tasks.get(id)?.resume();
  }

  async stop(id: string): Promise<void> {
    await this.tasks.get(id)?.stop();
    this.tasks.delete(id);
  }

  setAllowMetered(allow: boolean): void {
    setConfig({ allowsCellularAccess: allow });
  }
}

/** App-private storage: no permission, removed on uninstall, unreadable by other apps. */
export class NativeFiles implements DownloadFiles {
  private readonly folder: Directory;

  constructor() {
    this.folder = new Directory(Paths.document, FOLDER);
    if (!this.folder.exists) this.folder.create({ intermediates: true, idempotent: true });
  }

  private file(name: string): File {
    return new File(this.folder, name);
  }

  /** A plain path (the downloader wants no scheme). */
  path(name: string): string {
    return decodeURIComponent(this.file(name).uri.replace(/^file:\/\//, ""));
  }

  size(name: string): number | undefined {
    const file = this.file(name);
    return file.exists ? (file.size ?? 0) : undefined;
  }

  remove(name: string): void {
    const file = this.file(name);
    if (file.exists) file.delete();
  }

  write(name: string, text: string): void {
    const file = this.file(name);
    if (!file.exists) file.create({ overwrite: true });
    file.write(text);
  }

  read(name: string): string | undefined {
    const file = this.file(name);
    return file.exists ? file.textSync() : undefined;
  }

  freeBytes(): number {
    return Paths.availableDiskSpace;
  }
}

/** A `file://` URI for the player. */
export const fileUri = (path: string) => (path.startsWith("file://") ? path : `file://${path}`);

async function timed(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * player.md §8.2: the size (Content-Length) and whether the server honours Range. Many IPTV
 * servers answer HEAD badly, so a one-byte Range GET is the fallback.
 */
export async function probe(url: string, headers?: Record<string, string>): Promise<Probe> {
  try {
    const head = await timed(url, { method: "HEAD", headers });
    const length = Number(head.headers.get("content-length"));
    if (head.ok && length > 0)
      return { bytes: length, ranges: /bytes/i.test(head.headers.get("accept-ranges") ?? "") };
  } catch {
    // Fall through to the Range GET.
  }
  const get = await timed(url, { method: "GET", headers: { ...headers, Range: "bytes=0-0" } });
  const total = Number(get.headers.get("content-range")?.split("/")[1]);
  const length = Number(get.headers.get("content-length"));
  void get.body?.cancel();
  if (get.status === 206 && total > 0) return { bytes: total, ranges: true };
  return { bytes: length > 1 ? length : undefined, ranges: false };
}
