import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";

// A surface.1 card, radius 8, with an optional caption header (design-system.md §3, §5).
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
    backgroundColor: colors.surface[1],
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
