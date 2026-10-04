import type { ReactNode } from "react";
import { I18nManager, Pressable, StyleSheet, Switch, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { colors, layout, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";

// SettingsRow (design-system.md §5): title, value or subtitle, and a chevron, a switch or a
// custom trailing element. Pressed: surface.2. Style A: an outlined card (docs/decisions.md D-085).
export interface ListRowProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  /** A switch instead of the chevron. */
  toggle?: { value: boolean; onChange: (value: boolean) => void };
  leading?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  testID?: string;
  selected?: boolean;
}

export function ListRow({
  title,
  subtitle,
  onPress,
  onLongPress,
  toggle,
  leading,
  trailing,
  chevron = false,
  testID,
  selected,
}: ListRowProps) {
  const body = (
    <>
      {leading}
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="meta" color="secondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {toggle ? (
        <Switch
          // The row is the one TalkBack stop for a toggle (role switch, checked state).
          importantForAccessibility="no-hide-descendants"
          accessible={false}
          value={toggle.value}
          onValueChange={toggle.onChange}
          trackColor={{ true: colors.brand.vivid, false: colors.surface[3] }}
          thumbColor={colors.text.primary}
        />
      ) : null}
      {chevron ? (
        <ChevronRight
          size={layout.iconSize}
          color={colors.text.secondary}
          style={I18nManager.isRTL ? styles.mirror : undefined}
        />
      ) : null}
    </>
  );
  // A toggle row flips from anywhere on the row (a bigger target than the switch alone).
  const press = onPress ?? (toggle ? () => toggle.onChange(!toggle.value) : undefined);
  if (!press && !onLongPress)
    return (
      <View style={styles.row} testID={testID}>
        {body}
      </View>
    );
  return (
    <Pressable
      testID={testID}
      // TalkBack: a toggle row is a switch, a row picked from a list is a radio, else a button.
      accessibilityRole={toggle ? "switch" : selected !== undefined ? "radio" : "button"}
      accessibilityLabel={toggle ? title : undefined}
      accessibilityHint={toggle ? subtitle : undefined}
      accessibilityState={
        toggle
          ? { checked: toggle.value }
          : selected === undefined
            ? undefined
            : { checked: selected, selected }
      }
      onPress={press}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: layout.touchTarget + spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.card,
    backgroundColor: colors.card.bg,
  },
  pressed: { backgroundColor: colors.surface[2] },
  text: { flex: 1, gap: spacing.xxs },
  // Chevrons point along the reading direction.
  mirror: { transform: [{ scaleX: -1 }] },
});
