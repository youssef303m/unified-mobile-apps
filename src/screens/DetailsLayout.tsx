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
import { ArrowLeft, Check, MonitorPlay, Plus, Share2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { Artwork, BACKDROP_FALLBACK } from "@/components/Artwork";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import { PressableScale } from "@/components/PressableScale";
import { ProgressBar } from "@/components/ProgressBar";
import type { DownloadAction } from "@/hooks/useDownloadAction";
import type { MovieInfo } from "@/content/types";
import { openUrl } from "@/platform/links";
import { artwork, colors, gradients, layout, radius, spacing } from "@/theme/tokens";
import { durationParts, yearOf } from "@/utils/format";

const imdbLogo = require("../../assets/images/imdb-logo.png") as number;

// The shared layout of the Movie and Series details pages (03-design/screens.md): the 16:9
// backdrop with a back button, the title (or TMDB logo), the metadata line, the Play / Resume
// button, the synopsis (3 lines + more), cast and director, then My List, Trailer and Share.
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
  const year = yearOf(info.releaseDate);
  const duration = durationParts(info.duration);
  const meta = [
    year,
    duration ? t("mobile_duration", { h: duration.h, m: duration.m }) : undefined,
    info.age,
  ].filter(Boolean);
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
      <View style={{ width, height: width / artwork.backdrop.aspect }}>
        <Artwork uri={backdrop} fallback={BACKDROP_FALLBACK} style={StyleSheet.absoluteFill} />
        <View style={styles.fade} pointerEvents="none" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          onPress={() => router.back()}
          style={[styles.back, { top: insets.top + spacing.xs }]}
          testID="details-back"
        >
          <ArrowLeft
            size={layout.iconSize}
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
        <AppText variant="h2" accessibilityRole="header" testID="details-title">
          {title}
        </AppText>
        <View style={styles.meta}>
          {meta.length ? (
            <AppText variant="meta" color="secondary">
              {meta.join(" · ")}
            </AppText>
          ) : null}
          {rating ? (
            <View style={styles.rating}>
              <AppText variant="meta" color="secondary">{`★ ${rating}`}</AppText>
              <Image
                source={imdbLogo}
                style={styles.imdb}
                contentFit="contain"
                accessibilityLabel="IMDb"
              />
            </View>
          ) : null}
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={play.label}
          onPress={play.onPress}
          style={styles.play}
          testID="details-play"
        >
          <AppText variant="bodyStrong" color="inverse">
            {`▶  ${play.label}`}
          </AppText>
        </PressableScale>
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
            <AppText variant="meta" color="secondary">
              {expanded ? t("mobile_less") : t("mobile_more")}
            </AppText>
          </Pressable>
        ) : null}
        {cast.length || info.cast ? (
          <AppText variant="meta" color="secondary">
            {`${t("cast_label")} ${cast.length ? cast.join(", ") : info.cast}`}
          </AppText>
        ) : null}
        {info.director ? (
          <AppText variant="meta" color="secondary">
            {`${t("director_label")} ${info.director}`}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <IconButton
            icon={favourite.value ? Check : Plus}
            label={favourite.value ? t("remove_favorites") : t("add_to_favorite")}
            caption={t("mobile_tab_my_list")}
            filled={false}
            onPress={favourite.onToggle}
            testID="details-favourite"
          />
          {trailer ? (
            <IconButton
              icon={MonitorPlay}
              label={t("watch_trailer")}
              caption={t("mobile_trailer")}
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
            onPress={share}
          />
        </View>
      </View>
      {children}
    </ScrollView>
  );
}

const IMDB_WIDTH = 34;
const LOGO_HEIGHT = 64;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  fade: {
    position: "absolute",
    start: 0,
    end: 0,
    bottom: 0,
    height: "50%",
    experimental_backgroundImage: gradients.fadeBottom,
  },
  back: {
    position: "absolute",
    start: spacing.sm,
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: layout.touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.elevated,
  },
  mirror: { transform: [{ scaleX: -1 }] },
  body: { paddingHorizontal: layout.gutter, gap: spacing.md, paddingTop: spacing.md },
  logo: { width: "60%", height: LOGO_HEIGHT },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.md },
  rating: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  imdb: { width: IMDB_WIDTH, height: spacing.lg },
  play: {
    height: layout.buttonHeight,
    borderRadius: radius.button,
    backgroundColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  download: { gap: spacing.xs },
  progress: { flex: 1, borderRadius: radius.chip },
  actions: { flexDirection: "row", justifyContent: "space-around", paddingVertical: spacing.sm },
});
