import type { ReactNode } from "react";
import { I18nManager, Pressable, StyleSheet, Switch, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { colors, layout, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";

// SettingsRow (design-system.md §5): title, value or subtitle, and a chevron, a switch or a
// custom trailing element. Pressed: surface.2.
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
          accessibilityLabel={title}
          value={toggle.value}
          onValueChange={toggle.onChange}
          trackColor={{ true: colors.brand.primary, false: colors.surface[3] }}
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
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
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
    backgroundColor: colors.surface[1],
  },
  pressed: { backgroundColor: colors.surface[2] },
  text: { flex: 1, gap: spacing.xxs },
  // Chevrons point along the reading direction.
  mirror: { transform: [{ scaleX: -1 }] },
});
