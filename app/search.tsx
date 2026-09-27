import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, History, Search as SearchIcon, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { addRecentSearch, clearRecentSearches, recentSearches } from "@/browse/library";
import { kindsFor, type SearchSegment } from "@/browse/search";
import { AppText } from "@/components/AppText";
import { CategoryChips } from "@/components/CategoryChips";
import { ChannelRow } from "@/components/ChannelRow";
import { ContentRow } from "@/components/ContentRow";
import { EmptyState } from "@/components/EmptyState";
import { IconButton } from "@/components/IconButton";
import { ListRow } from "@/components/ListRow";
import { PosterCard } from "@/components/PosterCard";
import type { CatalogueItem, ContentKind } from "@/content/types";
import { browseKey } from "@/hooks/queryClient";
import { browseContext, useBrowse } from "@/hooks/useBrowse";
import { useIsFavourite, useToggleFavourite } from "@/hooks/useFavourite";
import { useSearch } from "@/hooks/useSearch";
import { loadSection, useSection } from "@/hooks/useSection";
import { artwork, colors, layout, radius, spacing } from "@/theme/tokens";
import { openItem } from "@/utils/content";
import { gridCardWidth, gridColumns } from "@/utils/grid";
import { textStyle } from "@/theme/typography";

const SEGMENTS: readonly SearchSegment[] = ["all", "live", "movie", "series"];
const SEGMENT_LABELS = {
  all: "mobile_search_all",
  live: "live_tv",
  movie: "movies",
  series: "series",
} as const;
const posterSize = { width: artwork.poster.width, height: artwork.poster.height };

function SearchChannel({ item, onOpen }: { item: CatalogueItem; onOpen: () => void }) {
  const favourite = useIsFavourite(item);
  const toggle = useToggleFavourite();
  return (
    <ChannelRow
      name={item.name}
      number={item.num}
      logo={item.icon}
      favourite={favourite}
      onToggleFavourite={() => toggle(item, false)}
      onPress={onOpen}
      testID={`result-${item.item_id}`}
    />
  );
}

/** Whether every section a segment searches is downloaded (Q-search-lod: search what is synced). */
function useSectionsFor(kinds: readonly ContentKind[]) {
  const live = useSection("live", false);
  const movie = useSection("movie", false);
  const series = useSection("series", false);
  const states = { live, movie, series };
  return kinds.filter((k) => states[k].state === "loading" || states[k].state === "idle");
}

