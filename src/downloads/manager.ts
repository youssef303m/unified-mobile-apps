// The download manager (N-03, player.md §8.2): a queue with one download at a time, the space
// check, pause / resume / retry / delete, and the reattach after an app restart. The manifest is
// one JSON list in the key-value store; the files live in the app's private downloads folder.
import type { KeyValueStore } from "@/api/store";
import { readJson } from "@/api/store";
import type { SourceType } from "@/content/types";
import { P } from "@/storage/keys";

import {
  downloadId,
  fileNameFor,
  isDownloadable,
  MAX_PARALLEL,
  spaceCheck,
  storableTarget,
} from "./rules";
import type {
  DownloadError,
  DownloadFiles,
  DownloadRecord,
  DownloadTarget,
  Probe,
  Transfer,
  TransferEvents,
} from "./types";

export const DOWNLOADS_KEY = `${P}mobile_downloads`;
/** N-03: Wi-Fi only, on by default. */
export const WIFI_ONLY_KEY = `${P}mobile_download_wifi_only`;

export interface NewDownload {
  playlistId: string;
  source: SourceType;
  target: DownloadTarget;
  title: string;
  seriesName?: string;
  poster?: string;
  isAdult: boolean;
}

export type AddResult =
  { kind: "queued"; id: string } | { kind: "exists"; id: string } | { kind: "not_downloadable" };

export interface ManagerDeps {
  store: KeyValueStore;
  transfer: Transfer;
  files: DownloadFiles;
  /**
   * The stream for a record, resolved at start (Stalker links expire, URLs are never stored).
   * Undefined while the record's playlist is not the loaded one: the record waits in the queue.
   */
  resolve: (
    record: DownloadRecord,
  ) => Promise<{ url: string; headers?: Record<string, string> } | undefined>;
  probe: (url: string, headers?: Record<string, string>) => Promise<Probe>;
  now?: () => number;
}

/** Progress is saved at most this often (the screen still updates on every event). */
const SAVE_EVERY_MS = 2000;

export class DownloadManager {
  private records: DownloadRecord[];
  private readonly live = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private lastSave = 0;
  private pumping = false;

  constructor(private readonly deps: ManagerDeps) {
    this.records = readJson<DownloadRecord[]>(deps.store, DOWNLOADS_KEY) ?? [];
  }

  // ---------- reading ----------

  list(): readonly DownloadRecord[] {
    return this.records;
  }

  get(id: string): DownloadRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  recordFor(playlistId: string, target: DownloadTarget): DownloadRecord | undefined {
    return this.get(downloadId(playlistId, target));
  }

  /** The finished file for offline playback, if there is one on disk. */
  playableFile(playlistId: string, target: DownloadTarget): string | undefined {
    const record = this.recordFor(playlistId, target);
    if (record?.status !== "done" || this.deps.files.size(record.fileName) === undefined)
      return undefined;
    return this.deps.files.path(record.fileName);
  }

