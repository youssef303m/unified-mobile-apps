import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Check, Clapperboard, Shuffle } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import type { Row } from "@/browse/rows";
import { CategoryChips } from "@/components/CategoryChips";
import { EmptyState } from "@/components/EmptyState";
import { IconButton } from "@/components/IconButton";
import { ListRow } from "@/components/ListRow";
import { PosterCard } from "@/components/PosterCard";
import { openQuickActions } from "@/components/QuickActionsSheet";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { isNewlyAdded } from "@/content/rules/content";
import { sortOptions } from "@/content/rules/live";
import { useFeed, useRowPreview } from "@/hooks/useBrowseQueries";
import { sectionErrorKey } from "@/i18n/sectionErrors";
import { SORT_LABELS } from "@/i18n/sortLabels";
import { useSession } from "@/session/store";
import { globalKeys } from "@/storage/keys";
import { kvStore } from "@/storage/kv";
import { readSettings, type SortKey } from "@/storage/settings";
import { colors, layout, spacing } from "@/theme/tokens";
import { openItem } from "@/utils/content";
import { gridCardWidth, gridColumns } from "@/utils/grid";

type Params = {
  kind: "movie" | "series";
  type: Row["type"];
  id: string;
  name: string;
  adult?: string;
};

function rowFrom(p: Params): Row {
  if (p.type === "category")
    return { type: "category", id: p.id, name: p.name, isAdult: p.adult === "1" };
  if (p.type === "custom") return { type: "custom", id: p.id, name: p.name, icon: "" };
  return { type: "virtual", id: p.id as Extract<Row, { type: "virtual" }>["id"] };
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

// A row's full list (screens.md Movies/Series "See all"): a poster grid paged from SQLite (a
// portal category fetches more pages as it scrolls), with the sort sheet for provider categories
// (R-090) and the Top Rated shuffle (R-055).
export default function CategoryScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<Params>();
  const kind = params.kind === "series" ? "series" : "movie";
  const row = useMemo(
    () => rowFrom(params),
    // The params identify the row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.type, params.id, params.name, params.adult],
  );
  const source = useSession((s) => s.active?.catalogue.source.type) ?? "xtream";
  const sortKey = kind === "movie" ? globalKeys.vodSort : globalKeys.seriesSort;
  const [sort, setSort] = useState<SortKey>(() => {
    const s = readSettings(kvStore);
    return kind === "movie" ? s.vodSort : s.seriesSort;
  });
  const [sortOpen, setSortOpen] = useState(false);
  const feed = useFeed(kind, row, sort);
  const topRated = row.type === "virtual" && row.id === "top_rated";
  const shuffle = useRowPreview(kind, row, sort, topRated);
  const { width } = useWindowDimensions();
  const columns = gridColumns(width);
  const cardWidth = gridCardWidth(width, columns);

  const chooseSort = (key: SortKey) => {
    kvStore.set(sortKey, key);
    setSort(key);
    setSortOpen(false);
  };

  return (
    <Screen
      title={params.name}
      onBack={() => router.back()}
      scroll={false}
      testID="category-screen"
      headerRight={
        topRated && shuffle.data?.canShuffle ? (
          <IconButton icon={Shuffle} label={t("refresh")} onPress={() => void feed.refetch()} />
        ) : undefined
      }
    >
      {row.type === "category" ? (
        <CategoryChips
          chips={[{ key: "sort", label: t(SORT_LABELS[sort]), dropdown: true }]}
          onPress={() => setSortOpen(true)}
        />
      ) : null}
      {feed.isPending ? (
        <ActivityIndicator style={styles.center} color={colors.brand.primary} size="large" />
      ) : feed.isError ? (
        <EmptyState
          icon={Clapperboard}
          title={t(sectionErrorKey(feed.error))}
          action={{ label: t("try_again"), onPress: () => void feed.refetch() }}
        />
      ) : feed.items.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title={t("mobile_category_empty")}
          testID="category-empty"
        />
      ) : (
        <FlashList
          data={feed.items}
          numColumns={columns}
          keyExtractor={(i) => i.item_id}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.grid}
          ListFooterComponent={
            feed.isFetchingNextPage ? <ActivityIndicator color={colors.brand.primary} /> : null
          }
          renderItem={({ item, index }) => (
            <View
              style={[styles.cell, { marginStart: index % columns === 0 ? 0 : layout.posterGap }]}
            >
              <PosterCard
                title={item.name}
                image={item.icon}
                width={cardWidth}
                badge={isNewlyAdded(item.added, nowSeconds()) ? "new" : undefined}
                onPress={() => openItem(item)}
                onLongPress={() =>
                  openQuickActions({
                    item,
                    isAdult: row.type === "category" && row.isAdult,
                    onInfo: () => openItem(item),
                  })
                }
                testID={`poster-${item.item_id}`}
              />
            </View>
          )}
        />
      )}
      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title={t("mobile_sort")}>
        {sortOptions(kind, source).map((key) => (
          <ListRow
            key={key}
            title={t(SORT_LABELS[key])}
            selected={key === sort}
            trailing={
              key === sort ? (
                <Check size={layout.iconSize} color={colors.text.primary} />
              ) : undefined
            }
            onPress={() => chooseSort(key)}
            testID={`sort-${key}`}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  grid: { paddingHorizontal: layout.gutter, paddingBottom: spacing.xxxl },
  cell: { marginBottom: spacing.lg },
});