// Search (03-design/screens.md, user-flows.md §10 Mobile): a focused field with All · Live ·
// Movies · Series, 400 ms debounce and at least 2 characters, results from SQLite FTS (never
// adult, R-064) or the portal's search (Stalker), and recent searches while the field is empty.
export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ scope?: string }>();
  const initialSegment = (SEGMENTS as readonly string[]).includes(params.scope ?? "")
    ? (params.scope as SearchSegment)
    : "all";
  const [segment, setSegment] = useState<SearchSegment>(initialSegment);
  const [text, setText] = useState("");
  const ctx = useBrowse();
  const queryClient = useQueryClient();
  const search = useSearch(text, segment);
  const kinds = ctx ? kindsFor(ctx, segment) : [];
  const syncing = useSectionsFor(kinds);
  const pid = ctx?.catalogue.playlistId ?? "none";
  // Read again whenever the field is empty (a search made on this screen shows at once).
  const [clearedAt, setClearedAt] = useState(0);
  const recent = ctx && !text.trim() && clearedAt >= 0 ? recentSearches(ctx.store, pid) : [];

  // Q-search-lod: the sections this segment searches download in the background.
  useEffect(() => {
    for (const kind of kinds) void loadSection(kind);
    // kinds follows the segment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, pid]);

  // A section that finished downloading makes the current query worth running again.
  const syncingKey = syncing.join(",");
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: [...browseKey(pid), "search"] });
  }, [syncingKey, pid, queryClient]);

  const open = (item: CatalogueItem) => {
    const current = browseContext();
    if (current) addRecentSearch(current.store, current.catalogue.playlistId, search.query || text);
    openItem(item);
  };

  const results = search.data;
  const columns = gridColumns(width);
  const cardWidth = gridCardWidth(width, columns);
  const poster = (item: CatalogueItem, w?: number) => (
    <PosterCard
      title={item.name}
      image={item.icon}
      width={w}
      onPress={() => open(item)}
      testID={`result-${item.item_id}`}
    />
  );

  let body;
  if (!text.trim()) {
    body = recent.length ? (
      <ScrollView
        contentContainerStyle={styles.recent}
        keyboardShouldPersistTaps="handled"
        testID="recent-searches"
      >
        <View style={styles.recentHeader}>
          <AppText variant="h3" style={styles.flex}>
            {t("mobile_recent_searches")}
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (ctx) clearRecentSearches(ctx.store, pid);
              setClearedAt(Date.now());
            }}
            testID="recent-clear"
          >
            <AppText variant="meta" color="secondary">
              {t("mobile_clear")}
            </AppText>
          </Pressable>
        </View>
        {recent.map((q) => (
          <ListRow
            key={q}
            title={q}
            leading={<History size={layout.iconSize - spacing.xs} color={colors.text.secondary} />}
            onPress={() => setText(q)}
            testID={`recent-${q}`}
          />
        ))}
      </ScrollView>
    ) : (
      <EmptyState top icon={SearchIcon} title={t("msg_type_to_start_searching")} />
    );
  } else if (!search.searchable) {
    body = <EmptyState top icon={SearchIcon} title={t("mobile_search_min_chars", { count: 2 })} />;
  } else if (search.isPending || search.pending) {
    body = <ActivityIndicator style={styles.flex} color={colors.brand.primary} size="large" />;
  } else if (search.isError) {
    body = (
      <EmptyState
        top
        icon={SearchIcon}
        title={t("msg_data_loading_failed")}
        action={{ label: t("try_again"), onPress: () => void search.refetch() }}
      />
    );
  } else if (results) {
    const liveNote =
      results.liveUnavailable && (segment === "all" || segment === "live") ? (
        <AppText variant="meta" color="secondary" style={styles.note}>
          {t("mobile_search_live_unavailable")}
        </AppText>
      ) : null;
    const total = results.live.length + results.movie.length + results.series.length;
    if (segment === "all") {
      body = (
        <ScrollView contentContainerStyle={styles.rows} keyboardShouldPersistTaps="handled">
          {liveNote}
          {total === 0 ? (
            <EmptyState
              top
              icon={SearchIcon}
              title={t("msg_no_results_found")}
              testID="search-empty"
            />
          ) : null}
          <ContentRow
            title={t("live_tv")}
            data={results.live}
            keyExtractor={(i) => i.item_id}
            itemSize={posterSize}
            testID="results-live"
            renderItem={(i) => poster(i)}
          />
          <ContentRow
            title={t("movies")}
            data={results.movie}
            keyExtractor={(i) => i.item_id}
            itemSize={posterSize}
            testID="results-movie"
            renderItem={(i) => poster(i)}
          />
          <ContentRow
            title={t("series")}
            data={results.series}
            keyExtractor={(i) => i.item_id}
            itemSize={posterSize}
            testID="results-series"
            renderItem={(i) => poster(i)}
          />
        </ScrollView>
      );
    } else {
      const items = results[segment];
      body =
        items.length === 0 ? (
          <>
            {liveNote}
            {results.liveUnavailable && segment === "live" ? null : (
              <EmptyState
                top
                icon={SearchIcon}
                title={t("msg_no_results_found")}
                testID="search-empty"
              />
            )}
          </>
        ) : segment === "live" ? (
          <FlashList
            data={items}
            keyExtractor={(i) => i.item_id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <SearchChannel item={item} onOpen={() => open(item)} />}
          />
        ) : (
          <FlashList
            data={items}
            numColumns={columns}
            keyExtractor={(i) => i.item_id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.grid}
            renderItem={({ item, index }) => (
              <View
                style={[styles.cell, { marginStart: index % columns === 0 ? 0 : layout.posterGap }]}
              >
                {poster(item, cardWidth)}
              </View>
            )}
          />
        );
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="search-screen">
      <View style={styles.header}>
        <IconButton
          icon={ArrowLeft}
          label={t("back")}
          onPress={() => router.back()}
          testID="search-back"
        />
        <View style={styles.field}>
          <SearchIcon
            size={layout.iconSize - spacing.xs}
            color={colors.text.secondary}
            style={I18nManager.isRTL ? styles.mirror : undefined}
          />
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder={t("search")}
            placeholderTextColor={colors.text.tertiary}
            style={[styles.input, textStyle("body", i18n.language)]}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel={t("search")}
            testID="search-input"
          />
          {text ? (
            <IconButton
              icon={X}
              label={t("mobile_clear")}
              onPress={() => setText("")}
              size={layout.iconSize - spacing.xs}
            />
          ) : null}
        </View>
      </View>
      <CategoryChips
        chips={SEGMENTS.map((s) => ({
          key: s,
          label: t(SEGMENT_LABELS[s]),
          selected: s === segment,
          testID: `segment-${s}`,
        }))}
        onPress={(key) => setSegment(key as SearchSegment)}
      />
      {syncing.length && text.trim() ? (
        <AppText variant="meta" color="secondary" style={styles.note} testID="search-syncing">
          {t("mobile_search_syncing")}
        </AppText>
      ) : null}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingEnd: layout.gutter },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface[1],
    borderRadius: radius.input,
    paddingStart: spacing.md,
    minHeight: layout.touchTarget,
  },
  input: { flex: 1, color: colors.text.primary, paddingVertical: spacing.sm },
  mirror: { transform: [{ scaleX: -1 }] },
  recent: { paddingVertical: spacing.md },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.sm,
  },
  rows: { gap: layout.rowGap, paddingVertical: spacing.md },
  note: { paddingHorizontal: layout.gutter, paddingVertical: spacing.xs },
  grid: { paddingHorizontal: layout.gutter, paddingTop: spacing.md },
  cell: { marginBottom: spacing.lg },
});
