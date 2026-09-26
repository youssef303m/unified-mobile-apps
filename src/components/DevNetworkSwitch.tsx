import { Pressable, StyleSheet, View } from "react-native";
import { reloadAppAsync } from "expo";
import { useTranslation } from "react-i18next";

import { resetAppData } from "@/session/boot";
import { NETWORK_SWITCH_ALLOWED, networkMode, saveNetworkMode } from "@/session/network";
import { NETWORK_MODES, type NetworkMode } from "@/session/networkMode";
import { colors, layout, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";

const LABELS = {
  fixtures: "mobile_dev_network_fixtures",
  dev_backend: "mobile_dev_network_dev_backend",
  production: "mobile_dev_network_production",
} as const;

// Dev and preview builds: where IBO calls go (docs/decisions.md D-050). Switching forgets the
// session (a token from one backend is not valid on another) and restarts the app.
export function DevNetworkSwitch() {
  const { t } = useTranslation();
  if (!NETWORK_SWITCH_ALLOWED) return null;
  const current = networkMode();
  const choose = (mode: NetworkMode) => {
    if (mode === current) return;
    saveNetworkMode(mode);
    resetAppData();
    void reloadAppAsync("Network mode changed");
  };
  return (
    <View style={styles.root}>
      <AppText variant="meta" color="tertiary">
        {t("mobile_dev_network")}
      </AppText>
      <View style={styles.row}>
        {NETWORK_MODES.map((mode) => {
          const selected = mode === current;
          return (
            <Pressable
              key={mode}
              testID={`dev-network-${mode}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => choose(mode)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <AppText variant="meta" color={selected ? "inverse" : "primary"}>
                {t(LABELS[mode])}
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
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm },
  chip: {
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.text.tertiary,
  },
  chipSelected: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },
});
