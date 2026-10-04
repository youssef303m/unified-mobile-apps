import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Database, Download, Pause, Play, RotateCw, Trash2 } from "lucide-react-native";
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
  waitingFor,
  type DownloadRecord,
} from "@/downloads";
import type { DownloadError } from "@/downloads/types";
import { useBrowse } from "@/hooks/useBrowse";
import { askPin } from "@/hooks/useParental";
import { useConnection } from "@/platform/connection";
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

type Waiting = ReturnType<typeof waitingFor>;

function statusLine(
  t: ReturnType<typeof useTranslation>["t"],
  r: DownloadRecord,
  waiting: Waiting,
): string {
  if (waiting === "wifi") return t("mobile_download_waiting_wifi");
  if (waiting === "connection") return t("mobile_download_waiting_network");
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
  waiting,
}: {
  record: DownloadRecord;
  activePlaylist?: string;
  waiting: Waiting;
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
      <Artwork uri={record.poster} style={styles.thumb} fallbackTitle={record.title} />
      <View style={styles.text}>
        <AppText variant="metaStrong" numberOfLines={2}>
          {title}
        </AppText>
        <AppText
          variant="meta"
          color={record.status === "failed" ? "danger" : "secondary"}
          style={styles.status}
          testID={`download-status-${record.id}`}
        >
          {statusLine(t, record, waiting)}
        </AppText>
        {waiting === "wifi" ? (
          <Button
            label={t("mobile_download_use_mobile_data")}
            onPress={() => void manager.allowMobileData(record.id)}
            variant="ghost"
            testID={`download-mobile-data-${record.id}`}
          />
        ) : null}
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
          icon={Play}
          filled
          variant="circle"
          ringColor={colors.brand.vivid}
          label={t("mobile_action_on_item", { action: t("mobile_play"), title })}
          onPress={() => void play()}
          testID={`download-play-${record.id}`}
        />
      ) : record.status === "failed" ? (
        <IconButton
          icon={RotateCw}
          variant="circle"
          label={t("mobile_action_on_item", { action: t("mobile_download_retry"), title })}
          onPress={() => void manager.resume(record.id)}
          testID={`download-retry-${record.id}`}
        />
      ) : record.status === "paused" ? (
        <IconButton
          icon={Download}
          variant="circle"
          label={t("mobile_action_on_item", { action: t("mobile_download_resume"), title })}
          onPress={() => void manager.resume(record.id)}
          testID={`download-resume-${record.id}`}
        />
      ) : (
        <IconButton
          icon={Pause}
          variant="circle"
          label={t("mobile_action_on_item", { action: t("mobile_download_pause"), title })}
          onPress={() => void manager.pause(record.id)}
          testID={`download-pause-${record.id}`}
        />
      )}
      <View style={styles.divider} />
      <IconButton
        icon={Trash2}
        variant="circle"
        label={t("mobile_action_on_item", { action: t("delete"), title })}
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
  const connection = useConnection();
  const wifiOnly = downloads().wifiOnly();
  const row = (r: DownloadRecord) => (
    <DownloadRow
      key={r.id}
      record={r}
      activePlaylist={active}
      waiting={waitingFor(r, wifiOnly, connection)}
    />
  );
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
  const used = storageUsed(records);
  const free = downloads().freeBytes();
  const deleteAll = () =>
    Alert.alert(t("mobile_downloads_delete_all_title"), undefined, [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => void downloads().removeAll() },
    ]);
  return (
    <ScrollView contentContainerStyle={styles.list} testID="downloads-list">
      <View style={styles.header}>
        <Database size={layout.iconSize} color={colors.text.secondary} />
        <View style={styles.grow}>
          <AppText variant="meta" numberOfLines={1} testID="downloads-storage">
            {t("mobile_downloads_storage", {
              used: formatBytes(used),
              free: formatBytes(free),
            })}
          </AppText>
          <ProgressBar fraction={used + free > 0 ? used / (used + free) : 0} style={styles.bar} />
        </View>
        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          onPress={deleteAll}
          style={styles.deleteAll}
          hitSlop={spacing.sm}
          testID="downloads-delete-all"
        >
          <Trash2 size={layout.iconSize - 4} color={colors.brand.vivid} />
          <AppText variant="metaStrong" color="vivid">
            {t("mobile_downloads_delete_all")}
          </AppText>
        </Pressable>
      </View>
      {movies.length ? (
        <View style={styles.section}>
          <AppText variant="h3">{t("movies")}</AppText>
          {movies.map((r) => row(r))}
        </View>
      ) : null}
      {series.map((group) => (
        <View key={group.seriesId} style={styles.section}>
          <AppText variant="h3">{group.name}</AppText>
          {group.episodes.map((r) => row(r))}
        </View>
      ))}
    </ScrollView>
  );
}

const THUMB_WIDTH = 64;

const styles = StyleSheet.create({
  list: { gap: spacing.lg, padding: layout.gutter, paddingBottom: spacing.xxxl },
  // Style A without the glow (owner, D-085): plain cards and smaller text on this page.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.card,
    backgroundColor: colors.card.bg,
  },
  grow: { flex: 1, gap: spacing.sm },
  bar: { borderRadius: radius.chip },
  divider: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: "stretch",
    marginVertical: spacing.xs,
    backgroundColor: colors.border.card,
  },
  deleteAll: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  section: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.card,
    backgroundColor: colors.card.bg,
  },
  status: { fontSize: 12, lineHeight: 16 },
  thumb: {
    width: THUMB_WIDTH,
    height: (THUMB_WIDTH * 3) / 2,
    borderRadius: radius.poster,
    overflow: "hidden",
  },
  text: { flex: 1, gap: spacing.xxs },
  progress: { marginTop: spacing.xs, borderRadius: radius.chip },
});
