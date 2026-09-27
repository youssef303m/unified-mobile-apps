// The download button of a movie page or an episode row (N-03): its state and what a tap does.
// Hidden (undefined) when the item cannot be downloaded.
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";

import { showToast } from "@/components/Toast";
import {
  downloads,
  isDownloadable,
  requestDownload,
  useDownload,
  type DownloadRecord,
  type DownloadTarget,
} from "@/downloads";

import { useBrowse } from "./useBrowse";

export type DownloadUiState = "idle" | DownloadRecord["status"];

export interface DownloadAction {
  state: DownloadUiState;
  /** 0…1 while downloading, when the size is known. */
  fraction?: number;
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
  if (!ctx || !target || !isDownloadable(ctx.catalogue.source.type, target)) return undefined;
  const state: DownloadUiState = record?.status ?? "idle";
  const fraction =
    record && record.bytesTotal > 0 ? Math.min(1, record.bytesDone / record.bytesTotal) : undefined;

  const start = async () => {
    const result = await requestDownload({
      playlistId: ctx.catalogue.playlistId,
      source: ctx.catalogue.source.type,
      target,
      ...meta,
    });
    if (result.kind === "queued") showToast({ text: t("mobile_download_queued") });
  };
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
    if (!record) return void start();
    if (record.status === "downloading" || record.status === "queued")
      return void downloads().pause(record.id);
    if (record.status === "paused" || record.status === "failed")
      return void downloads().resume(record.id);
    confirmDelete(record.id);
  };

  const label =
    state === "idle"
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
  return { state, fraction, label, onPress };
}
