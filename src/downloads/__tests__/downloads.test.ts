// N-03 downloads: what can be downloaded, the manager's state machine (queued → downloading →
// paused → done / failed → resumed), the space check and the restore after a restart, on a fake
// transfer and folder (testing.md §3).
import { memoryStore } from "@/api/store";
import type { CatalogueItem, Episode } from "@/content/types";

import { DOWNLOADS_KEY, DownloadManager, type NewDownload } from "../manager";
import {
  downloadId,
  groupDownloads,
  isDownloadable,
  SPACE_MARGIN_BYTES,
  spaceCheck,
  storageUsed,
} from "../rules";
import type {
  DownloadFiles,
  DownloadRecord,
  ExistingTransfer,
  Probe,
  Transfer,
  TransferEvents,
  TransferSpec,
} from "../types";

const GB = 1024 ** 3;

const movie = (id: string, extra: Partial<CatalogueItem> = {}): CatalogueItem => ({
  kind: "movie",
  item_id: id,
  name: `Movie ${id}`,
  icon: "",
  category_id: "1",
  extension: "mp4",
  tv_archive: 0,
  tv_archive_duration: 0,
  ...extra,
});
const series: CatalogueItem = {
  ...movie("s1"),
  kind: "series",
  name: "Show",
  extension: undefined,
};
const episode = (n: number, extra: Partial<Episode> = {}): Episode => ({
  id: `e${n}`,
  title: `Episode ${n}`,
  seasonNumber: 1,
  episodeNumber: n,
  extension: "mkv",
  ...extra,
});

class FakeTransfer implements Transfer {
  started: TransferSpec[] = [];
  events = new Map<string, TransferEvents>();
  paused: string[] = [];
  resumed: string[] = [];
  stopped: string[] = [];
  surviving: ExistingTransfer[] = [];
  allowMetered?: boolean;
  start(spec: TransferSpec, events: TransferEvents) {
    this.started.push(spec);
    this.events.set(spec.id, events);
  }
  async existing() {
    return this.surviving;
  }
  attach(id: string, events: TransferEvents) {
    this.events.set(id, events);
  }
  async pause(id: string) {
    this.paused.push(id);
  }
  async resume(id: string) {
    this.resumed.push(id);
  }
  async stop(id: string) {
    this.stopped.push(id);
  }
  setAllowMetered(allow: boolean) {
    this.allowMetered = allow;
  }
  emit(id: string): TransferEvents {
    const events = this.events.get(id);
    if (!events) throw new Error(`no task ${id}`);
    return events;
  }
}

class FakeFiles implements DownloadFiles {
  sizes = new Map<string, number>();
  texts = new Map<string, string>();
  removed: string[] = [];
  free = 10 * GB;
  path(name: string) {
    return `/data/downloads/${name}`;
  }
  size(name: string) {
    return this.sizes.get(name);
  }
  remove(name: string) {
    this.removed.push(name);
    this.sizes.delete(name);
    this.texts.delete(name);
  }
  write(name: string, text: string) {
    this.texts.set(name, text);
  }
  read(name: string) {
    return this.texts.get(name);
  }
  freeBytes() {
    return this.free;
  }
}

function setup(
  options: {
    probe?: Probe;
    resolveUndefined?: boolean;
    onFinished?: (r: DownloadRecord) => void;
  } = {},
) {
  const store = memoryStore();
  const transfer = new FakeTransfer();
  const files = new FakeFiles();
  const resolved: string[] = [];
  let loaded = !options.resolveUndefined;
  const manager = new DownloadManager({
    store,
    transfer,
    files,
    resolve: async (record) => {
      if (!loaded) return undefined;
      resolved.push(record.id);
      return { url: `http://host/movie/user/pass/${record.id}.mp4` };
    },
    probe: async () => options.probe ?? { bytes: GB, ranges: true },
    onFinished: options.onFinished,
    now: () => 1_000,
  });
  return { store, transfer, files, manager, resolved, load: () => (loaded = true) };
}

