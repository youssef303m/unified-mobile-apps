import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { colors, layout, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";

interface PlaceholderScreenProps {
  title: string;
  children?: ReactNode;
}

// Temporary tab content until each screen's milestone (M3-M4).
export function PlaceholderScreen({ title, children }: PlaceholderScreenProps) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <AppText variant="h1" accessibilityRole="header">
        {title}
      </AppText>
      <View style={styles.body}>
        <AppText color="secondary">{t("mobile_placeholder_title")}</AppText>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.lg,
  },
  body: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.lg },
});
