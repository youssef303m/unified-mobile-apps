import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { changeLanguage, type LanguageCode } from "@/i18n";
import { LANGUAGES } from "@/i18n/languages";
import { colors, layout, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";

const DEV_LANGUAGES: readonly LanguageCode[] = ["en", "ar"];

// Dev-only English/Arabic switch for checking RTL before Settings → Language exists (M6).
export function DevLanguageSwitch() {
  const { t, i18n } = useTranslation();
  if (!__DEV__) return null;
  return (
    <View style={styles.root}>
      <AppText variant="meta" color="tertiary">
        {t("mobile_dev_language")}
      </AppText>
      <View style={styles.row}>
        {DEV_LANGUAGES.map((code) => {
          const selected = i18n.language === code;
          return (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => void changeLanguage(code)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <AppText variant="meta" color={selected ? "inverse" : "primary"}>
                {LANGUAGES.find((l) => l.code === code)?.name}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
  chip: {
    minHeight: layout.touchTarget,
    minWidth: layout.touchTarget,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.text.tertiary,
  },
  chipSelected: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },
});
