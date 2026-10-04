import { StyleSheet, View } from "react-native";
import { Check, Heart, Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { artwork, colors, radius, spacing } from "@/theme/tokens";
import { maxFontSizeMultiplier } from "@/theme/typography";
import { titleAndYear } from "@/utils/format";

import { AppText } from "./AppText";
import { Artwork } from "./Artwork";
import { PressableScale } from "./PressableScale";
import { ProgressBar } from "./ProgressBar";

// PosterCard (design-system.md §5): the 2:3 image, an optional corner badge (NEW, a lock for
// parental, a downloaded tick), a progress bar and the title under it. Pressed: scale 0.96. A long
// press opens the quick actions. Style A (docs/decisions.md D-085): radius 10 with a thin outline,
// a one-line title with the year in grey under it (a trailing "(2021)" moves there), and a grey
// card with the title when there is no artwork.
export type PosterBadge = "new" | "lock" | "downloaded";

export interface PosterCardProps {
  title: string;
  image?: string;
  width?: number;
  badge?: PosterBadge;
  /** 0…1: watch progress. */
  progress?: number;
  /** A line under the title: the last watched episode of a series ("S2EP5"). */
  caption?: string;
  /** The year line when the title has none (series release date). */
  year?: string;
  favourite?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  testID?: string;
}

const ICON = 14;

export function PosterCard({
  title,
  image,
  width = artwork.poster.width,
  badge,
  progress,
  caption,
  year,
  favourite = false,
  onPress,
  onLongPress,
  testID,
}: PosterCardProps) {
  const { t } = useTranslation();
  const height = width / artwork.poster.aspect;
  const split = titleAndYear(title);
  const subline = caption ?? split.year ?? year;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[
        title,
        caption,
        progress !== undefined && progress > 0
          ? t("mobile_watched_percent", { percent: Math.round(progress * 100) })
          : undefined,
      ]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint={badge === "lock" ? t("parent_control") : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width }}
    >
      <View style={[styles.poster, { width, height }]}>
        <Artwork uri={image} style={StyleSheet.absoluteFill} fallbackTitle={split.title} />
        {badge === "new" ? (
          <View style={[styles.badge, styles.newBadge]}>
            <AppText
              variant="caption"
              color="onPrimary"
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {t("mobile_badge_new")}
            </AppText>
          </View>
        ) : null}
        {badge === "lock" ? (
          <View style={[styles.badge, styles.iconBadge]} testID="poster-lock">
            <Lock size={ICON} color={colors.text.primary} />
          </View>
        ) : null}
        {badge === "downloaded" ? (
          <View style={[styles.badge, styles.iconBadge]}>
            <Check size={ICON} color={colors.status.success} />
          </View>
        ) : null}
        {favourite ? (
          <View style={[styles.corner, styles.iconBadge]} testID="poster-favourite">
            <Heart size={ICON} color={colors.brand.light} fill={colors.brand.light} />
          </View>
        ) : null}
        {progress !== undefined && progress > 0 ? (
          <ProgressBar fraction={progress} style={styles.progress} testID="poster-progress" />
        ) : null}
      </View>
      <AppText variant="metaStrong" numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>
        {split.title}
      </AppText>
      {subline ? (
        <AppText
          variant="meta"
          color="tertiary"
          numberOfLines={1}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
        >
          {subline}
        </AppText>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  poster: {
    borderRadius: radius.poster,
    overflow: "hidden",
    backgroundColor: colors.surface[2],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    marginBottom: spacing.sm,
  },
  badge: { position: "absolute", top: spacing.sm, start: spacing.sm },
  corner: { position: "absolute", top: spacing.sm, end: spacing.sm },
  newBadge: {
    backgroundColor: colors.brand.vivid,
    borderRadius: radius.badge,
    paddingHorizontal: spacing.xs + spacing.xxs,
    paddingVertical: spacing.xxs,
  },
  iconBadge: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.chip,
    padding: spacing.xs,
  },
  progress: { position: "absolute", start: 0, end: 0, bottom: 0 },
});
