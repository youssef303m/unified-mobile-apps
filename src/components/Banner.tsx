import { StyleSheet, View } from "react-native";
import { CircleAlert, TriangleAlert } from "lucide-react-native";

import { colors, layout, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";
import { Button } from "./Button";

// A message banner: status.danger for errors (the Playlists screen after a failed load, a
// section that failed to download), status.warning for notices (offline), with an optional
// action.
export interface BannerProps {
  lines: string[];
  tone?: "danger" | "warning";
  action?: { label: string; onPress: () => void };
  testID?: string;
}

export function Banner({ lines, tone = "danger", action, testID }: BannerProps) {
  const color = tone === "danger" ? colors.status.danger : colors.status.warning;
  const Icon = tone === "danger" ? CircleAlert : TriangleAlert;
  return (
    <View
      style={[styles.root, { borderStartColor: color }]}
      testID={testID}
      accessibilityRole="alert"
    >
      <Icon size={layout.iconSize} color={color} />
      <View style={styles.text}>
        {lines.map((line) => (
          <AppText key={line} variant="meta">
            {line}
          </AppText>
        ))}
        {action ? (
          <View style={styles.action}>
            <Button label={action.label} onPress={action.onPress} variant="secondary" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.card,
    backgroundColor: colors.card.bg,
    borderStartWidth: 3,
  },
  text: { flex: 1, gap: spacing.xs },
  action: { alignSelf: "flex-start", marginTop: spacing.xs },
});
