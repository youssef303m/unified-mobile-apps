import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { CircleAlert, CircleCheck, Clock, Download } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { artwork, colors, layout, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";
import { Artwork } from "./Artwork";
import { IconButton } from "./IconButton";
import { ProgressBar } from "./ProgressBar";

// EpisodeRow (design-system.md §5): the still (128×72) with a progress bar, "1. Title", the
// duration, a 2-line synopsis, and a download button (idle ↓, queued, downloading, done ✓,
// error !). The button appears only when the episode can be downloaded (N-03). A tap on a running
// download pauses it.
export type DownloadState = "idle" | "queued" | "downloading" | "done" | "error";

export interface EpisodeRowProps {
  number: number;
  title: string;
  duration?: string;
  synopsis?: string;
  image?: string;
  /** 0…1 */
  progress?: number;
  /** `label` says the state to screen readers (e.g. "Downloading 40%"). */
  download?: { state: DownloadState; onPress: () => void; label?: string };
  onPress: () => void;
  testID?: string;
}

export function EpisodeRow({
  number,
  title,
  duration,
  synopsis,
  image,
  progress,
  download,
  onPress,
  testID,
}: EpisodeRowProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${number}. ${title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <View style={styles.still}>
          <Artwork uri={image} style={StyleSheet.absoluteFill} />
          {progress !== undefined && progress > 0 ? (
            <ProgressBar fraction={progress} style={styles.progress} />
          ) : null}
        </View>
        <View style={styles.text}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {`${number}. ${title}`}
          </AppText>
          {duration ? (
            <AppText variant="meta" color="secondary">
              {duration}
            </AppText>
          ) : null}
        </View>
        {download ? (
          <DownloadButton
            state={download.state}
            onPress={download.onPress}
            label={download.label ?? t("mobile_download")}
            testID={testID ? `${testID}-download` : undefined}
          />
        ) : null}
      </View>
      {synopsis ? (
        <AppText variant="meta" color="secondary" numberOfLines={2}>
          {synopsis}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function DownloadButton({
  state,
  onPress,
  label,
  testID,
}: {
  state: DownloadState;
  onPress: () => void;
  label: string;
  testID?: string;
}) {
  if (state === "downloading")
    return (
      <Pressable
        style={styles.downloading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy: true }}
        onPress={onPress}
        testID={testID}
      >
        <ActivityIndicator color={colors.brand.primary} />
      </Pressable>
    );
  const icon =
    state === "done"
      ? CircleCheck
      : state === "error"
        ? CircleAlert
        : state === "queued"
          ? Clock
          : Download;
  const color =
    state === "done"
      ? colors.status.success
      : state === "error"
        ? colors.status.danger
        : colors.text.primary;
  return <IconButton icon={icon} label={label} onPress={onPress} color={color} testID={testID} />;
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, paddingHorizontal: layout.gutter, paddingVertical: spacing.sm },
  pressed: { backgroundColor: colors.surface[2] },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  still: {
    width: artwork.episodeStill.width,
    height: artwork.episodeStill.height,
    borderRadius: radius.poster,
    overflow: "hidden",
    backgroundColor: colors.surface[2],
  },
  progress: { position: "absolute", start: 0, end: 0, bottom: 0 },
  text: { flex: 1, gap: spacing.xxs },
  downloading: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
});
