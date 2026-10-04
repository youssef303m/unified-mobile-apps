import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";

// A card with an optional caption header (design-system.md §3, §5); style A: outlined, radius 14
// (docs/decisions.md D-085).
export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.root}>
      {title ? (
        <AppText variant="caption" color="secondary" accessibilityRole="header">
          {title}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: 1,
    borderColor: colors.border.card,
    backgroundColor: colors.card.bg,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
