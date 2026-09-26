import { StyleSheet, View } from "react-native";
import { CircleAlert } from "lucide-react-native";

import { colors, layout, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";

// An error banner (status.danger), e.g. the Playlists screen after a failed load.
export function Banner({ lines, testID }: { lines: string[]; testID?: string }) {
  return (
    <View style={styles.root} testID={testID} accessibilityRole="alert">
      <CircleAlert size={layout.iconSize} color={colors.status.danger} />
      <View style={styles.text}>
        {lines.map((line) => (
          <AppText key={line} variant="meta">
            {line}
          </AppText>
        ))}
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
    backgroundColor: colors.surface[1],
    borderStartWidth: 3,
    borderStartColor: colors.status.danger,
  },
  text: { flex: 1, gap: spacing.xs },
});
