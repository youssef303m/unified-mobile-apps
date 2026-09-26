import { BackHandler, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { accept } from "@/session/boot";
import { colors, radius, spacing } from "@/theme/tokens";
import { resetTo } from "@/utils/navigation";

const USES = [
  "terms_use_personal_media",
  "terms_use_licensed",
  "terms_use_private_streams",
  "terms_use_free_to_air",
  "terms_use_dev_testing",
] as const;

// Terms (R-001, current-app-inventory.md §2): shown until accepted, with a sticky Accept / Exit bar.
export default function TermsScreen() {
  const { t } = useTranslation();
  return (
    <Screen
      title={t("terms_welcome")}
      testID="terms-screen"
      footer={
        <>
          <Button
            label={t("accept")}
            variant="brand"
            testID="terms-accept"
            onPress={() => {
              accept();
              resetTo("/");
            }}
          />
          <Button
            label={t("mobile_exit")}
            variant="secondary"
            onPress={() => BackHandler.exitApp()}
          />
        </>
      }
    >
      <AppText>
        {t("terms_intro_a")} <AppText variant="bodyStrong">{t("terms_legal_use_only")}</AppText>
        {t("terms_intro_b")}
      </AppText>
      <View style={styles.list}>
        {USES.map((key) => (
          <AppText key={key} color="secondary">
            {"•  "}
            {t(key)}
          </AppText>
        ))}
      </View>
      <View style={styles.warning}>
        <AppText>
          {t("terms_warning_a")} <AppText variant="bodyStrong">{t("terms_warning_not")}</AppText>{" "}
          {t("terms_warning_b")}
        </AppText>
        <AppText color="secondary">{t("terms_warning_c")}</AppText>
      </View>
      <AppText variant="meta" color="secondary">
        {t("terms_note")}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  warning: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface[1],
    borderStartWidth: 3,
    borderStartColor: colors.status.warning,
  },
});
