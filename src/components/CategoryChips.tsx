import { Pressable, ScrollView, StyleSheet } from "react-native";
import { ChevronDown, Lock } from "lucide-react-native";

import { colors, layout, radius, spacing } from "@/theme/tokens";
import { maxFontSizeMultiplier } from "@/theme/typography";

import { AppText } from "./AppText";

// CategoryChips (design-system.md §5): a horizontal pill list. Selected: white fill, black text.
// Idle: a 1 dp text.tertiary outline. A chip with `dropdown` opens a picker sheet ("▾").
export interface Chip {
  key: string;
  label: string;
  selected?: boolean;
  dropdown?: boolean;
  locked?: boolean;
  testID?: string;
}

export interface CategoryChipsProps {
  chips: readonly Chip[];
  onPress: (key: string) => void;
  testID?: string;
}

const ICON = 16;

export function CategoryChips({ chips, onPress, testID }: CategoryChipsProps) {
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
        const tint = chip.selected ? colors.text.inverse : colors.text.primary;
        return (
          <Pressable
            key={chip.key}
            testID={chip.testID ?? `chip-${chip.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: chip.selected ?? false }}
            accessibilityLabel={chip.label}
            onPress={() => onPress(chip.key)}
            style={({ pressed }) => [
              styles.chip,
              chip.selected && styles.selected,
              pressed && !chip.selected && styles.pressed,
            ]}
          >
            {chip.locked ? <Lock size={ICON} color={tint} /> : null}
            <AppText
              variant="meta"
              color={chip.selected ? "inverse" : "primary"}
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
  row: { gap: spacing.sm, paddingHorizontal: layout.gutter, paddingVertical: spacing.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: layout.touchTarget - spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.text.tertiary,
  },
  selected: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },
  pressed: { backgroundColor: colors.surface[2] },
});
