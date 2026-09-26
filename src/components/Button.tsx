import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { colors, layout, radius, spacing } from "@/theme/tokens";

import { AppText, type TextColor } from "./AppText";

// PrimaryButton / SecondaryButton (03-design/design-system.md §5): height 44, radius 6.
// "primary" is the white streaming-app button, "brand" the red one, "secondary" surface.2,
// "ghost" a text-only link button.
export type ButtonVariant = "primary" | "brand" | "secondary" | "ghost";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

const FILL: Record<ButtonVariant, { idle: string; pressed: string; text: TextColor }> = {
  primary: { idle: colors.text.primary, pressed: colors.text.secondary, text: "inverse" },
  brand: { idle: colors.brand.primary, pressed: colors.brand.primaryPressed, text: "onPrimary" },
  secondary: { idle: colors.surface[2], pressed: colors.surface[3], text: "primary" },
  ghost: { idle: "transparent", pressed: colors.surface[2], text: "primary" },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const fill = FILL[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.root,
        { backgroundColor: pressed ? fill.pressed : fill.idle },
        inactive && styles.inactive,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            color={variant === "primary" ? colors.text.inverse : colors.text.primary}
          />
        ) : (
          <AppText variant="bodyStrong" color={fill.text} numberOfLines={2}>
            {label}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
  },
  content: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  inactive: { opacity: 0.5 },
});
