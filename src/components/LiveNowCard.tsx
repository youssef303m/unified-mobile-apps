import { StyleSheet, View } from "react-native";

import { artwork, colors, radius, spacing } from "@/theme/tokens";
import { maxFontSizeMultiplier } from "@/theme/typography";

import { AppText } from "./AppText";
import { Artwork } from "./Artwork";
import { PressableScale } from "./PressableScale";
import { ProgressBar } from "./ProgressBar";

// The Live "now" card (design-system.md §4, N-01 Live Now): the channel logo centred on surface.2
// (16:9, 200×112), the live badge, and the programme on now under it.
export interface LiveNowCardProps {
  name: string;
  logo?: string;
  programme?: string;
  /** 0-100 */
  progress?: number;
  liveLabel: string;
  onPress: () => void;
  onLongPress?: () => void;
  testID?: string;
}

const LIVE_DOT = 6;

export function LiveNowCard({
  name,
  logo,
  programme,
  progress,
  liveLabel,
  onPress,
  onLongPress,
  testID,
}: LiveNowCardProps) {
  const { width, height } = artwork.liveNowCard;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={programme ? `${name}, ${programme}` : name}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width }}
    >
      <View style={[styles.card, { width, height }]}>
        <Artwork uri={logo} style={styles.logo} contentFit="contain" />
        <View style={styles.live}>
          <View style={styles.dot} />
          <AppText variant="caption" maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {liveLabel}
          </AppText>
        </View>
        {progress !== undefined ? (
          <ProgressBar fraction={progress / 100} style={styles.progress} />
        ) : null}
      </View>
      <AppText variant="meta" numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>
        {name}
      </AppText>
      {programme ? (
        <AppText
          variant="caption"
          color="secondary"
          numberOfLines={1}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
        >
          {programme}
        </AppText>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.poster,
    backgroundColor: colors.surface[2],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  logo: { width: "50%", height: "60%", backgroundColor: "transparent" },
  live: {
    position: "absolute",
    top: spacing.sm,
    start: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dot: {
    width: LIVE_DOT,
    height: LIVE_DOT,
    borderRadius: LIVE_DOT / 2,
    backgroundColor: colors.brand.primary,
  },
  progress: { position: "absolute", start: 0, end: 0, bottom: 0 },
});
