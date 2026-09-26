import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";
import { Button } from "./Button";

// The per-section loader (user-flows.md "Loading", R-050): shown while a section downloads the
// first time it is opened, with its progress and Cancel; after a cancel or a failure, a message
// and Retry.
export type SectionLoaderState =
  | { state: "loading"; fraction: number }
  | { state: "cancelled" }
  | { state: "error"; message: string };

export interface SectionLoaderProps {
  section: string;
  status: SectionLoaderState;
  onCancel: () => void;
  onRetry: () => void;
}

export function SectionLoader({ section, status, onCancel, onRetry }: SectionLoaderProps) {
  const { t } = useTranslation();
  if (status.state === "loading") {
    const pct = Math.round(status.fraction * 100);
    return (
      <View style={styles.root} testID="section-loading">
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <AppText color="secondary" style={styles.center}>
          {t("mobile_home_loading_section", { section })}
          {pct > 0 ? ` ${pct}%` : ""}
        </AppText>
        <Button
          label={t("cancel")}
          variant="secondary"
          onPress={onCancel}
          testID="section-cancel"
        />
      </View>
    );
  }
  return (
    <View style={styles.root} testID="section-failed">
      <AppText color={status.state === "error" ? "danger" : "secondary"} style={styles.center}>
        {status.state === "error" ? status.message : t("mobile_section_cancelled", { section })}
      </AppText>
      <Button label={t("try_again")} onPress={onRetry} testID="section-retry" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xxxl,
  },
  center: { textAlign: "center" },
});
