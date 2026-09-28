import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Check, Info, Play, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { artwork, colors, gradients, layout, radius, scrims, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";
import { Artwork } from "./Artwork";
import { IconButton } from "./IconButton";
import { PressableScale } from "./PressableScale";

// HeroBanner (design-system.md §5): full-width 2:3 artwork with both scrims, the title (or the
// TMDB logo), a genre line, then ＋ My List, a white Play button and ⓘ Info.
export interface HeroBannerProps {
  title: string;
  image?: string;
  logo?: string;
  genres: readonly string[];
  inMyList: boolean;
  onToggleMyList: () => void;
  onPlay: () => void;
  onInfo: () => void;
  testID?: string;
}

export function HeroBanner({
  title,
  image,
  logo,
  genres,
  inMyList,
  onToggleMyList,
  onPlay,
  onInfo,
  testID,
}: HeroBannerProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const height = Math.round((width * artwork.hero.height) / artwork.hero.width);
  return (
    <View style={{ width, height }} testID={testID}>
      <Artwork uri={image} style={StyleSheet.absoluteFill} />
      <View style={[styles.scrimTop]} pointerEvents="none" />
      <View
        style={[styles.scrimBottom, { height: height * scrims.bottom.heightRatio }]}
        pointerEvents="none"
      />
      <View style={styles.content}>
        {logo ? (
          <Artwork uri={logo} style={styles.logo} contentFit="contain" />
        ) : (
          <AppText variant="display" numberOfLines={2} style={styles.center}>
            {title}
          </AppText>
        )}
        {genres.length ? (
          <AppText variant="meta" color="secondary" numberOfLines={1} style={styles.center}>
            {genres.join(" • ")}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <IconButton
            icon={inMyList ? Check : Plus}
            label={inMyList ? t("remove_favorites") : t("add_to_favorite")}
            caption={t("mobile_tab_my_list")}
            onPress={onToggleMyList}
            testID="hero-my-list"
          />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t("mobile_action_on_item", { action: t("mobile_play"), title })}
            onPress={onPlay}
            style={styles.play}
            testID="hero-play"
          >
            <Play size={layout.iconSize} color={colors.text.inverse} fill={colors.text.inverse} />
            <AppText variant="bodyStrong" color="inverse">
              {t("mobile_play")}
            </AppText>
          </PressableScale>
          <IconButton
            icon={Info}
            label={t("info")}
            caption={t("info")}
            onPress={onInfo}
            testID="hero-info"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrimTop: {
    position: "absolute",
    top: 0,
    start: 0,
    end: 0,
    height: layout.touchTarget * 3,
    experimental_backgroundImage: gradients.scrimTop,
  },
  scrimBottom: {
    position: "absolute",
    bottom: 0,
    start: 0,
    end: 0,
    experimental_backgroundImage: gradients.scrimBottom,
  },
  content: {
    position: "absolute",
    bottom: 0,
    start: 0,
    end: 0,
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.lg,
  },
  logo: { width: "70%", height: layout.touchTarget * 2, backgroundColor: "transparent" },
  center: { textAlign: "center" },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    alignSelf: "stretch",
  },
  play: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: layout.buttonHeight,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.button,
    backgroundColor: colors.text.primary,
  },
});