  /** player.md §8.2: playback warns while a download holds a connection. */
  isDownloading(): boolean {
    return this.records.some((r) => r.status === "downloading");
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  wifiOnly(): boolean {
    return this.deps.store.get(WIFI_ONLY_KEY) !== "off";
  }

  // ---------- changing ----------

  setWifiOnly(on: boolean): void {
    this.deps.store.set(WIFI_ONLY_KEY, on ? "on" : "off");
    this.deps.transfer.setAllowMetered(!on);
    this.emit();
  }

  add(input: NewDownload): AddResult {
    if (!isDownloadable(input.source, input.target)) return { kind: "not_downloadable" };
    const id = downloadId(input.playlistId, input.target);
    if (this.get(id)) return { kind: "exists", id };
    this.records = [
      ...this.records,
      {
        id,
        playlistId: input.playlistId,
        target: storableTarget(input.source, input.target),
        title: input.title,
        seriesName: input.seriesName,
        poster: input.poster,
        isAdult: input.isAdult,
        fileName: fileNameFor(id, input.source, input.target),
        status: "queued",
        bytesDone: 0,
        bytesTotal: 0,
        createdAt: this.now(),
      },
    ];
    this.save(true);
    void this.pump();
    return { kind: "queued", id };
  }

  async pause(id: string): Promise<void> {
    const record = this.get(id);
    if (!record) return;
    if (record.status === "downloading" && this.live.has(id)) await this.deps.transfer.pause(id);
    if (record.status === "downloading" || record.status === "queued")
      this.update(id, { status: "paused" }, true);
    void this.pump();
  }

  /** Paused: continues where it stopped. Failed: starts again (a new link, a new request). */
  async resume(id: string): Promise<void> {
    const record = this.get(id);
    if (!record || (record.status !== "paused" && record.status !== "failed")) return;
    if (record.status === "failed" && this.live.has(id)) {
      await this.deps.transfer.stop(id);
      this.live.delete(id);
    }
    this.update(id, { status: "queued", error: undefined }, true);
    await this.pump();
  }

  async remove(id: string): Promise<void> {
    const record = this.get(id);
    if (!record) return;
    if (this.live.has(id)) {
      await this.deps.transfer.stop(id);
      this.live.delete(id);
    }
    this.deleteFiles(record);
    this.records = this.records.filter((r) => r.id !== id);
    this.save(true);
    await this.pump();
  }

  async removeAll(filter: (r: DownloadRecord) => boolean = () => true): Promise<void> {
    for (const record of this.records.filter(filter)) await this.remove(record.id);
  }

  /** N-03: removing a playlist offers to delete its downloads. */
  countForPlaylist(playlistId: string): number {
    return this.records.filter((r) => r.playlistId === playlistId).length;
  }

  /**
   * After an app restart: running and paused native tasks get their events again, finished ones
   * are recorded, and downloads whose task is gone go back to the queue.
   */
  async restore(): Promise<void> {
    const existing = new Map((await this.deps.transfer.existing()).map((t) => [t.id, t]));
    for (const record of this.records) {
      const task = existing.get(record.id);
      if (record.status === "done") {
        if (this.deps.files.size(record.fileName) === undefined)
          this.update(record.id, { status: "failed", error: "not_found" });
        continue;
      }
      if (!task) {
        if (record.status === "downloading") this.update(record.id, { status: "queued" });
        continue;
      }
      this.live.add(record.id);
      this.deps.transfer.attach(record.id, this.events(record.id));
      const progress = {
        bytesDone: task.bytesDone,
        bytesTotal: task.bytesTotal || record.bytesTotal,
      };
      if (task.state === "done") this.finish(record.id, progress.bytesTotal);
      else if (task.state === "failed")
        this.update(record.id, { ...progress, status: "failed", error: "network" });
      else if (task.state === "paused") this.update(record.id, { ...progress, status: "paused" });
      else this.update(record.id, { ...progress, status: "downloading" });
    }
    this.save(true);
    await this.pump();
  }

  /** Starts what waits in the queue (called again once a playlist is loaded). */
  async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      const skipped = new Set<string>();
      for (;;) {
        const active = this.records.filter((r) => r.status === "downloading").length;
        const next = this.records.find((r) => r.status === "queued" && !skipped.has(r.id));
        if (active >= MAX_PARALLEL || !next) return;
        if (!(await this.start(next))) skipped.add(next.id);
      }
    } finally {
      this.pumping = false;
    }
  }

  // ---------- internals ----------

  /** Returns false when the record has to keep waiting (its playlist is not loaded). */
  private async start(record: DownloadRecord): Promise<boolean> {
    if (this.live.has(record.id)) {
      this.update(record.id, { status: "downloading" }, true);
      await this.deps.transfer.resume(record.id);
      return true;
    }
    let stream: Awaited<ReturnType<ManagerDeps["resolve"]>>;
    try {
      stream = await this.deps.resolve(record);
    } catch {
      this.fail(record.id, "source");
      return true;
    }
    if (!stream) return false;
    const probe = await this.deps
      .probe(stream.url, stream.headers)
      .catch(() => ({ ranges: false }) as Probe);
    const space = spaceCheck(this.deps.files.freeBytes(), probe.bytes);
    if (!space.ok) {
      this.fail(record.id, "no_space");
      return true;
    }
    this.deps.files.remove(record.fileName);
    this.update(
      record.id,
      {
        status: "downloading",
        bytesDone: 0,
        bytesTotal: probe.bytes ?? 0,
        noResume: !probe.ranges,
        error: undefined,
      },
      true,
    );
    this.live.add(record.id);
    this.deps.transfer.start(
      {
        id: record.id,
        url: stream.url,
        headers: stream.headers,
        destination: this.deps.files.path(record.fileName),
        title: record.title,
        allowMetered: !this.wifiOnly(),
      },
      this.events(record.id),
    );
    return true;
  }

  private events(id: string): TransferEvents {
    return {
      onBegin: (bytesTotal) => {
        if (bytesTotal > 0) this.update(id, { bytesTotal }, true);
      },
      onProgress: (bytesDone, bytesTotal) =>
        this.update(id, { bytesDone, ...(bytesTotal > 0 ? { bytesTotal } : {}) }),
      onDone: (bytesTotal) => {
        this.finish(id, bytesTotal);
        void this.pump();
      },
      onError: (error) => {
        this.fail(id, error);
        void this.pump();
      },
    };
  }

  private finish(id: string, bytesTotal: number): void {
    const record = this.get(id);
    if (!record) return;
    const size = this.deps.files.size(record.fileName) ?? bytesTotal;
    this.live.delete(id);
    this.update(id, { status: "done", bytesDone: size, bytesTotal: size, error: undefined }, true);
  }

  private fail(id: string, error: DownloadError): void {
    if (!this.get(id)) return;
    this.update(id, { status: "failed", error }, true);
  }

  private deleteFiles(record: DownloadRecord): void {
    this.deps.files.remove(record.fileName);
    for (const sub of record.subtitles ?? []) this.deps.files.remove(sub.fileName);
  }

  private update(id: string, patch: Partial<DownloadRecord>, persist = false): void {
    this.records = this.records.map((r) => (r.id === id ? { ...r, ...patch } : r));
    this.save(persist);
  }

  private save(force: boolean): void {
    const now = this.now();
    if (force || now - this.lastSave >= SAVE_EVERY_MS) {
      this.deps.store.set(DOWNLOADS_KEY, JSON.stringify(this.records));
      this.lastSave = now;
    }
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now();
  }
}
