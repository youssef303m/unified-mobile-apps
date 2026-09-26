import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";

import { colors, layout, radius, spacing } from "@/theme/tokens";
import { maxFontSizeMultiplier } from "@/theme/typography";

import { AppText } from "./AppText";

// TabBar (design-system.md §5): 5 tabs on bg.elevated. Icons are outline when idle and filled in
// text.primary when active, with caption labels. A count badge (downloads, from M7) can sit on
// a tab.
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
    <View style={[styles.root, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
      {tabs.map(({ key, label, icon: Icon, badge, testID }) => {
        const active = key === activeKey;
        const tint = active ? colors.text.primary : colors.text.secondary;
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
              <Icon
                size={layout.iconSize}
                color={tint}
                fill={active ? tint : "none"}
                strokeWidth={layout.iconStroke}
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
              color={active ? "primary" : "secondary"}
              numberOfLines={1}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    backgroundColor: colors.bg.elevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
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
    backgroundColor: colors.brand.primary,
    alignItems: "center",
  },
});
