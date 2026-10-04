import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { colors, elevation, layout, radius, spacing } from "@/theme/tokens";

import { AppText, type TextColor } from "./AppText";

// PrimaryButton / SecondaryButton (03-design/design-system.md §5): height 44. "primary" is the
// white streaming-app button, "brand" the red one, "secondary" an outlined dark one, "ghost" a
// text-only link button. Style A (docs/decisions.md D-085): pills, an optional leading icon, and
// a red glow for the one main action of a screen (`glow`).
export type ButtonVariant = "primary" | "brand" | "secondary" | "ghost";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  /** Solid icon (Play). */
  fillIcon?: boolean;
  glow?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

const FILL: Record<ButtonVariant, { idle: string; pressed: string; text: TextColor }> = {
  primary: { idle: colors.text.primary, pressed: colors.text.secondary, text: "inverse" },
  brand: { idle: colors.brand.primary, pressed: colors.brand.primaryPressed, text: "onPrimary" },
  secondary: { idle: colors.card.bg, pressed: colors.surface[2], text: "primary" },
  ghost: { idle: "transparent", pressed: colors.surface[2], text: "primary" },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon: Icon,
  fillIcon = false,
  glow = false,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const fill = FILL[variant];
  const tint = colors.text[fill.text === "inverse" ? "inverse" : "primary"];
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
        variant === "secondary" && styles.outlined,
        glow && !inactive && elevation.glow,
        inactive && styles.inactive,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            color={variant === "primary" ? colors.text.inverse : colors.text.primary}
          />
        ) : (
          <>
            {Icon ? (
              <Icon size={layout.iconSize - 4} color={tint} fill={fillIcon ? tint : "none"} />
            ) : null}
            <AppText variant="bodyStrong" color={fill.text} numberOfLines={2}>
              {label}
            </AppText>
          </>
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
  content: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  outlined: { borderWidth: 1, borderColor: colors.border.control },
  inactive: { opacity: 0.5 },
});
