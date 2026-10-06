import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";

import { colors, elevation, layout, radius, spacing } from "@/theme/tokens";
import { maxFontSizeMultiplier } from "@/theme/typography";

import { AppText } from "./AppText";

// TabBar (design-system.md §5): 5 tabs with caption labels. Icons stay outlines (lucide icons are
// not drawn to be filled). A count badge (downloads, from M7) can sit on a tab. Style A
// (docs/decisions.md D-085): a rounded top, and the active tab in red, with a slightly thicker
// stroke and a soft glow behind its icon.
export interface TabItem {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  testID?: string;
}

export interface TabBarProps {
  tabs: readonly TabItem[];
  activeKey: string;
  onPress: (key: string) => void;
}

export function TabBar({ tabs, activeKey, onPress }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    // The black outer view fills the rounded corners.
    <View style={styles.outer}>
      <View style={[styles.root, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
        {tabs.map(({ key, label, icon: Icon, badge, testID }) => {
          const active = key === activeKey;
          const tint = active ? colors.brand.vivid : colors.text.secondary;
          return (
            <Pressable
              key={key}
              testID={testID ?? `tab-${key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={badge ? `${label}, ${badge}` : label}
              onPress={() => onPress(key)}
              style={styles.tab}
            >
              <View>
                {active ? <View style={styles.glow} pointerEvents="none" /> : null}
                <Icon
                  size={layout.iconSize}
                  color={tint}
                  strokeWidth={active ? layout.iconStroke + 0.5 : layout.iconStroke}
                />
                {badge ? (
                  <View style={styles.badge}>
                    <AppText
                      variant="caption"
                      color="onPrimary"
                      maxFontSizeMultiplier={maxFontSizeMultiplier}
                    >
                      {badge}
                    </AppText>
                  </View>
                ) : null}
              </View>
              <AppText
                variant="caption"
                color={active ? "vivid" : "secondary"}
                numberOfLines={1}
                maxFontSizeMultiplier={maxFontSizeMultiplier}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { backgroundColor: colors.bg.base },
  root: {
    flexDirection: "row",
    backgroundColor: colors.card.tab,
    borderTopStartRadius: radius.tabBar,
    borderTopEndRadius: radius.tabBar,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border.card,
    paddingTop: spacing.xs,
  },
  // A small dot whose shadow is the glow; it sits behind the icon.
  glow: {
    position: "absolute",
    top: layout.iconSize / 2 - 1,
    start: layout.iconSize / 2 - 1,
    width: 2,
    height: 2,
    borderRadius: 1,
    ...elevation.glowSoft,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    minHeight: layout.touchTarget + spacing.md,
  },
  badge: {
    position: "absolute",
    top: -spacing.xs,
    end: -spacing.md,
    minWidth: spacing.lg,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.chip,
    backgroundColor: colors.brand.vivid,
    alignItems: "center",
  },
});
