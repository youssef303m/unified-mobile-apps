import { useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Check, Film, Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import type { Row } from "@/browse/rows";
import { CategoryChips } from "@/components/CategoryChips";
import { ContentRow } from "@/components/ContentRow";
import { EmptyState } from "@/components/EmptyState";
import { ListRow } from "@/components/ListRow";
import { PosterCard } from "@/components/PosterCard";
import { openQuickActions } from "@/components/QuickActionsSheet";
import { SectionLoader } from "@/components/SectionLoader";
import { ListSheet, Sheet } from "@/components/Sheet";
import { TopBar } from "@/components/TopBar";
import { isNewlyAdded } from "@/content/rules/content";
import { sortOptions } from "@/content/rules/live";
import type { CatalogueItem } from "@/content/types";
import { useRowPreview, useTabRows } from "@/hooks/useBrowseQueries";
import { parentalControl } from "@/hooks/useParental";
import { cancelSection, loadSection, refreshCatalogue, useSection } from "@/hooks/useSection";
import { useTabBack } from "@/hooks/useTabBack";
import { rowTitle } from "@/i18n/rowTitles";
import { sectionErrorKey } from "@/i18n/sectionErrors";
import { SORT_LABELS } from "@/i18n/sortLabels";
import { useSession } from "@/session/store";
import { globalKeys } from "@/storage/keys";
import { kvStore } from "@/storage/kv";
import { readSettings, type SortKey } from "@/storage/settings";
import { artwork, colors, layout, spacing } from "@/theme/tokens";
import { openItem } from "@/utils/content";
import { isAdultRow, openRow } from "@/utils/rows";

const posterSize = { width: artwork.poster.width, height: artwork.poster.height };
const nowSeconds = () => Math.floor(Date.now() / 1000);

function PreviewRow({ kind, row, sort }: { kind: "movie" | "series"; row: Row; sort: SortKey }) {
  const { t } = useTranslation();
  const locked = isAdultRow(row) && parentalControl().enabled;
  const preview = useRowPreview(kind, row, sort, !locked);
  const title = rowTitle(t, kind, row);
  const items = preview.data?.items ?? [];
  return (
    <ContentRow
      title={title}
      data={items}
      loading={!locked && preview.isPending}
      locked={locked}
      keyExtractor={(i) => i.item_id}
      itemSize={posterSize}
      onSeeAll={() => void openRow(kind, row, title)}
      testID={`row-${row.id}`}
      renderItem={(item: CatalogueItem) => (
        <PosterCard
          title={item.name}
          image={item.icon}
          badge={isNewlyAdded(item.added, nowSeconds()) ? "new" : undefined}
          onPress={() => openItem(item)}
          onLongPress={() =>
            openQuickActions({ item, isAdult: isAdultRow(row), onInfo: () => openItem(item) })
          }
          testID={`poster-${item.item_id}`}
        />
      )}
    />
  );
}

// The Movies and Series tabs (03-design/screens.md, user-flows.md §7-8 Mobile): rows (R-053, 10
// items each and "See all"), an "All categories" picker, and the sort sheet (R-090, saved in
// vod_sort / series_sort). The section downloads on first open (R-050).
export function VodTabScreen({ kind }: { kind: "movie" | "series" }) {
  const { t } = useTranslation();
  useTabBack(false);
  const section = useSection(kind);
  const ready = section.state === "ready";
  const rows = useTabRows(kind, ready);
  const source = useSession((s) => s.active?.catalogue.source.type) ?? "xtream";
  const sortKey = kind === "movie" ? globalKeys.vodSort : globalKeys.seriesSort;
  const [sort, setSort] = useState<SortKey>(() => {
    const s = readSettings(kvStore);
    return kind === "movie" ? s.vodSort : s.seriesSort;
  });
  const [sheet, setSheet] = useState<"categories" | "sort" | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const title = t(kind === "movie" ? "movies" : "series");
  const list = rows.data ?? [];

  const chooseSort = (key: SortKey) => {
    kvStore.set(sortKey, key);
    setSort(key);
    setSheet(undefined);
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshCatalogue();
    } finally {
      setRefreshing(false);
    }
  };

  let body;
  if (section.state === "loading" || section.state === "idle")
    body = (
      <SectionLoader
        section={title}
        status={{ state: "loading", fraction: section.state === "loading" ? section.fraction : 0 }}
        onCancel={() => cancelSection(kind)}
        onRetry={() => void loadSection(kind)}
      />
    );
  else if (section.state === "cancelled" || section.state === "error")
    body = (
      <SectionLoader
        section={title}
        status={
          section.state === "error"
            ? { state: "error", message: t(sectionErrorKey(section.error)) }
            : { state: "cancelled" }
        }
        onCancel={() => undefined}
        onRetry={() => void loadSection(kind)}
      />
    );
  else if (rows.isSuccess && list.every((r) => r.type === "virtual"))
    body = <EmptyState icon={Film} title={t("mobile_section_empty", { section: title })} />;
  else
    body = (
      <FlashList
        data={list}
        keyExtractor={(r) => `${r.type}:${r.id}`}
        renderItem={({ item }) => <PreviewRow kind={kind} row={item} sort={sort} />}
        ItemSeparatorComponent={RowGap}
        contentContainerStyle={styles.rows}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            colors={[colors.brand.primary]}
            progressBackgroundColor={colors.surface[1]}
          />
        }
        testID={`${kind}-rows`}
      />
    );

  return (
    <View style={styles.root} testID={`${kind}-screen`}>
      <TopBar
        title={title}
        onSearch={() => router.push({ pathname: "/search", params: { scope: kind } })}
        onAccount={() => router.push("/account")}
      />
      {ready ? (
        <CategoryChips
          chips={[
            { key: "categories", label: t("mobile_all_categories"), dropdown: true },
            { key: "sort", label: t(SORT_LABELS[sort]), dropdown: true },
          ]}
          onPress={(key) => setSheet(key as "categories" | "sort")}
        />
      ) : null}
      {body}
      <ListSheet
        visible={sheet === "categories"}
        onClose={() => setSheet(undefined)}
        title={t("mobile_all_categories")}
        data={list}
        keyExtractor={(r) => `${r.type}:${r.id}`}
        testID="categories-sheet"
        renderItem={(row) => (
          <ListRow
            title={rowTitle(t, kind, row)}
            leading={
              isAdultRow(row) ? (
                <Lock size={layout.iconSize - spacing.xs} color={colors.text.secondary} />
              ) : undefined
            }
            chevron
            onPress={() => {
              setSheet(undefined);
              void openRow(kind, row, rowTitle(t, kind, row));
            }}
            testID={`category-${row.id}`}
          />
        )}
      />
      <Sheet
        visible={sheet === "sort"}
        onClose={() => setSheet(undefined)}
        title={t("mobile_sort")}
      >
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
    </View>
  );
}

function RowGap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  rows: { paddingVertical: spacing.md },
  gap: { height: layout.rowGap },
});
