import { Pressable, ScrollView, StyleSheet } from "react-native";
import { ChevronDown, Lock, type LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { colors, elevation, layout, radius, spacing } from "@/theme/tokens";
import { maxFontSizeMultiplier } from "@/theme/typography";

import { AppText } from "./AppText";

// CategoryChips (design-system.md §5): a horizontal pill list. A chip with `dropdown` opens a
// picker sheet ("▾"). Style A (docs/decisions.md D-085): an optional leading icon; idle chips
// have a light outline, the selected one a red outline with a soft glow.
export interface Chip {
  key: string;
  label: string;
  selected?: boolean;
  dropdown?: boolean;
  locked?: boolean;
  icon?: LucideIcon;
  testID?: string;
}

export interface CategoryChipsProps {
  chips: readonly Chip[];
  onPress: (key: string) => void;
  testID?: string;
}

const ICON = 17;

export function CategoryChips({ chips, onPress, testID }: CategoryChipsProps) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
      // A tap on a chip works while the keyboard is open (Search segments).
      keyboardShouldPersistTaps="handled"
      testID={testID}
    >
      {chips.map((chip) => {
        const tint = colors.text.primary;
        const Icon = chip.icon;
        return (
          <Pressable
            key={chip.key}
            testID={chip.testID ?? `chip-${chip.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: chip.selected ?? false }}
            accessibilityLabel={
              chip.locked ? t("mobile_locked_label", { name: chip.label }) : chip.label
            }
            accessibilityHint={chip.dropdown ? t("mobile_opens_list") : undefined}
            onPress={() => onPress(chip.key)}
            style={({ pressed }) => [
              styles.chip,
              chip.selected && styles.selected,
              pressed && !chip.selected && styles.pressed,
            ]}
          >
            {chip.locked ? (
              <Lock size={ICON} color={tint} />
            ) : Icon ? (
              <Icon size={ICON} color={tint} strokeWidth={layout.iconStroke} />
            ) : null}
            <AppText
              variant="meta"
              color="primary"
              numberOfLines={1}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {chip.label}
            </AppText>
            {chip.dropdown ? <ChevronDown size={ICON} color={tint} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // A horizontal ScrollView in a column otherwise grows to fill the height.
  scroll: { flexGrow: 0 },
  // Room for the selected chip's glow.
  row: { gap: spacing.sm, paddingHorizontal: layout.gutter, paddingVertical: spacing.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: layout.touchTarget - spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.border.control,
    backgroundColor: colors.card.control,
  },
  selected: { borderColor: colors.brand.vivid, ...elevation.glowSoft },
  pressed: { backgroundColor: colors.surface[2] },
});
