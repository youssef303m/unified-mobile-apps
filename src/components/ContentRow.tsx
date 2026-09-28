import type { ReactElement } from "react";
import {
  I18nManager,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { ChevronRight, Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { colors, layout, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";
import { Skeleton } from "./Skeleton";

// ContentRow (design-system.md §5): an h3 title with an optional "See all ›" link, and a
// horizontal FlashList of cards with 16 dp side insets. Loading shows 4 grey cards; a row with
// nothing to show is hidden (N-01). A locked row (R-061) shows its title with a lock and asks for
// the PIN from "See all".
export interface ContentRowProps<T> {
  title: string;
  data: readonly T[];
  renderItem: (item: T, index: number) => ReactElement;
  keyExtractor: (item: T) => string;
  /** The card size, for the skeleton. */
  itemSize: { width: number; height: number };
  loading?: boolean;
  locked?: boolean;
  onSeeAll?: () => void;
  /** Spacing around the row (a hidden row takes none). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SKELETON_CARDS = 4;

export function ContentRow<T>({
  title,
  data,
  renderItem,
  keyExtractor,
  itemSize,
  loading = false,
  locked = false,
  onSeeAll,
  style,
  testID,
}: ContentRowProps<T>) {
  const { t } = useTranslation();
  if (!loading && !locked && data.length === 0) return null;
  return (
    <View style={[styles.root, style]} testID={testID}>
      <Pressable
        accessibilityRole={onSeeAll ? "button" : "header"}
        accessibilityLabel={[
          locked ? t("mobile_locked_label", { name: title }) : title,
          onSeeAll ? t("mobile_see_all") : undefined,
        ]
          .filter(Boolean)
          .join(", ")}
        // Without See all it is a plain header, never "disabled" (it has no onPress).
        onPress={onSeeAll}
        style={styles.header}
        testID={testID ? `${testID}-see-all` : undefined}
      >
        {locked ? <Lock size={spacing.lg} color={colors.text.secondary} /> : null}
        <AppText variant="h3" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
        {onSeeAll ? (
          <View style={styles.seeAll}>
            <AppText variant="meta" color="secondary">
              {t("mobile_see_all")}
            </AppText>
            <ChevronRight
              size={spacing.lg}
              color={colors.text.secondary}
              style={I18nManager.isRTL ? styles.mirror : undefined}
            />
          </View>
        ) : null}
      </Pressable>
      {loading ? (
        <View style={styles.skeletons}>
          {Array.from({ length: SKELETON_CARDS }, (_, i) => (
            <Skeleton key={i} width={itemSize.width} height={itemSize.height} />
          ))}
        </View>
      ) : locked ? null : (
        <FlashList
          horizontal
          data={data}
          keyExtractor={keyExtractor}
          renderItem={({ item, index }) => renderItem(item, index)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
        />
      )}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: layout.gutter,
    minHeight: layout.touchTarget - spacing.md,
  },
  title: { flex: 1 },
  seeAll: { flexDirection: "row", alignItems: "center" },
  mirror: { transform: [{ scaleX: -1 }] },
  skeletons: {
    flexDirection: "row",
    gap: layout.posterGap,
    paddingHorizontal: layout.gutter,
    overflow: "hidden",
  },
  list: { paddingHorizontal: layout.gutter },
  separator: { width: layout.posterGap },
});
