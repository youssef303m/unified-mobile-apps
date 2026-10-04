import type { ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { CalendarDays, Check, Clock, Info, Play, Plus, Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import {
  artwork,
  colors,
  elevation,
  gradients,
  layout,
  radius,
  scrims,
  spacing,
} from "@/theme/tokens";
import { titleAndYear } from "@/utils/format";

import { AppText } from "./AppText";
import { Artwork } from "./Artwork";
import { IconButton } from "./IconButton";
import { PressableScale } from "./PressableScale";

const imdbLogo = require("../../assets/images/imdb-logo.png") as number;

// HeroBanner (design-system.md §5): full-width 2:3 artwork with both scrims, the title (or the
// TMDB logo), then ＋ My List, a white Play button and ⓘ Info. Style A (docs/decisions.md D-085):
// everything centred, the genres as pills, a details line with icons (year, duration, age,
// rating), round side buttons, a glowing Play pill, and the carousel dots under it.
export interface HeroBannerProps {
  title: string;
  image?: string;
  logo?: string;
  genres: readonly string[];
  year?: string;
  /** Already formatted ("2h 46m"). */
  duration?: string;
  age?: string;
  /** Out of 10. */
  rating?: string;
  inMyList: boolean;
  onToggleMyList: () => void;
  onPlay: () => void;
  onInfo: () => void;
  /** The carousel position. */
  page?: { index: number; count: number };
  testID?: string;
}

const MAX_GENRES = 3;
const META_ICON = 15;

export function HeroBanner({
  title,
  image,
  logo,
  genres,
  year,
  duration,
  age,
  rating,
  inMyList,
  onToggleMyList,
  onPlay,
  onInfo,
  page,
  testID,
}: HeroBannerProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const height = Math.round((width * artwork.hero.height) / artwork.hero.width);
  const split = titleAndYear(title);
  const shownYear = year ?? split.year;
  const meta: { key: string; node: ReactNode }[] = [];
  if (shownYear)
    meta.push({
      key: "year",
      node: (
        <View style={styles.metaItem}>
          <CalendarDays size={META_ICON} color={colors.text.secondary} />
          <AppText variant="meta">{shownYear}</AppText>
        </View>
      ),
    });
  if (duration)
    meta.push({
      key: "duration",
      node: (
        <View style={styles.metaItem}>
          <Clock size={META_ICON} color={colors.text.secondary} />
          <AppText variant="meta">{duration}</AppText>
        </View>
      ),
    });
  if (age)
    meta.push({
      key: "age",
      node: (
        <View style={styles.age}>
          <AppText variant="caption">{age}</AppText>
        </View>
      ),
    });
  if (rating)
    meta.push({
      key: "rating",
      node: (
        <View style={styles.metaItem}>
          <Star size={META_ICON} color={colors.text.secondary} />
          <AppText variant="meta">{rating}</AppText>
          <Image
            source={imdbLogo}
            style={styles.imdb}
            contentFit="contain"
            accessibilityLabel="IMDb"
          />
        </View>
      ),
    });
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
          <AppText variant="display" numberOfLines={2} style={[styles.center, styles.title]}>
            {split.title}
          </AppText>
        )}
        {genres.length ? (
          <View style={styles.genres}>
            {genres.slice(0, MAX_GENRES).map((g) => (
              <View key={g} style={styles.genre}>
                <AppText variant="meta" numberOfLines={1}>
                  {g}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        {meta.length ? (
          <View style={styles.meta}>
            {meta.map((m, i) => (
              <View key={m.key} style={styles.metaItem}>
                {i > 0 ? <View style={styles.separator} /> : null}
                {m.node}
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.actions}>
          <IconButton
            icon={inMyList ? Check : Plus}
            label={inMyList ? t("remove_favorites") : t("add_to_favorite")}
            caption={t("mobile_tab_my_list")}
            onPress={onToggleMyList}
            variant="overArt"
            testID="hero-my-list"
          />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t("mobile_action_on_item", { action: t("mobile_play"), title })}
            onPress={onPlay}
            style={styles.play}
            testID="hero-play"
          >
            <Play
              size={layout.iconSize - 2}
              color={colors.text.inverse}
              fill={colors.text.inverse}
            />
            <AppText variant="h3" color="inverse">
              {t("mobile_play")}
            </AppText>
          </PressableScale>
          <IconButton
            icon={Info}
            label={t("info")}
            caption={t("info")}
            onPress={onInfo}
            variant="overArt"
            testID="hero-info"
          />
        </View>
        {page && page.count > 1 ? (
          <View style={styles.dots} importantForAccessibility="no-hide-descendants">
            {Array.from({ length: page.count }, (_, i) => (
              <View key={i} style={[styles.dot, i === page.index && styles.dotOn]} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const DOT = 7;
const IMDB_WIDTH = 34;

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
    gap: spacing.md,
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.sm,
  },
  logo: { width: "70%", height: layout.touchTarget * 2, backgroundColor: "transparent" },
  center: { textAlign: "center" },
  title: { textShadowColor: colors.shadow, textShadowRadius: 12 },
  genres: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", justifyContent: "center" },
  genre: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.border.control,
    backgroundColor: colors.card.controlOverArt,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    rowGap: spacing.xs,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  separator: {
    width: StyleSheet.hairlineWidth * 2,
    height: spacing.md,
    marginHorizontal: spacing.sm,
    backgroundColor: colors.border.control,
  },
  age: {
    borderWidth: 1,
    borderColor: colors.text.tertiary,
    borderRadius: radius.badge + 2,
    paddingHorizontal: spacing.xs + spacing.xxs,
    paddingVertical: 1,
  },
  imdb: { width: IMDB_WIDTH, height: spacing.lg },
  actions: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: spacing.xxl,
    alignSelf: "stretch",
  },
  play: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: layout.touchTarget,
    paddingHorizontal: spacing.giant,
    borderRadius: radius.button,
    backgroundColor: colors.text.primary,
    ...elevation.glow,
  },
  dots: { flexDirection: "row", gap: spacing.sm, paddingTop: spacing.xs },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.border.control },
  dotOn: { width: DOT * 2.5, backgroundColor: colors.brand.vivid },
});
