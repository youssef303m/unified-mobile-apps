import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { useTranslation } from "react-i18next";

import { FIXTURES_ALLOWED } from "@/api/fixtureMode";
import { isFixtureModeOn, saveFixtureSetting } from "@/session/fixtures";
import { colors, layout, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";

// Dev/preview-only switch for the "use fixtures" mode (04-build/testing.md §1). The hidden dev
// menu replaces it later.
export function DevFixturesSwitch() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(isFixtureModeOn);
  if (!FIXTURES_ALLOWED) return null;
  const toggle = (value: boolean) => {
    saveFixtureSetting(value);
    setEnabled(value);
  };
  return (
    <View style={styles.row}>
      <AppText variant="meta" color="tertiary">
        {t("mobile_dev_fixtures")}
      </AppText>
      <Switch
        accessibilityLabel={t("mobile_dev_fixtures")}
        value={enabled}
        onValueChange={toggle}
        trackColor={{ true: colors.brand.primary, false: colors.surface[3] }}
        thumbColor={colors.text.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: layout.touchTarget,
  },
});
