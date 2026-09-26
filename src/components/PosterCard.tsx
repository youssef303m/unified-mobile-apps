import { StyleSheet, View } from "react-native";
import { Check, Heart, Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { artwork, colors, radius, spacing } from "@/theme/tokens";
import { maxFontSizeMultiplier } from "@/theme/typography";

import { AppText } from "./AppText";
import { Artwork } from "./Artwork";
import { PressableScale } from "./PressableScale";
import { ProgressBar } from "./ProgressBar";

// PosterCard (design-system.md §5): the 2:3 image, radius 6, an optional corner badge (NEW, a
// lock for parental, a downloaded tick), a progress bar and the title under it. Pressed: scale
// 0.96. A long press opens the quick actions.
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
  favourite = false,
  onPress,
  onLongPress,
  testID,
}: PosterCardProps) {
  const { t } = useTranslation();
  const height = width / artwork.poster.aspect;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={badge === "lock" ? t("parent_control") : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width }}
    >
      <View style={[styles.poster, { width, height }]}>
        <Artwork uri={image} style={StyleSheet.absoluteFill} />
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
      <AppText variant="meta" numberOfLines={2} maxFontSizeMultiplier={maxFontSizeMultiplier}>
        {title}
      </AppText>
      {caption ? (
        <AppText variant="caption" color="secondary" maxFontSizeMultiplier={maxFontSizeMultiplier}>
          {caption}
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
    marginBottom: spacing.xs,
  },
  badge: { position: "absolute", top: spacing.xs, start: spacing.xs },
  corner: { position: "absolute", top: spacing.xs, end: spacing.xs },
  newBadge: {
    backgroundColor: colors.brand.accent,
    borderRadius: radius.button / 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  iconBadge: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.chip,
    padding: spacing.xs,
  },
  progress: { position: "absolute", start: 0, end: 0, bottom: 0 },
});
