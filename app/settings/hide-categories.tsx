import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { EyeOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { setRowHidden } from "@/browse/settings";
import { AppText } from "@/components/AppText";
import { CategoryChips } from "@/components/CategoryChips";
import { EmptyState } from "@/components/EmptyState";
import { ListRow } from "@/components/ListRow";
import { Screen } from "@/components/Screen";
import type { ContentKind } from "@/content/types";
import { refreshBrowse } from "@/hooks/queryClient";
import { browseContext } from "@/hooks/useBrowse";
import { useHideableRows } from "@/hooks/useBrowseQueries";
import { rowTitle } from "@/i18n/rowTitles";
import { colors, spacing } from "@/theme/tokens";

const KINDS = [
  { kind: "live", label: "live_tv" },
  { kind: "movie", label: "movies" },
  { kind: "series", label: "series" },
] as const;

// Settings → Hide Categories (settings.md §2.3): a Live / Movies / Series switch, then every row
// of the current playlist's section; the switch on = visible. Hidden rows leave the tabs and
// Search (R-098). A section never opened has no list yet.
export default function HideCategoriesScreen() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<ContentKind>("live");
  const rows = useHideableRows(kind);
  const list = rows.data ?? [];
  const hiddenCount = list.filter((r) => r.hidden).length;

  const toggle = (rowId: string) => {
    const ctx = browseContext();
    if (!ctx) return;
    setRowHidden(ctx, kind, rowId);
    refreshBrowse(ctx.catalogue.playlistId);
  };

  return (
    <Screen title={t("hide_categories")} onBack={() => router.back()} testID="hide-categories">
      <AppText color="secondary">{t("hide_categories_desc")}</AppText>
      <CategoryChips
        chips={KINDS.map((k) => ({
          key: k.kind,
          label: t(k.label),
          selected: k.kind === kind,
          testID: `hide-kind-${k.kind}`,
        }))}
        onPress={(key) => setKind(key as ContentKind)}
      />
      {rows.isPending ? (
        <ActivityIndicator color={colors.brand.primary} />
      ) : list.length === 0 ? (
        <EmptyState icon={EyeOff} title={t("categories_will_show_here")} />
      ) : (
        <View style={styles.list}>
          {hiddenCount > 0 ? (
            <AppText variant="meta" color="secondary" testID="hide-count">
              {t("mobile_hidden_count", { count: hiddenCount })}
            </AppText>
          ) : null}
          {list.map(({ row, hidden }) => (
            <ListRow
              key={row.id}
              title={rowTitle(t, kind, row)}
              toggle={{ value: !hidden, onChange: () => toggle(row.id) }}
              testID={`hide-row-${row.id}`}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});
