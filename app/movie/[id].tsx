import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Film } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ContentRow } from "@/components/ContentRow";
import { EmptyState } from "@/components/EmptyState";
import { PosterCard } from "@/components/PosterCard";
import type { CatalogueItem } from "@/content/types";
import { useRowPreview } from "@/hooks/useBrowseQueries";
import { useArtwork, useMovieDetails } from "@/hooks/useDetails";
import { useDownloadAction } from "@/hooks/useDownloadAction";
import { useIsFavourite, useToggleFavourite } from "@/hooks/useFavourite";
import { DetailsLayout } from "@/screens/DetailsLayout";
import { artwork, colors, spacing } from "@/theme/tokens";
import { openItem, playMovie } from "@/utils/content";
import { formatClock } from "@/utils/format";

function MoreLikeThis({ item, isAdult }: { item: CatalogueItem; isAdult: boolean }) {
  const { t } = useTranslation();
  const row = { type: "category", id: item.category_id, name: "", isAdult } as const;
  // Adult categories stay out of suggestions (N-01's spirit; the page itself was behind the PIN).
  const preview = useRowPreview("movie", row, "default", !isAdult);
  const items = (preview.data?.items ?? []).filter((i) => i.item_id !== item.item_id);
  return (
    <ContentRow
      title={t("mobile_more_like_this")}
      data={items}
      loading={!isAdult && preview.isPending}
      keyExtractor={(i) => i.item_id}
      itemSize={{ width: artwork.poster.width, height: artwork.poster.height }}
      testID="more-like-this"
      renderItem={(i) => <PosterCard title={i.name} image={i.icon} onPress={() => openItem(i)} />}
    />
  );
}

// Movie details (03-design/screens.md, user-flows.md §7 Mobile): the list fields at once, the
// provider info when it arrives (R-057), TMDB artwork and cast when TMDB is on (R-122), and
// Resume with the saved position (R-075), and Download (N-03).
export default function MovieDetailsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item, info, resume } = useMovieDetails("movie", id);
  const found = item.data?.item;
  const art = useArtwork("movie", info.data?.tmdbId);
  const favourite = useIsFavourite(found);
  const toggle = useToggleFavourite();
  const download = useDownloadAction(found ? { kind: "movie", item: found } : undefined, {
    title: found?.name ?? "",
    poster: found?.icon,
    isAdult: item.data?.isAdult ?? false,
  });

  if (item.isPending)
    return <ActivityIndicator style={styles.center} color={colors.brand.primary} size="large" />;
  if (!found)
    return (
      <View style={styles.center}>
        <EmptyState
          icon={Film}
          title={t("mobile_item_not_found")}
          action={{ label: t("back"), onPress: () => router.back() }}
        />
      </View>
    );
  const isAdult = item.data?.isAdult ?? false;
  const details = info.data ?? { name: found.name };
  return (
    <DetailsLayout
      testID="movie-details"
      title={found.name}
      info={details}
      backdrop={art.data?.backdrop || details.backdrop || found.icon}
      logo={art.data?.logo}
      cast={art.data?.cast.map((c) => c.name) ?? []}
      play={
        resume
          ? {
              label: t("mobile_resume_at", { time: formatClock(resume.position) }),
              // Resume starts at the saved position (the button already says where).
              onPress: () => playMovie(found, isAdult, resume.position),
              progress: resume.percent / 100,
              caption: t("mobile_watched_percent", { percent: resume.percent }),
            }
          : { label: t("mobile_play"), onPress: () => playMovie(found, isAdult, 0) }
      }
      favourite={{ value: favourite, onToggle: () => toggle(found, isAdult) }}
      download={download}
    >
      {info.isPending ? (
        <ActivityIndicator style={styles.loading} color={colors.brand.primary} />
      ) : null}
      <View style={styles.more}>
        <MoreLikeThis item={found} isAdult={isAdult} />
      </View>
    </DetailsLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg.base, justifyContent: "center" },
  loading: { marginTop: spacing.lg },
  more: { marginTop: spacing.xxl },
});
