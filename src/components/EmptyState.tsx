import { StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { colors, layout, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";
import { Button } from "./Button";

// EmptyState (design-system.md §5): a centred icon, h3 title and body text, with an optional
// action button.
export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  testID?: string;
}

export function EmptyState({ icon: Icon, title, body, action, testID }: EmptyStateProps) {
  return (
    <View style={styles.root} testID={testID}>
      <Icon
        size={layout.iconSize * 2}
        color={colors.text.tertiary}
        strokeWidth={layout.iconStroke}
      />
      <AppText variant="h3" style={styles.center}>
        {title}
      </AppText>
      {body ? (
        <AppText color="secondary" style={styles.center}>
          {body}
        </AppText>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" /> : null}
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
  },
  center: { textAlign: "center" },
});
