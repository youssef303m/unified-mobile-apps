import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { reloadAppAsync } from "expo";
import type { ErrorBoundaryProps } from "expo-router";
import { TriangleAlert } from "lucide-react-native";

import { i18n } from "@/i18n";
import { reportError } from "@/session/crashReporting";
import { colors, layout, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";
import { Button } from "./Button";

// Shown instead of a screen that threw while rendering (the routes' ErrorBoundary export): the
// error goes to the crash reporter (disabled until the owner sets one up, D-079), and the user can
// render the screen again or restart the app. It uses i18n directly: the providers above the
// failed screen may be gone.
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(error, { source: "render" });
  }, [error]);

  return (
    <View style={styles.root} testID="crash-screen">
      <TriangleAlert
        size={layout.iconSize * 2}
        color={colors.text.tertiary}
        strokeWidth={layout.iconStroke}
      />
      <AppText variant="h3" style={styles.center} accessibilityRole="header">
        {i18n.t("something_went_wrong")}
      </AppText>
      <AppText color="secondary" style={styles.center}>
        {i18n.t("mobile_crash_body")}
      </AppText>
      <View style={styles.actions}>
        <Button label={i18n.t("try_again")} onPress={() => void retry()} testID="crash-retry" />
        <Button
          label={i18n.t("mobile_restart_app")}
          variant="secondary"
          onPress={() => void reloadAppAsync("Restart after a crash")}
          testID="crash-restart"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xxxl,
    backgroundColor: colors.bg.base,
  },
  center: { textAlign: "center" },
  actions: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.md },
});