const newMovie = (id: string, extra: Partial<NewDownload> = {}): NewDownload => ({
  playlistId: "p1",
  source: "xtream",
  target: { kind: "movie", item: movie(id) },
  title: `Movie ${id}`,
  isAdult: false,
  ...extra,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("N-03 what can be downloaded", () => {
  it("Xtream files, M3U file URLs and Stalker VOD; never HLS", () => {
    expect(isDownloadable("xtream", { kind: "movie", item: movie("1") })).toBe(true);
    expect(
      isDownloadable("xtream", { kind: "movie", item: movie("1", { extension: "m3u8" }) }),
    ).toBe(false);
    expect(
      isDownloadable("xtream", { kind: "movie", item: movie("1", { extension: undefined }) }),
    ).toBe(false);
    expect(isDownloadable("xtream", { kind: "episode", series, episode: episode(1) })).toBe(true);
    const m3u = (url: string) => ({
      kind: "movie" as const,
      item: movie("1", { extension: undefined, url }),
    });
    expect(isDownloadable("m3u", m3u("http://h/get/film.MKV?token=1"))).toBe(true);
    expect(isDownloadable("m3u", m3u("http://h/vod/film/index.m3u8"))).toBe(false);
    expect(isDownloadable("m3u", m3u("http://h/live/123"))).toBe(false);
    expect(
      isDownloadable("stalker", { kind: "movie", item: movie("1", { cmd: "/media/1.mpg" }) }),
    ).toBe(true);
    expect(isDownloadable("stalker", { kind: "movie", item: movie("1", { cmd: undefined }) })).toBe(
      false,
    );
  });

  it("checks free space for the file plus 200 MB", () => {
    expect(spaceCheck(GB + SPACE_MARGIN_BYTES, GB)).toEqual({ ok: true });
    expect(spaceCheck(GB, GB)).toEqual({ ok: false, neededBytes: GB + SPACE_MARGIN_BYTES });
    expect(spaceCheck(SPACE_MARGIN_BYTES, undefined)).toEqual({ ok: true });
  });
});

describe("N-03 download manager", () => {
  it("starts a queued download with a URL built at start and never stored", async () => {
    const { manager, transfer, store } = setup();
    expect(manager.add(newMovie("1"))).toEqual({ kind: "queued", id: "p1:movie:1" });
    await flush();
    expect(transfer.started).toHaveLength(1);
    expect(transfer.started[0]).toMatchObject({
      id: "p1:movie:1",
      destination: "/data/downloads/p1_movie_1.mp4",
      title: "Movie 1",
      allowMetered: false, // Wi-Fi only by default
    });
    expect(manager.get("p1:movie:1")).toMatchObject({ status: "downloading", bytesTotal: GB });
    expect(store.get(DOWNLOADS_KEY)).not.toMatch(/http|pass/);
    expect(manager.add(newMovie("1"))).toEqual({ kind: "exists", id: "p1:movie:1" });
    expect(
      manager.add(
        newMovie("2", { target: { kind: "movie", item: movie("2", { extension: "m3u8" }) } }),
      ),
    ).toEqual({ kind: "not_downloadable" });
  });

  it("runs one download at a time; the next starts when one finishes", async () => {
    const { manager, transfer, files } = setup();
    manager.add(newMovie("1"));
    manager.add(newMovie("2"));
    await flush();
    expect(transfer.started.map((s) => s.id)).toEqual(["p1:movie:1"]);
    expect(manager.get("p1:movie:2")?.status).toBe("queued");
    transfer.emit("p1:movie:1").onProgress(GB / 2, GB);
    expect(manager.get("p1:movie:1")?.bytesDone).toBe(GB / 2);
    files.sizes.set("p1_movie_1.mp4", GB);
    transfer.emit("p1:movie:1").onDone(GB);
    await flush();
    expect(manager.get("p1:movie:1")).toMatchObject({ status: "done", bytesDone: GB });
    expect(transfer.started.map((s) => s.id)).toEqual(["p1:movie:1", "p1:movie:2"]);
    expect(manager.playableFile("p1", { kind: "movie", item: movie("1") })).toBe(
      "/data/downloads/p1_movie_1.mp4",
    );
    expect(manager.playableFile("p1", { kind: "movie", item: movie("2") })).toBeUndefined();
  });

  it("refuses to start without enough space", async () => {
    const { manager, transfer, files } = setup();
    files.free = GB;
    manager.add(newMovie("1"));
    await flush();
    expect(transfer.started).toHaveLength(0);
    expect(manager.get("p1:movie:1")).toMatchObject({ status: "failed", error: "no_space" });
  });

  it("notes a server that ignores Range (an interruption restarts it)", async () => {
    const { manager } = setup({ probe: { bytes: GB, ranges: false } });
    manager.add(newMovie("1"));
    await flush();
    expect(manager.get("p1:movie:1")?.noResume).toBe(true);
  });

  it("pause continues the same task; a failed one starts again with a new link", async () => {
    const { manager, transfer, resolved } = setup();
    manager.add(newMovie("1"));
    await flush();
    await manager.pause("p1:movie:1");
    expect(transfer.paused).toEqual(["p1:movie:1"]);
    expect(manager.get("p1:movie:1")?.status).toBe("paused");
    await manager.resume("p1:movie:1");
    expect(transfer.resumed).toEqual(["p1:movie:1"]);
    expect(manager.get("p1:movie:1")?.status).toBe("downloading");

    transfer.emit("p1:movie:1").onError("network");
    await flush();
    expect(manager.get("p1:movie:1")).toMatchObject({ status: "failed", error: "network" });
    await manager.resume("p1:movie:1");
    expect(transfer.stopped).toEqual(["p1:movie:1"]);
    expect(resolved).toEqual(["p1:movie:1", "p1:movie:1"]);
    expect(transfer.started).toHaveLength(2);
  });

  it("delete stops the task and removes the files; delete all empties the list", async () => {
    const { manager, transfer, files } = setup();
    manager.add(newMovie("1"));
    manager.add(newMovie("2"));
    await flush();
    await manager.remove("p1:movie:1");
    expect(transfer.stopped).toEqual(["p1:movie:1"]);
    expect(files.removed).toContain("p1_movie_1.mp4");
    expect(manager.get("p1:movie:1")).toBeUndefined();
    await flush();
    expect(manager.get("p1:movie:2")?.status).toBe("downloading");
    await manager.removeAll();
    expect(manager.list()).toEqual([]);
  });

  it("waits while its playlist is not loaded", async () => {
    const { manager, transfer, load } = setup({ resolveUndefined: true });
    manager.add(newMovie("1"));
    await flush();
    expect(manager.get("p1:movie:1")?.status).toBe("queued");
    load();
    await manager.pump();
    expect(transfer.started).toHaveLength(1);
  });

  it("restores after a restart: tasks reattach, lost ones queue again, missing files fail", async () => {
    const first = setup();
    first.manager.add(newMovie("1"));
    first.manager.add(newMovie("2"));
    first.manager.add(newMovie("3"));
    await flush();
    const saved = JSON.parse(first.store.get(DOWNLOADS_KEY) ?? "[]") as DownloadRecord[];
    const records = saved.map((r) =>
      r.id === "p1:movie:3" ? { ...r, status: "done" as const, bytesTotal: GB } : r,
    );

    const { store, transfer, files, manager } = setup();
    store.set(DOWNLOADS_KEY, JSON.stringify(records));
    transfer.surviving = [{ id: "p1:movie:1", state: "running", bytesDone: 100, bytesTotal: GB }];
    const restored = new DownloadManager({
      store,
      transfer,
      files,
      resolve: async () => ({ url: "http://host/x.mp4" }),
      probe: async () => ({ bytes: GB, ranges: true }),
    });
    void manager;
    await restored.restore();
    expect(restored.get("p1:movie:1")).toMatchObject({ status: "downloading", bytesDone: 100 });
    transfer.emit("p1:movie:1").onProgress(200, GB);
    expect(restored.get("p1:movie:1")?.bytesDone).toBe(200);
    expect(restored.get("p1:movie:2")?.status).toBe("queued");
    expect(restored.get("p1:movie:3")).toMatchObject({ status: "failed", error: "not_found" });
  });

  it("keeps episodes grouped by series; adult items keep their flag; Wi-Fi only can be turned off", async () => {
    const { manager, transfer } = setup();
    for (const n of [2, 1])
      manager.add({
        playlistId: "p1",
        source: "xtream",
        target: { kind: "episode", series, episode: episode(n) },
        title: `Episode ${n}`,
        seriesName: "Show",
        isAdult: n === 1,
      });
    manager.add(newMovie("1"));
    const groups = groupDownloads(manager.list());
    expect(groups.movies.map((r) => r.id)).toEqual(["p1:movie:1"]);
    expect(groups.series[0]?.name).toBe("Show");
    expect(groups.series[0]?.episodes.map((r) => r.title)).toEqual(["Episode 1", "Episode 2"]);
    expect(
      manager.get(downloadId("p1", { kind: "episode", series, episode: episode(1) }))?.isAdult,
    ).toBe(true);
    expect(manager.get("p1:episode:s1:e1")?.fileName).toBe("p1_episode_s1_e1.mkv");
    manager.setWifiOnly(false);
    expect(transfer.allowMetered).toBe(true);
    expect(manager.wifiOnly()).toBe(false);
  });

  it("M3U file URLs (they hold the account) are not stored", async () => {
    const { manager, store } = setup();
    manager.add(
      newMovie("9", {
        source: "m3u",
        target: {
          kind: "movie",
          item: movie("9", { extension: undefined, url: "http://h/movie/u/secret/9.mkv" }),
        },
      }),
    );
    expect(store.get(DOWNLOADS_KEY)).not.toMatch(/secret/);
    expect(manager.get("p1:movie:9")?.fileName).toBe("p1_movie_9.mkv");
  });

  it("saves subtitles next to a finished download and deletes them with it", async () => {
    const finished: string[] = [];
    const { manager, transfer, files } = setup({ onFinished: (r) => finished.push(r.id) });
    manager.add(newMovie("1"));
    await flush();
    files.sizes.set("p1_movie_1.mp4", GB);
    transfer.emit("p1:movie:1").onDone(GB);
    expect(finished).toEqual(["p1:movie:1"]);
    manager.saveSubtitle("p1:movie:1", "ar", "first");
    manager.saveSubtitle("p1:movie:1", "ar", "second");
    const target = { kind: "movie" as const, item: movie("1") };
    expect(manager.savedSubtitles("p1", target)).toEqual([{ lang: "ar", text: "second" }]);
    await manager.remove("p1:movie:1");
    expect(files.removed).toEqual(expect.arrayContaining(["p1_movie_1.mp4", "p1_movie_1.ar.srt"]));
  });

  it("counts storage: finished files by size, running ones by what arrived", () => {
    const record = (status: DownloadRecord["status"], bytesDone: number, bytesTotal: number) =>
      ({ status, bytesDone, bytesTotal }) as DownloadRecord;
    expect(storageUsed([record("done", GB, GB), record("downloading", 10, GB)])).toBe(GB + 10);
  });
});
