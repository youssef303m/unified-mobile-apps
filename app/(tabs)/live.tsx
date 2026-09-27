import { useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { ArrowUpDown, CalendarDays, Lock, Rewind, Tv } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { initialLiveSelection } from "@/browse/live";
import { channelMoveAvailable } from "@/browse/order";
import type { Row } from "@/browse/rows";
import { CategoryChips, type Chip } from "@/components/CategoryChips";
import { ChannelRow } from "@/components/ChannelRow";
import { EmptyState } from "@/components/EmptyState";
import { IconButton } from "@/components/IconButton";
import { ListRow } from "@/components/ListRow";
import { openQuickActions } from "@/components/QuickActionsSheet";
import { SectionLoader } from "@/components/SectionLoader";
import { ListSheet } from "@/components/Sheet";
import { TopBar } from "@/components/TopBar";
import { channelTapAction, replayAvailability } from "@/content/rules/live";
import type { CatalogueItem } from "@/content/types";
import { browseKey, need } from "@/hooks/queryClient";
import { useBrowse } from "@/hooks/useBrowse";
import { useCategoryFlags, useFeed, useTabRows } from "@/hooks/useBrowseQueries";
import { useEpgNow } from "@/hooks/useEpgNow";
import { useIsFavourite, useToggleFavourite } from "@/hooks/useFavourite";
import { unlockCategory } from "@/hooks/useParental";
import { cancelSection, loadSection, refreshCatalogue, useSection } from "@/hooks/useSection";
import { useTabBack } from "@/hooks/useTabBack";
import { rowTitle } from "@/i18n/rowTitles";
import { MiniPlayer } from "@/player/MiniPlayer";
import { sectionErrorKey } from "@/i18n/sectionErrors";
import { kvStore } from "@/storage/kv";
import { readSettings } from "@/storage/settings";
import { colors, layout, spacing } from "@/theme/tokens";
import { openGuide, playChannel } from "@/utils/content";
import { epgClock } from "@/utils/epgTime";

function Channel({
  item,
  isAdult,
  playing,
  onPress,
  onMove,
}: {
  item: CatalogueItem;
  isAdult: boolean;
  playing: boolean;
  onPress: () => void;
  onMove?: () => void;
}) {
  const now = useEpgNow(item);
  const favourite = useIsFavourite(item);
  const toggle = useToggleFavourite();
  const current = now?.current;
  return (
    <ChannelRow
      name={item.name}
      number={item.num}
      logo={item.icon}
      now={
        current
          ? {
              title: current.title,
              times: `${epgClock(current.start)} – ${epgClock(current.stop)}`,
              progress: now.progress,
            }
          : undefined
      }
      favourite={favourite}
      onToggleFavourite={() => toggle(item, isAdult)}
      onPress={onPress}
      onLongPress={() => openQuickActions({ item, isAdult, onMove })}
      playing={playing}
      testID={`channel-${item.item_id}`}
    />
  );
}

// Live TV (03-design/screens.md, user-flows.md §5 Mobile): category chips (Recently Viewed,
// Favourites, the current category, and a picker for all of them), the channel list with the
// programme on now, and the preview of the selected channel. The first tap previews, a tap on
// the previewed channel goes full screen (R-091; the player arrives in M5).
export default function LiveScreen() {
  const { t } = useTranslation();
  useTabBack(false);
  const params = useLocalSearchParams<{ channel?: string; category?: string }>();
  const ctx = useBrowse();
  const section = useSection("live");
  const ready = section.state === "ready";
  const rows = useTabRows("live", ready);
  const flags = useCategoryFlags("live");
  const list = useMemo(() => rows.data ?? [], [rows.data]);
  const pid = ctx?.catalogue.playlistId ?? "none";
  const initial = useQuery({
    queryKey: [...browseKey(pid), "live-initial"],
    enabled: ready && ctx !== undefined && !params.category,
    staleTime: Infinity,
    queryFn: () => initialLiveSelection(need(ctx), readSettings(kvStore).liveInitialization),
  });
  // The user's choice wins over a link's, which wins over R-092.
  const [chosen, setChosen] = useState<{ rowId: string; key: string } | undefined>();
  const [selected, setSelected] = useState<{ id: string; key: string } | undefined>();
  const [picker, setPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const linkKey = `${params.category ?? ""}:${params.channel ?? ""}`;
  const rowId =
    (chosen?.key === linkKey ? chosen.rowId : undefined) ??
    params.category ??
    initial.data?.rowId ??
    list.find((r) => r.type === "category")?.id;
  const row = list.find((r) => r.id === rowId);
  // A link to another channel (Home Live Now, Search) replaces the user's earlier pick.
  const selectedId =
    (selected?.key === linkKey ? selected.id : undefined) ??
    params.channel ??
    (chosen?.key === linkKey ? undefined : initial.data?.channelId);
  const feed = useFeed("live", row, readSettings(kvStore).liveSort, ready && row !== undefined);
  const selectedItem = feed.items.find((i) => i.item_id === selectedId);

  const isAdultCategory = (id: string) => flags.get(id)?.isAdult ?? false;
  const adultCategories = useMemo(
    () => [...flags].filter(([, f]) => f.isAdult).map(([id]) => id),
    [flags],
  );
  const fullscreen = (item: CatalogueItem) =>
    playChannel(feed.items, Math.max(0, feed.items.indexOf(item)), adultCategories);

  const chooseRow = async (next: Row) => {
    if (next.type === "category" && !(await unlockCategory(next.isAdult))) return;
    setChosen({ rowId: next.id, key: linkKey });
    setSelected(undefined);
  };

  // R-072: the channel is added to Recently Viewed once it plays (MiniPlayer, live player).
  const tapChannel = (item: CatalogueItem) => {
    if (channelTapAction(selectedId, item.item_id) === "fullscreen") return fullscreen(item);
    setSelected({ id: item.item_id, key: linkKey });
  };

  // R-093: Move opens the order screen for this category's channels.
  const moveChannels =
    ctx && row && channelMoveAvailable(ctx, row)
      ? () =>
          router.push({
            pathname: "/live-order",
            params: { category: row.id, name: rowTitle(t, "live", row) },
          })
      : undefined;

  const chips: Chip[] = [
    { key: "recent", label: t("mobile_row_recently_viewed"), selected: rowId === "recent" },
    { key: "favourite", label: t("favorites"), selected: rowId === "favourite" },
  ];
  if (row && row.type !== "virtual")
    chips.push({
      key: row.id,
      label: rowTitle(t, "live", row),
      selected: true,
      locked: row.type === "category" && row.isAdult,
    });
  chips.push({ key: "picker", label: t("mobile_all_categories"), dropdown: true });

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
        section={t("live_tv")}
        status={{ state: "loading", fraction: section.state === "loading" ? section.fraction : 0 }}
        onCancel={() => cancelSection("live")}
        onRetry={() => void loadSection("live")}
      />
    );
  else if (section.state === "cancelled" || section.state === "error")
    body = (
      <SectionLoader
        section={t("live_tv")}
        status={
          section.state === "error"
            ? { state: "error", message: t(sectionErrorKey(section.error)) }
            : { state: "cancelled" }
        }
        onCancel={() => undefined}
        onRetry={() => void loadSection("live")}
      />
    );
  else
    body = (
      <>
        <CategoryChips
          chips={chips}
          onPress={(key) => {
            if (key === "picker") return setPicker(true);
            const next = list.find((r) => r.id === key);
            if (next) void chooseRow(next);
          }}
          testID="live-chips"
        />
        {selectedItem ? (
          <MiniPlayer
            channel={selectedItem}
            isAdult={isAdultCategory(selectedItem.category_id)}
            onFullscreen={() => fullscreen(selectedItem)}
          />
        ) : null}
        {feed.isSuccess && feed.items.length === 0 ? (
          <EmptyState
            icon={Tv}
            title={
              rowId === "favourite"
                ? t("msg_you_have_no_favorite_channels")
                : t("msg_this_category_has_no_channels")
            }
          />
        ) : (
          <FlashList
            data={feed.items}
            keyExtractor={(i) => i.item_id}
            extraData={selectedId}
            renderItem={({ item }) => (
              <Channel
                item={item}
                isAdult={isAdultCategory(item.category_id)}
                playing={item.item_id === selectedId}
                onPress={() => tapChannel(item)}
                onMove={moveChannels}
              />
            )}
            onEndReached={() => {
              if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void refresh()}
                colors={[colors.brand.primary]}
                progressBackgroundColor={colors.surface[1]}
              />
            }
            testID="channel-list"
          />
        )}
      </>
    );

  return (
    <View style={styles.root} testID="live-screen">
      <TopBar
        title={t("live_tv")}
        onSearch={() => router.push({ pathname: "/search", params: { scope: "live" } })}
        onAccount={() => router.push("/account")}
        extra={
          ready ? (
            <>
              {ctx?.catalogue.source.capabilities.epg ? (
                <IconButton
                  icon={CalendarDays}
                  label={t("epg")}
                  onPress={() =>
                    openGuide(
                      row ? rowTitle(t, "live", row) : t("live_tv"),
                      feed.items,
                      adultCategories,
                    )
                  }
                  testID="live-guide-button"
                />
              ) : null}
              {ctx && replayAvailability(ctx.catalogue.source.type) === "available" ? (
                <IconButton
                  icon={Rewind}
                  label={t("replay")}
                  onPress={() => router.push("/replay")}
                  testID="live-replay-button"
                />
              ) : null}
            </>
          ) : undefined
        }
      />
      {body}
      <ListSheet
        visible={picker}
        onClose={() => setPicker(false)}
        title={t("mobile_all_categories")}
        data={list}
        keyExtractor={(r) => `${r.type}:${r.id}`}
        testID="live-categories-sheet"
        header={
          <ListRow
            title={t("mobile_move_categories")}
            leading={<ArrowUpDown size={layout.iconSize} color={colors.text.secondary} />}
            chevron
            onPress={() => {
              setPicker(false);
              router.push("/live-order");
            }}
            testID="live-move-categories"
          />
        }
        renderItem={(r) => (
          <ListRow
            title={rowTitle(t, "live", r)}
            leading={
              r.type === "category" && r.isAdult ? (
                <Lock size={layout.iconSize - spacing.xs} color={colors.text.secondary} />
              ) : undefined
            }
            selected={r.id === rowId}
            onPress={() => {
              setPicker(false);
              void chooseRow(r);
            }}
            testID={`live-category-${r.id}`}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
});
