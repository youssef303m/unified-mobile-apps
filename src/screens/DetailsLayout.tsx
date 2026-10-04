import { useState, type ReactNode } from "react";
import {
  I18nManager,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  MonitorPlay,
  Play,
  Plus,
  Share2,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { Artwork, BACKDROP_FALLBACK } from "@/components/Artwork";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import { ProgressBar } from "@/components/ProgressBar";
import type { DownloadAction } from "@/hooks/useDownloadAction";
import type { MovieInfo } from "@/content/types";
import { openUrl } from "@/platform/links";
import { colors, gradients, layout, radius, spacing } from "@/theme/tokens";
import { durationParts, titleAndYear, yearOf } from "@/utils/format";

const imdbLogo = require("../../assets/images/imdb-logo.png") as number;

// The shared layout of the Movie and Series details pages (03-design/screens.md): the 16:9
// backdrop with a back button, the title (or TMDB logo), the metadata line, the Play / Resume
// button, the synopsis (3 lines + more), cast and director, then My List, Trailer and Share.
// Style A (docs/decisions.md D-085): a taller backdrop with the title over its fade, a details line
// with separators and an age pill, a full-width glowing Play pill, a red "More", round actions.
export interface DetailsLayoutProps {
  title: string;
  info: MovieInfo;
  backdrop?: string;
  logo?: string;
  cast: string[];
  play: { label: string; onPress: () => void; progress?: number; caption?: string };
  favourite: { value: boolean; onToggle: () => void };
  /** N-03: the Download button under Play, hidden when the item cannot be downloaded. */
  download?: DownloadAction;
  children?: ReactNode;
  testID?: string;
}

const SYNOPSIS_LINES = 3;

export function DetailsLayout({
  title,
  info,
  backdrop,
  logo,
  cast,
  play,
  favourite,
  download,
  children,
  testID,
}: DetailsLayoutProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const split = titleAndYear(title);
  const year = yearOf(info.releaseDate) ?? split.year;
  const duration = durationParts(info.duration);
  const meta = [
    year,
    duration ? t("mobile_duration", { h: duration.h, m: duration.m }) : undefined,
  ].filter((m): m is string => Boolean(m));
  const rating =
    info.rating && Number(info.rating) > 0 ? Number(info.rating).toFixed(1) : undefined;
  const trailer = info.youtubeTrailer;
  // N-08: the title and year only, never a stream URL or credentials.
  const share = () => void Share.share({ message: year ? `${title} (${year})` : title });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
      testID={testID}
    >
      <View style={{ width, height: width * BACKDROP_RATIO }}>
        <Artwork uri={backdrop} fallback={BACKDROP_FALLBACK} style={StyleSheet.absoluteFill} />
        <View style={styles.fadeTop} pointerEvents="none" />
        <View style={styles.fade} pointerEvents="none" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          onPress={() => router.back()}
          style={[styles.back, { top: insets.top + spacing.sm }]}
          testID="details-back"
        >
          <ArrowLeft
            size={layout.iconSize - 2}
            color={colors.text.primary}
            style={I18nManager.isRTL ? styles.mirror : undefined}
          />
        </Pressable>
      </View>
      <View style={styles.body}>
        {logo ? (
          <Image
            source={{ uri: logo }}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel={title}
          />
        ) : null}
        <AppText
          variant="display"
          accessibilityRole="header"
          style={styles.title}
          testID="details-title"
        >
          {split.title}
        </AppText>
        <View style={styles.meta}>
          {meta.map((m, i) => (
            <View key={m} style={styles.metaItem}>
              {i > 0 ? <View style={styles.separator} /> : null}
              <AppText variant="meta">{m}</AppText>
            </View>
          ))}
          {info.age ? (
            <View style={styles.metaItem}>
              {meta.length ? <View style={styles.separator} /> : null}
              <View style={styles.age}>
                <AppText variant="caption">{info.age}</AppText>
              </View>
            </View>
          ) : null}
          {rating ? (
            <View style={styles.rating}>
              {meta.length || info.age ? <View style={styles.separator} /> : null}
              <AppText variant="meta">{`★ ${rating}`}</AppText>
              <Image
                source={imdbLogo}
                style={styles.imdb}
                contentFit="contain"
                accessibilityLabel="IMDb"
              />
            </View>
          ) : null}
        </View>
        <Button
          label={play.label}
          onPress={play.onPress}
          icon={Play}
          fillIcon
          glow
          testID="details-play"
        />
        {play.progress !== undefined ? (
          <View style={styles.progressRow}>
            <ProgressBar fraction={play.progress} style={styles.progress} />
            {play.caption ? (
              <AppText variant="caption" color="secondary">
                {play.caption}
              </AppText>
            ) : null}
          </View>
        ) : null}
        {download ? (
          <View style={styles.download}>
            <Button
              label={download.label}
              onPress={download.onPress}
              variant="secondary"
              icon={Download}
              testID="details-download"
            />
            {download.state === "downloading" && download.fraction !== undefined ? (
              <ProgressBar fraction={download.fraction} style={styles.progress} />
            ) : null}
          </View>
        ) : null}
        {info.description ? (
          <Pressable
            onPress={() => setExpanded((e) => !e)}
            accessibilityRole="button"
            accessibilityHint={expanded ? t("mobile_less") : t("mobile_more")}
          >
            <AppText numberOfLines={expanded ? undefined : SYNOPSIS_LINES}>
              {info.description}
            </AppText>
            <View style={styles.more}>
              <AppText variant="metaStrong" color="vivid">
                {expanded ? t("mobile_less") : t("mobile_more")}
              </AppText>
              {expanded ? (
                <ChevronUp size={spacing.lg} color={colors.brand.vivid} />
              ) : (
                <ChevronDown size={spacing.lg} color={colors.brand.vivid} />
              )}
            </View>
          </Pressable>
        ) : null}
        {cast.length || info.cast ? (
          <AppText variant="meta" color="secondary">
            <AppText variant="metaStrong">{t("cast_label")}</AppText>
            {` ${cast.length ? cast.join(", ") : info.cast}`}
          </AppText>
        ) : null}
        {info.director ? (
          <AppText variant="meta" color="secondary">
            <AppText variant="metaStrong">{t("director_label")}</AppText>
            {` ${info.director}`}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <IconButton
            icon={favourite.value ? Check : Plus}
            label={favourite.value ? t("remove_favorites") : t("add_to_favorite")}
            caption={t("mobile_tab_my_list")}
            filled={false}
            variant="circle"
            onPress={favourite.onToggle}
            testID="details-favourite"
          />
          {trailer ? (
            <IconButton
              icon={MonitorPlay}
              label={t("watch_trailer")}
              caption={t("mobile_trailer")}
              variant="circle"
              onPress={() =>
                openUrl(`https://www.youtube.com/watch?v=${encodeURIComponent(trailer)}`)
              }
              testID="details-trailer"
            />
          ) : null}
          <IconButton
            icon={Share2}
            label={t("mobile_share")}
            caption={t("mobile_share")}
            variant="circle"
            onPress={share}
          />
        </View>
      </View>
      {children}
    </ScrollView>
  );
}

const IMDB_WIDTH = 34;
/** Taller than 16:9 so the title sits over the artwork's fade. */
const BACKDROP_RATIO = 0.8;
const LOGO_HEIGHT = 64;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  fadeTop: {
    position: "absolute",
    start: 0,
    end: 0,
    top: 0,
    height: "30%",
    experimental_backgroundImage: gradients.scrimTop,
  },
  fade: {
    position: "absolute",
    start: 0,
    end: 0,
    bottom: 0,
    height: "60%",
    experimental_backgroundImage: gradients.scrimBottom,
  },
  back: {
    position: "absolute",
    start: layout.gutter,
    width: layout.circleButton,
    height: layout.circleButton,
    borderRadius: layout.circleButton / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.border.control,
    backgroundColor: colors.card.controlOverArt,
  },
  mirror: { transform: [{ scaleX: -1 }] },
  body: { paddingHorizontal: layout.gutter, gap: spacing.md, marginTop: -spacing.huge },
  title: { fontSize: 28, lineHeight: 34 },
  metaItem: { flexDirection: "row", alignItems: "center" },
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
  more: { flexDirection: "row", alignItems: "center", gap: spacing.xxs, marginTop: spacing.xs },
  logo: { width: "60%", height: LOGO_HEIGHT },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", rowGap: spacing.xs },
  rating: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  imdb: { width: IMDB_WIDTH, height: spacing.lg },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  download: { gap: spacing.xs },
  progress: { flex: 1, borderRadius: radius.chip },
  actions: { flexDirection: "row", justifyContent: "space-around", paddingVertical: spacing.sm },
});
