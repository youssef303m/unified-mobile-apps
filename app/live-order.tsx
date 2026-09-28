import { useState } from "react";
import { AccessibilityInfo, ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import {
  categoryChannels,
  liveRowOrder,
  moveChannel,
  moveLiveRow,
  rowMovable,
} from "@/browse/order";
import type { Row } from "@/browse/rows";
import { AppText } from "@/components/AppText";
import { ErrorState } from "@/components/ErrorState";
import { IconButton } from "@/components/IconButton";
import { ListRow } from "@/components/ListRow";
import { Screen } from "@/components/Screen";
import type { CatalogueItem } from "@/content/types";
import { browseKey, need, refreshBrowse } from "@/hooks/queryClient";
import { useBrowse } from "@/hooks/useBrowse";
import { rowTitle } from "@/i18n/rowTitles";
import { kvStore } from "@/storage/kv";
import { readSettings } from "@/storage/settings";
import { colors, spacing } from "@/theme/tokens";

interface Entry {
  id: string;
  title: string;
  /** Index in the full list (categories: Search All included). */
  index: number;
  canUp: boolean;
  canDown: boolean;
}

function OrderRow({ entry, onMove }: { entry: Entry; onMove: (delta: -1 | 1) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <ListRow
        title={entry.title}
        testID={`order-row-${entry.id}`}
        trailing={
          <>
            <IconButton
              icon={ChevronUp}
              label={t("mobile_move_up", { name: entry.title })}
              onPress={() => onMove(-1)}
              disabled={!entry.canUp}
              testID={`order-up-${entry.id}`}
            />
            <IconButton
              icon={ChevronDown}
              label={t("mobile_move_down", { name: entry.title })}
              onPress={() => onMove(1)}
              disabled={!entry.canDown}
              testID={`order-down-${entry.id}`}
            />
          </>
        }
      />
    </View>
  );
}

// Move (R-093, user-flows.md §5 Mobile): the Live categories, or one category's channels, with
// up / down buttons in place of the TV's Move mode. Each step is saved at once, in the TV's
// format, and the Live tab follows.
export default function LiveOrderScreen() {
  const { t } = useTranslation();
  const { category, name } = useLocalSearchParams<{ category?: string; name?: string }>();
  const ctx = useBrowse();
  const pid = ctx?.catalogue.playlistId ?? "none";
  const sort = readSettings(kvStore).liveSort;
  const loaded = useQuery({
    queryKey: [...browseKey(pid), "order", category ?? "categories"],
    enabled: ctx !== undefined,
    staleTime: Infinity,
    queryFn: async (): Promise<(Row | CatalogueItem)[]> =>
      category ? categoryChannels(need(ctx), category, sort) : liveRowOrder(need(ctx)),
  });
  const [moved, setMoved] = useState<(Row | CatalogueItem)[] | undefined>();
  const list = moved ?? loaded.data;

  const entries: Entry[] = [];
  if (list) {
    list.forEach((item, index) => {
      if ("type" in item) {
        if (item.id === "all") return;
        const rows = list as Row[];
        entries.push({
          id: item.id,
          title: rowTitle(t, "live", item),
          index,
          canUp: rowMovable(rows, index, -1),
          canDown: rowMovable(rows, index, 1),
        });
      } else {
        entries.push({
          id: item.item_id,
          title: item.num ? `${item.num}  ${item.name}` : item.name,
          index,
          canUp: index > 0,
          canDown: index < list.length - 1,
        });
      }
    });
  }

  const move = (entry: Entry, delta: -1 | 1) => {
    if (!ctx || !list) return;
    const next = category
      ? moveChannel(ctx, category, list as CatalogueItem[], entry.index, delta)
      : moveLiveRow(ctx, list as Row[], entry.index, delta);
    if (!next) return;
    setMoved(next);
    refreshBrowse(ctx.catalogue.playlistId);
    // TalkBack: say where the item is now.
    const visible = entries.length;
    const position = entries.findIndex((e) => e.id === entry.id) + delta + 1;
    AccessibilityInfo.announceForAccessibility(
      t("mobile_moved_to", { name: entry.title, position, total: visible }),
    );
  };

  return (
    <Screen
      title={name ? `${t("move")} · ${name}` : t("move")}
      onBack={() => router.back()}
      scroll={false}
      testID="live-order"
    >
      <AppText color="secondary">{t("mobile_move_hint")}</AppText>
      {loaded.isError && !list ? (
        <ErrorState onRetry={() => void loaded.refetch()} testID="order-error" />
      ) : !list ? (
        <ActivityIndicator color={colors.brand.primary} />
      ) : (
        <FlashList
          data={entries}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => <OrderRow entry={item} onMove={(d) => move(item, d)} />}
          testID="order-list"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { paddingBottom: spacing.sm },
});
