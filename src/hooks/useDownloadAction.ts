// The download button of a movie page or an episode row (N-03): its state and what a tap does.
// Hidden (undefined) when the item cannot be downloaded. With Wi-Fi only on and the phone on mobile
// data, a tap asks first and a waiting download says so (docs/decisions.md D-083).
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";

import { showToast } from "@/components/Toast";
import {
  asksBeforeDownload,
  downloads,
  isDownloadable,
  requestDownload,
  useDownload,
  waitingFor,
  type DownloadRecord,
  type DownloadTarget,
} from "@/downloads";
import { useConnection } from "@/platform/connection";

import { useBrowse } from "./useBrowse";

export type DownloadUiState = "idle" | DownloadRecord["status"];

export interface DownloadAction {
  state: DownloadUiState;
  /** 0…1 while downloading, when the size is known. */
  fraction?: number;
  /** A running or queued download that cannot move: Wi-Fi only on mobile data, or offline. */
  waiting?: "wifi" | "connection";
  label: string;
  onPress: () => void;
}

export interface DownloadMeta {
  title: string;
  seriesName?: string;
  poster?: string;
  isAdult: boolean;
}

export function useDownloadAction(
  target: DownloadTarget | undefined,
  meta: DownloadMeta,
): DownloadAction | undefined {
  const { t } = useTranslation();
  const ctx = useBrowse();
  const record = useDownload(ctx?.catalogue.playlistId, target);
  const connection = useConnection();
  if (!ctx || !target || !isDownloadable(ctx.catalogue.source.type, target)) return undefined;
  const wifiOnly = downloads().wifiOnly();
  const state: DownloadUiState = record?.status ?? "idle";
  const fraction =
    record && record.bytesTotal > 0 ? Math.min(1, record.bytesDone / record.bytesTotal) : undefined;
  const waiting = record ? waitingFor(record, wifiOnly, connection) : undefined;

  const add = async (mobileData: boolean) => {
    const result = await requestDownload(
      { playlistId: ctx.catalogue.playlistId, source: ctx.catalogue.source.type, target, ...meta },
      { mobileData },
    );
    if (result.kind === "queued") showToast({ text: t("mobile_download_queued") });
  };
  const start = () => {
    if (!asksBeforeDownload(wifiOnly, connection)) return void add(false);
    Alert.alert(
      t("mobile_download_metered_title"),
      t("mobile_download_metered_body"),
      [
        { text: t("mobile_download_wait_wifi"), onPress: () => void add(false) },
        { text: t("mobile_download_use_mobile_data"), onPress: () => void add(true) },
      ],
      { cancelable: true },
    );
  };
  const askWaiting = (id: string) =>
    Alert.alert(
      t("mobile_download_waiting_wifi"),
      t("mobile_download_waiting_wifi_body"),
      [
        { text: t("mobile_download_pause"), onPress: () => void downloads().pause(id) },
        {
          text: t("mobile_download_use_mobile_data"),
          onPress: () => void downloads().allowMobileData(id),
        },
      ],
      { cancelable: true },
    );
  const confirmDelete = (id: string) =>
    Alert.alert(t("mobile_download_delete_title"), meta.title, [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () => void downloads().remove(id),
      },
    ]);

  const onPress = () => {
    if (!record) return start();
    if (waiting === "wifi") return askWaiting(record.id);
    if (record.status === "downloading" || record.status === "queued")
      return void downloads().pause(record.id);
    if (record.status === "paused" || record.status === "failed")
      return void downloads().resume(record.id);
    confirmDelete(record.id);
  };

  const label =
    waiting === "wifi"
      ? t("mobile_download_waiting_wifi")
      : waiting === "connection"
        ? t("mobile_download_waiting_network")
        : state === "idle"
          ? t("mobile_download")
          : state === "queued"
            ? t("mobile_download_waiting")
            : state === "downloading"
              ? fraction !== undefined
                ? t("mobile_downloading_percent", { percent: Math.floor(fraction * 100) })
                : t("mobile_download_starting")
              : state === "paused"
                ? t("mobile_download_paused")
                : state === "failed"
                  ? t("mobile_download_failed")
                  : t("mobile_downloaded");
  return { state, fraction, waiting, label, onPress };
}
