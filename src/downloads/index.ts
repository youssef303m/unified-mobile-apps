// The app's download manager (N-03): one instance, wired to MMKV, the background downloader and
// the loaded playlist. Screens use `useDownloads` and the actions below.
import { useSyncExternalStore } from "react";
import { PermissionsAndroid, Platform } from "react-native";

import { downloadUrl } from "@/api/fixtureMode";
import type { PlayRequest } from "@/content/types";
import { itemById } from "@/db/queries/catalogue";
import { i18n } from "@/i18n";
import { lookupSubtitles } from "@/player/subtitleLookup";
import { useSession } from "@/session/store";
import { kvStore } from "@/storage/kv";

import { DownloadManager, WIFI_ONLY_KEY, type AddResult, type NewDownload } from "./manager";
import { NativeFiles, NativeTransfer, probe } from "./native";
import type { DownloadRecord, DownloadTarget } from "./types";

export type { DownloadRecord, DownloadTarget } from "./types";
export {
  asksBeforeDownload,
  groupDownloads,
  isDownloadable,
  storageUsed,
  waitingFor,
} from "./rules";

let instance: DownloadManager | undefined;

/** The PlayRequest for a record, with the M3U file URL read again from the catalogue. */
async function requestFor(record: DownloadRecord): Promise<PlayRequest | undefined> {
  const active = useSession.getState().active;
  if (!active || active.catalogue.playlistId !== record.playlistId) return undefined;
  const { source, db, playlistId } = active.catalogue;
  const target = record.target;
  if (source.type !== "m3u") return target;
  if (target.kind === "movie") {
    const item = await itemById(db, playlistId, "movie", target.item.item_id);
    return item ? { kind: "movie", item } : undefined;
  }
  const info = await source.seriesInfo(target.series);
  const episode = info?.seasons.flatMap((s) => s.episodes).find((e) => e.id === target.episode.id);
  return episode ? { kind: "episode", series: target.series, episode } : undefined;
}

export function downloads(): DownloadManager {
  if (instance) return instance;
  const t = i18n.t.bind(i18n);
  const store = kvStore;
  const wifiOnly = store.get(WIFI_ONLY_KEY) !== "off";
  instance = new DownloadManager({
    store,
    transfer: new NativeTransfer(
      {
        title: t("mobile_download"),
        starting: t("mobile_download_starting"),
        progress: t("mobile_download_progress", { progress: "{progress}" }),
        paused: t("mobile_download_paused"),
        finished: t("mobile_download_done"),
        group: t("mobile_downloads"),
      },
      !wifiOnly,
    ),
    files: new NativeFiles(),
    resolve: async (record) => {
      const request = await requestFor(record);
      if (!request) return undefined;
      const active = useSession.getState().active;
      if (!active) return undefined;
      const stream = await active.catalogue.source.streamUrl(request);
      return { url: downloadUrl(stream.url), headers: stream.headers };
    },
    probe,
    onFinished: (record) => void saveDefaultSubtitle(record),
  });
  return instance;
}

/**
 * player.md §8.2: when a download finishes, the subtitle in the app language (else English) is
 * saved next to it, so it works offline. Nothing happens when ibosub has none or is unreachable.
 */
async function saveDefaultSubtitle(record: DownloadRecord): Promise<void> {
  const active = useSession.getState().active;
  if (!active || active.catalogue.playlistId !== record.playlistId) return;
  const ctx = { db: active.catalogue.db, store: kvStore, catalogue: active.catalogue };
  const target = record.target;
  const item =
    target.kind === "movie"
      ? ({ kind: "movie", item: target.item, isAdult: record.isAdult } as const)
      : ({
          kind: "episode",
          series: target.series,
          episode: target.episode,
          isAdult: record.isAdult,
        } as const);
  try {
    const found = await lookupSubtitles(ctx, item, i18n.language);
    const language =
      found?.languages.find((l) => l.code === i18n.language) ??
      found?.languages.find((l) => l.code === "en");
    if (!found || !language) return;
    downloads().saveSubtitle(record.id, language.code, await found.load(language));
  } catch {
    // Subtitles are a bonus: the download itself is done.
  }
}

/** Reattaches running downloads at launch, and starts waiting ones whenever a playlist loads. */
export function startDownloads(): () => void {
  const manager = downloads();
  void manager.restore();
  return useSession.subscribe((state, previous) => {
    if (state.active && state.active !== previous.active) void manager.pump();
  });
}

const subscribe = (listener: () => void) => downloads().subscribe(listener);
const snapshot = () => downloads().list();

export function useDownloads(): readonly DownloadRecord[] {
  return useSyncExternalStore(subscribe, snapshot);
}

export function useDownload(playlistId: string | undefined, target: DownloadTarget | undefined) {
  const list = useDownloads();
  if (!playlistId || !target) return undefined;
  const id = downloads().recordFor(playlistId, target)?.id;
  return list.find((r) => r.id === id);
}

let askedNotifications = false;

/** Android 13+: the progress notification needs the permission, asked at the first download. */
async function askNotifications(): Promise<void> {
  if (askedNotifications || Platform.OS !== "android" || Platform.Version < 33) return;
  askedNotifications = true;
  await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(
    () => undefined,
  );
}

export async function requestDownload(
  input: NewDownload,
  options?: { mobileData?: boolean },
): Promise<AddResult> {
  await askNotifications();
  return downloads().add(input, options);
}
