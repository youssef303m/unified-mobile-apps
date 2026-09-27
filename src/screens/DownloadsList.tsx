import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { CirclePause, CirclePlay, Download, RotateCw, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { Artwork } from "@/components/Artwork";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { IconButton } from "@/components/IconButton";
import { ProgressBar } from "@/components/ProgressBar";
import { showToast } from "@/components/Toast";
import {
  downloads,
  groupDownloads,
  storageUsed,
  useDownloads,
  type DownloadRecord,
} from "@/downloads";
import type { DownloadError } from "@/downloads/types";
import { useBrowse } from "@/hooks/useBrowse";
import { askPin } from "@/hooks/useParental";
import { colors, layout, radius, spacing } from "@/theme/tokens";
import { playEpisode, playMovie } from "@/utils/content";
import { formatBytes } from "@/utils/format";

const ERROR_KEYS: Record<DownloadError, `mobile_download_error_${DownloadError}`> = {
  no_space: "mobile_download_error_no_space",
  access: "mobile_download_error_access",
  not_found: "mobile_download_error_not_found",
  network: "mobile_download_error_network",
  source: "mobile_download_error_source",
  unknown: "mobile_download_error_unknown",
};

function statusLine(t: ReturnType<typeof useTranslation>["t"], r: DownloadRecord): string {
  switch (r.status) {
    case "done":
      return formatBytes(r.bytesTotal);
    case "downloading": {
      const of =
        r.bytesTotal > 0 ? ` · ${formatBytes(r.bytesDone)} / ${formatBytes(r.bytesTotal)}` : "";
      const percent = r.bytesTotal > 0 ? Math.floor((r.bytesDone / r.bytesTotal) * 100) : 0;
      return `${t("mobile_downloading_percent", { percent })}${of}`;
    }
    case "queued":
      return t("mobile_download_waiting");
    case "paused":
      return t("mobile_download_paused");
    case "failed":
      return t(ERROR_KEYS[r.error ?? "unknown"]);
  }
}

function DownloadRow({
  record,
  activePlaylist,
}: {
  record: DownloadRecord;
  activePlaylist?: string;
}) {
  const { t } = useTranslation();
  const manager = downloads();
  const otherPlaylist = record.playlistId !== activePlaylist;
  const episode = record.target.kind === "episode" ? record.target.episode : undefined;
  const title = episode
    ? `${t("mobile_episode_short", { s: episode.seasonNumber, e: episode.episodeNumber })} · ${record.title}`
    : record.title;

  // R-061: adult items ask for the PIN every time, offline too.
  const play = async () => {
    if (otherPlaylist) return showToast({ text: t("mobile_download_other_playlist") });
    if (record.isAdult && !(await askPin("category"))) return;
    const target = record.target;
    if (target.kind === "movie") playMovie(target.item, record.isAdult, "ask");
    else playEpisode(target.series, [target.episode], 0, { isAdult: record.isAdult, start: "ask" });
  };
  const confirmDelete = () =>
    Alert.alert(t("mobile_download_delete_title"), record.title, [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => void manager.remove(record.id) },
    ]);

  const fraction = record.bytesTotal > 0 ? record.bytesDone / record.bytesTotal : 0;
  return (
    <View style={styles.row} testID={`download-${record.id}`}>
      <Artwork uri={record.poster} style={styles.thumb} />
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {title}
        </AppText>
        <AppText
          variant="meta"
          color={record.status === "failed" ? "danger" : "secondary"}
          testID={`download-status-${record.id}`}
        >
          {statusLine(t, record)}
        </AppText>
        {record.status === "downloading" && record.noResume ? (
          <AppText variant="caption" color="tertiary">
            {t("mobile_download_no_resume")}
          </AppText>
        ) : null}
        {otherPlaylist ? (
          <AppText variant="caption" color="tertiary">
            {t("mobile_download_other_playlist")}
          </AppText>
        ) : null}
        {record.status === "downloading" ? (
          <ProgressBar fraction={fraction} style={styles.progress} />
        ) : null}
      </View>
      {record.status === "done" ? (
        <IconButton
          icon={CirclePlay}
          label={t("mobile_play")}
          onPress={() => void play()}
          testID={`download-play-${record.id}`}
        />
      ) : record.status === "failed" ? (
        <IconButton
          icon={RotateCw}
          label={t("mobile_download_retry")}
          onPress={() => void manager.resume(record.id)}
          testID={`download-retry-${record.id}`}
        />
      ) : record.status === "paused" ? (
        <IconButton
          icon={Download}
          label={t("mobile_download_resume")}
          onPress={() => void manager.resume(record.id)}
          testID={`download-resume-${record.id}`}
        />
      ) : (
        <IconButton
          icon={CirclePause}
          label={t("mobile_download_pause")}
          onPress={() => void manager.pause(record.id)}
          testID={`download-pause-${record.id}`}
        />
      )}
      <IconButton
        icon={Trash2}
        label={t("delete")}
        onPress={confirmDelete}
        testID={`download-delete-${record.id}`}
      />
    </View>
  );
}

// My List → Downloads (N-03, screens.md): movies, then episodes grouped by series; size or
// progress, pause / resume / retry and delete on each; the storage used and Delete all.
export function DownloadsList() {
  const { t } = useTranslation();
  const records = useDownloads();
  const ctx = useBrowse();
  const active = ctx?.catalogue.playlistId;
  if (records.length === 0)
    return (
      <EmptyState
        icon={Download}
        title={t("mobile_downloads_empty_title")}
        body={t("mobile_downloads_empty_body")}
        testID="downloads-empty"
      />
    );
  const { movies, series } = groupDownloads(records);
  const deleteAll = () =>
    Alert.alert(t("mobile_downloads_delete_all_title"), undefined, [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => void downloads().removeAll() },
    ]);
  return (
    <ScrollView contentContainerStyle={styles.list} testID="downloads-list">
      <View style={styles.header}>
        <AppText variant="meta" color="secondary" style={styles.grow} testID="downloads-storage">
          {t("mobile_downloads_storage", {
            used: formatBytes(storageUsed(records)),
            free: formatBytes(downloads().freeBytes()),
          })}
        </AppText>
        <Button
          label={t("mobile_downloads_delete_all")}
          onPress={deleteAll}
          variant="ghost"
          testID="downloads-delete-all"
        />
      </View>
      {movies.length ? (
        <View style={styles.section}>
          <AppText variant="h3">{t("movies")}</AppText>
          {movies.map((r) => (
            <DownloadRow key={r.id} record={r} activePlaylist={active} />
          ))}
        </View>
      ) : null}
      {series.map((group) => (
        <View key={group.seriesId} style={styles.section}>
          <AppText variant="h3">{group.name}</AppText>
          {group.episodes.map((r) => (
            <DownloadRow key={r.id} record={r} activePlaylist={active} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const THUMB_WIDTH = 64;

const styles = StyleSheet.create({
  list: { gap: spacing.lg, padding: layout.gutter, paddingBottom: spacing.xxxl },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
  section: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface[1],
  },
  thumb: {
    width: THUMB_WIDTH,
    height: (THUMB_WIDTH * 3) / 2,
    borderRadius: radius.poster,
    overflow: "hidden",
  },
  text: { flex: 1, gap: spacing.xxs },
  progress: { marginTop: spacing.xs, borderRadius: radius.chip },
});
