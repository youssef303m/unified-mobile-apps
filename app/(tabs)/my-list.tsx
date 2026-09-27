import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, History } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import {
  continueWatching,
  favouriteItems,
  removeFromContinueWatching,
  type ContinueEntry,
} from "@/browse/library";
import { CategoryChips } from "@/components/CategoryChips";
import { ContentRow } from "@/components/ContentRow";
import { ContinueCard } from "@/components/ContinueCard";
import { EmptyState } from "@/components/EmptyState";
import { LiveNowCard } from "@/components/LiveNowCard";
import { PosterCard } from "@/components/PosterCard";
import { openQuickActions } from "@/components/QuickActionsSheet";
import { TopBar } from "@/components/TopBar";
import type { CatalogueItem } from "@/content/types";
import { browseKey, need, refreshBrowse } from "@/hooks/queryClient";
import { browseContext, useBrowse } from "@/hooks/useBrowse";
import { useTabBack } from "@/hooks/useTabBack";
import { DownloadsList } from "@/screens/DownloadsList";
import { artwork, colors, layout, spacing } from "@/theme/tokens";
import { openItem } from "@/utils/content";

type Segment = "favourites" | "continue" | "downloads";

const posterSize = { width: artwork.poster.width, height: artwork.poster.height };
const liveSize = { width: artwork.liveNowCard.width, height: artwork.liveNowCard.height };
const continueSize = { width: artwork.continueCard.width, height: artwork.continueCard.height };

function useMyList() {
  const ctx = useBrowse();
  const pid = ctx?.catalogue.playlistId ?? "none";
  return useQuery({
    queryKey: [...browseKey(pid), "my-list"],
    enabled: ctx !== undefined,
    queryFn: async () => {
      const c = need(ctx);
      return {
        live: await favouriteItems(c, "live"),
        movie: await favouriteItems(c, "movie"),
        series: await favouriteItems(c, "series"),
        continueMovies: await continueWatching(c, "movie"),
        continueSeries: await continueWatching(c, "series"),
      };
    },
  });
}

const seeAll = (kind: "movie" | "series", id: "favourite" | "recent", name: string) => () =>
  router.push({ pathname: "/category", params: { kind, type: "virtual", id, name } });

function Poster({ item }: { item: CatalogueItem }) {
  return (
    <PosterCard
      title={item.name}
      image={item.icon}
      favourite
      onPress={() => openItem(item)}
      onLongPress={() => openQuickActions({ item, isAdult: false, onInfo: () => openItem(item) })}
      testID={`my-list-${item.item_id}`}
    />
  );
}

function ContinueRow({
  title,
  kind,
  entries,
}: {
  title: string;
  kind: "movie" | "series";
  entries: ContinueEntry[];
}) {
  const { t } = useTranslation();
  return (
    <ContentRow
      title={title}
      data={entries}
      keyExtractor={(e) => e.item.item_id}
      itemSize={continueSize}
      renderItem={(e) => {
        const remove = () => {
          const ctx = browseContext();
          if (!ctx) return;
          removeFromContinueWatching(ctx, kind, e.item.item_id);
          refreshBrowse(ctx.catalogue.playlistId);
        };
        return (
          <ContinueCard
            title={e.item.name}
            image={e.item.icon}
            fraction={e.fraction}
            caption={
              e.episode
                ? t("mobile_episode_short", { s: e.episode.season, e: e.episode.episode })
                : undefined
            }
            onPress={() => openItem(e.item)}
            onMenu={() =>
              openQuickActions({
                item: e.item,
                isAdult: false,
                onInfo: () => openItem(e.item),
                onRemoveFromRow: remove,
              })
            }
          />
        );
      }}
    />
  );
}

// My List (N-02, screens.md): Favourites (channels, movies and series: the same favourites as the
// Live, Movies and Series pages), Continue Watching, and Downloads (N-03).
export default function MyListScreen() {
  const { t } = useTranslation();
  useTabBack(false);
  const params = useLocalSearchParams<{ segment?: Segment }>();
  const [chosen, setSegment] = useState<Segment | undefined>();
  // A link (the download notification flow, e2e) can open a segment; a tap wins.
  const segment = chosen ?? params.segment ?? "favourites";
  const data = useMyList().data;

  let body;
  if (segment === "downloads") body = <DownloadsList />;
  else if (segment === "continue") {
    const none = data && data.continueMovies.length + data.continueSeries.length === 0;
    body = none ? (
      <EmptyState icon={History} title={t("mobile_continue_empty")} testID="continue-empty" />
    ) : (
      <ScrollView contentContainerStyle={styles.rows}>
        <ContinueRow title={t("movies")} kind="movie" entries={data?.continueMovies ?? []} />
        <ContinueRow title={t("series")} kind="series" entries={data?.continueSeries ?? []} />
      </ScrollView>
    );
  } else {
    const none = data && data.live.length + data.movie.length + data.series.length === 0;
    body = none ? (
      <EmptyState
        icon={Bookmark}
        title={t("mobile_favourites_empty_title")}
        body={t("mobile_favourites_empty_body")}
        testID="favourites-empty"
      />
    ) : (
      <ScrollView contentContainerStyle={styles.rows}>
        <ContentRow
          title={t("favorites-channels")}
          data={data?.live ?? []}
          keyExtractor={(i) => i.item_id}
          itemSize={liveSize}
          onSeeAll={() => router.navigate({ pathname: "/live", params: { category: "favourite" } })}
          testID="my-list-channels"
          renderItem={(item) => (
            <LiveNowCard
              name={item.name}
              logo={item.icon}
              liveLabel={t("live")}
              onPress={() => openItem(item)}
              onLongPress={() => openQuickActions({ item, isAdult: false })}
            />
          )}
        />
        <ContentRow
          title={t("movies")}
          data={data?.movie ?? []}
          keyExtractor={(i) => i.item_id}
          itemSize={posterSize}
          onSeeAll={seeAll("movie", "favourite", t("favorites"))}
          testID="my-list-movies"
          renderItem={(item) => <Poster item={item} />}
        />
        <ContentRow
          title={t("series")}
          data={data?.series ?? []}
          keyExtractor={(i) => i.item_id}
          itemSize={posterSize}
          onSeeAll={seeAll("series", "favourite", t("favorites"))}
          testID="my-list-series"
          renderItem={(item) => <Poster item={item} />}
        />
      </ScrollView>
    );
  }

  return (
    <View style={styles.root} testID="my-list-screen">
      <TopBar
        title={t("mobile_tab_my_list")}
        onSearch={() => router.push("/search")}
        onAccount={() => router.push("/account")}
      />
      <CategoryChips
        chips={[
          { key: "favourites", label: t("favorites"), selected: segment === "favourites" },
          { key: "continue", label: t("continue_watching"), selected: segment === "continue" },
          {
            key: "downloads",
            label: t("mobile_downloads"),
            selected: segment === "downloads",
            testID: "my-list-downloads",
          },
        ]}
        onPress={(key) => setSegment(key as Segment)}
      />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  rows: { gap: layout.rowGap, paddingVertical: spacing.md },
});
