import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, layout } from "@/theme/tokens";

// The watch progress bar (design-system.md §5 ContinueCard): brand.primary on a translucent
// white track, 3 dp.
export interface ProgressBarProps {
  /** 0…1 */
  fraction: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ProgressBar({ fraction, style, testID }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <View
      style={[styles.track, style]}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: layout.progressBarHeight,
    backgroundColor: colors.progress.track,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: colors.brand.primary },
});
