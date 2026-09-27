import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { ArrowLeft, Rewind } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { replayCategories, replayChannels } from "@/browse/guide";
import { AppText } from "@/components/AppText";
import { CatchupSheet } from "@/components/CatchupSheet";
import { CategoryChips } from "@/components/CategoryChips";
import { ChannelRow } from "@/components/ChannelRow";
import { EmptyState } from "@/components/EmptyState";
import { IconButton } from "@/components/IconButton";
import { replayAvailability } from "@/content/rules/live";
import type { CatalogueItem } from "@/content/types";
import { browseKey, need } from "@/hooks/queryClient";
import { useBrowse } from "@/hooks/useBrowse";
import { unlockCategory } from "@/hooks/useParental";
import { kvStore } from "@/storage/kv";
import { readSettings } from "@/storage/settings";
import { colors, layout, spacing } from "@/theme/tokens";

// Replay (R-097): the live categories with archive channels, their channels (live_sort), and a
// channel's catch-up days and programmes. Xtream only: Stalker portals and M3U say it is not
// available (the Live tab hides the entry for them).
export function ReplayScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const ctx = useBrowse();
  const pid = ctx?.catalogue.playlistId ?? "none";
  const [category, setCategory] = useState<string | undefined>();
  const [channel, setChannel] = useState<CatalogueItem | undefined>();
  const categories = useQuery({
    queryKey: [...browseKey(pid), "replay-categories"],
    enabled: ctx !== undefined,
    staleTime: Infinity,
    queryFn: () => replayCategories(need(ctx)),
  });
  const list = categories.data?.kind === "ok" ? categories.data.categories : [];
  const current = list.find((c) => c.category_id === category) ?? list.find((c) => !c.is_adult);
  const channels = useQuery({
    queryKey: [...browseKey(pid), "replay-channels", current?.category_id],
    enabled: ctx !== undefined && current !== undefined,
    staleTime: Infinity,
    queryFn: () =>
      replayChannels(need(ctx), need(current).category_id, readSettings(kvStore).liveSort),
  });

  const availability = ctx ? replayAvailability(ctx.catalogue.source.type) : "not_available";
  let body;
  if (availability === "stalker_blocked")
    body = <EmptyState icon={Rewind} title={t("msg_replay_not_available_for_stalker_portals")} />;
  else if (categories.isPending)
    body = <ActivityIndicator style={styles.center} color={colors.brand.primary} />;
  else if (availability === "not_available" || list.length === 0)
    body = <EmptyState icon={Rewind} title={t("msg_replay_not_available_for_current_playlist")} />;
  else
    body = (
      <>
        <CategoryChips
          chips={list.map((c) => ({
            key: c.category_id,
            label: c.category_name,
            selected: c.category_id === current?.category_id,
            locked: c.is_adult,
          }))}
          onPress={(key) => {
            const next = list.find((c) => c.category_id === key);
            if (!next) return;
            void unlockCategory(next.is_adult).then((ok) => ok && setCategory(key));
          }}
          testID="replay-categories"
        />
        {channels.data && channels.data.length === 0 ? (
          <EmptyState icon={Rewind} title={t("msg_no_channels_available_for_replay")} />
        ) : (
          <FlashList
            data={channels.data ?? []}
            keyExtractor={(c) => c.item_id}
            renderItem={({ item }) => (
              <ChannelRow
                name={item.name}
                number={item.num}
                logo={item.icon}
                onPress={() => setChannel(item)}
                testID={`replay-channel-${item.item_id}`}
              />
            )}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
            testID="replay-channels"
          />
        )}
      </>
    );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="replay-screen">
      <View style={styles.header}>
        <IconButton
          icon={ArrowLeft}
          label={t("back")}
          onPress={() => router.back()}
          testID="replay-back"
        />
        <AppText variant="h3">{t("replay")}</AppText>
      </View>
      {body}
      <CatchupSheet channel={channel} onClose={() => setChannel(undefined)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: layout.touchTarget + spacing.sm,
  },
  center: { marginTop: spacing.xxxl },
});
