import { Pressable, StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { colors, layout, spacing } from "@/theme/tokens";
import { maxFontSizeMultiplier } from "@/theme/typography";

import { AppText } from "./AppText";

// An icon action with a 48 dp touch target (design-system.md §3, §6): outline icons, filled when
// toggled (♥ favourite, ✓ in My List). An optional caption sits under the icon (the hero's
// "My List" and "Info"). Style A's "circle" draws the icon in an outlined round button (D-085);
// "overArt" darkens it for artwork behind.
export interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  caption?: string;
  filled?: boolean;
  color?: string;
  size?: number;
  disabled?: boolean;
  variant?: "plain" | "circle" | "overArt";
  /** The circle's outline (the red Play of a download row). */
  ringColor?: string;
  testID?: string;
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  caption,
  filled = false,
  color = colors.text.primary,
  size = layout.iconSize,
  disabled = false,
  variant = "plain",
  ringColor,
  testID,
}: IconButtonProps) {
  const icon = (
    <Icon
      size={variant === "plain" ? size : Math.min(size, layout.iconSize - 2)}
      color={color}
      fill={filled ? color : "none"}
      strokeWidth={layout.iconStroke}
    />
  );
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      // The visible caption is part of the name (Voice Access says what it shows).
      accessibilityLabel={caption && !label.includes(caption) ? `${caption}, ${label}` : label}
      accessibilityState={{ selected: filled, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={spacing.xs}
      style={({ pressed }) => [styles.root, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {variant === "plain" ? (
        icon
      ) : (
        <View
          style={[
            styles.circle,
            variant === "overArt" && styles.overArt,
            ringColor !== undefined && { borderColor: ringColor },
          ]}
        >
          {icon}
        </View>
      )}
      {caption ? (
        <AppText
          variant={variant === "plain" ? "caption" : "meta"}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
        >
          {caption}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  circle: {
    width: layout.circleButton,
    height: layout.circleButton,
    borderRadius: layout.circleButton / 2,
    borderWidth: 1.5,
    borderColor: colors.border.control,
    backgroundColor: colors.card.control,
    alignItems: "center",
    justifyContent: "center",
  },
  overArt: { backgroundColor: colors.card.controlOverArt },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
});
