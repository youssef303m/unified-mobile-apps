import type { ReactNode } from "react";
import { I18nManager, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { colors, layout, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";

export interface ScreenProps {
  title?: string;
  /** Shows a back arrow in the header. */
  onBack?: () => void;
  headerRight?: ReactNode;
  /** A bar pinned to the bottom (e.g. the Terms Accept / Exit buttons). */
  footer?: ReactNode;
  /** Content that manages its own scrolling (lists). */
  scroll?: boolean;
  children: ReactNode;
  testID?: string;
}

// A stack screen: safe area, optional header with back arrow and title, 16dp gutters.
export function Screen({
  title,
  onBack,
  headerRight,
  footer,
  scroll = true,
  children,
  testID,
}: ScreenProps) {
  const { t } = useTranslation();
  const header =
    title || onBack || headerRight ? (
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("back")}
            onPress={onBack}
            style={styles.iconButton}
            testID="header-back"
          >
            <ArrowLeft
              size={layout.iconSize - 2}
              color={colors.text.primary}
              style={I18nManager.isRTL ? styles.mirror : undefined}
            />
          </Pressable>
        ) : null}
        {title ? (
          <AppText variant="h1" accessibilityRole="header" style={styles.title} numberOfLines={1}>
            {title}
          </AppText>
        ) : (
          <View style={styles.title} />
        )}
        {headerRight}
      </View>
    ) : null;
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID={testID}>
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={styles.fill}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: layout.touchTarget + spacing.sm,
  },
  // Style A: the back arrow in an outlined round button (docs/decisions.md D-085).
  iconButton: {
    width: layout.circleButton,
    height: layout.circleButton,
    borderRadius: layout.circleButton / 2,
    borderWidth: 1.5,
    borderColor: colors.border.control,
    backgroundColor: colors.card.control,
    alignItems: "center",
    justifyContent: "center",
    marginStart: spacing.xs,
  },
  mirror: { transform: [{ scaleX: -1 }] },
  title: { flex: 1, paddingHorizontal: spacing.sm },
  content: { padding: layout.gutter, gap: spacing.lg, flexGrow: 1 },
  fill: { flex: 1 },
  footer: {
    padding: layout.gutter,
    gap: spacing.sm,
    backgroundColor: colors.card.tab,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
  },
});
