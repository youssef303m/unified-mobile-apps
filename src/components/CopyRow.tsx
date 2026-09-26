import { Pressable, StyleSheet, View } from "react-native";
import { Copy } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { copyText } from "@/platform/clipboard";
import { colors, layout, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";
import { showToast } from "./Toast";

// "Device ID  AB:CD:…  ⧉": a label, a value and a copy button (screens.md, Activation card).
export function CopyRow({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID?: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText variant="meta" color="secondary">
          {label}
        </AppText>
        <AppText variant="bodyStrong" selectable testID={testID}>
          {value || "—"}
        </AppText>
      </View>
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("mobile_copy_value", { label })}
          onPress={() => {
            copyText(value);
            showToast({ text: t("mobile_copied") });
          }}
          style={styles.copy}
          testID={testID ? `${testID}-copy` : undefined}
        >
          <Copy size={layout.iconSize} color={colors.text.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  text: { flex: 1, gap: spacing.xxs },
  copy: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
});
