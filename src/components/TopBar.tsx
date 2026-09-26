import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleUserRound, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { colors, layout, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";
import { IconButton } from "./IconButton";
import { Logo } from "./Logo";

// TopBar (design-system.md §5): the logo (or the tab title) on the left; on the right any extra
// action, Search and the profile avatar (→ Account). Over the hero it is transparent and turns
// into bg.elevated at 90% opacity after 40 dp of scroll (`scrollY`); without `scrollY` it is
// solid.
export interface TopBarProps {
  title?: string;
  onSearch: () => void;
  onAccount: () => void;
  extra?: ReactNode;
  scrollY?: SharedValue<number>;
  /** Floats over the content (Home's hero) instead of taking space. */
  overlay?: boolean;
  testID?: string;
}

const SOLID_OPACITY = 0.9;

export function TopBar({
  title,
  onSearch,
  onAccount,
  extra,
  scrollY,
  overlay = false,
  testID,
}: TopBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const background = useAnimatedStyle(() => ({
    opacity: scrollY
      ? interpolate(scrollY.value, [0, layout.topBarSolidAfter], [0, SOLID_OPACITY], "clamp")
      : 1,
  }));
  return (
    <View
      style={[styles.root, { paddingTop: insets.top }, overlay && styles.overlay]}
      testID={testID}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.background, background]} />
      <View style={styles.bar}>
        {title ? (
          <AppText variant="h1" numberOfLines={1} style={styles.title} accessibilityRole="header">
            {title}
          </AppText>
        ) : (
          <View style={styles.title}>
            <Logo size={layout.topBarLogoHeight} align="start" />
          </View>
        )}
        {extra}
        <IconButton icon={Search} label={t("search")} onPress={onSearch} testID="topbar-search" />
        <IconButton
          icon={CircleUserRound}
          label={t("account")}
          onPress={onAccount}
          size={layout.iconSize + spacing.xs}
          testID="topbar-account"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 1 },
  overlay: { position: "absolute", top: 0, start: 0, end: 0 },
  background: { backgroundColor: colors.bg.elevated },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: layout.touchTarget + spacing.sm,
    paddingStart: layout.gutter,
    paddingEnd: spacing.xs,
  },
  title: { flex: 1, alignItems: "flex-start" },
});
