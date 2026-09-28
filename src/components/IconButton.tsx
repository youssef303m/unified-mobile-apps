import { Pressable, StyleSheet } from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { colors, layout, spacing } from "@/theme/tokens";
import { maxFontSizeMultiplier } from "@/theme/typography";

import { AppText } from "./AppText";

// An icon action with a 48 dp touch target (design-system.md §3, §6): outline icons, filled when
// toggled (♥ favourite, ✓ in My List). An optional caption sits under the icon (the hero's
// "My List" and "Info").
export interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  caption?: string;
  filled?: boolean;
  color?: string;
  size?: number;
  disabled?: boolean;
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
  testID,
}: IconButtonProps) {
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
      <Icon
        size={size}
        color={color}
        fill={filled ? color : "none"}
        strokeWidth={layout.iconStroke}
      />
      {caption ? (
        <AppText variant="caption" maxFontSizeMultiplier={maxFontSizeMultiplier}>
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
    gap: spacing.xxs,
  },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
});
