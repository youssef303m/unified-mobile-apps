import { useEffect } from "react";
import { type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotion } from "@/hooks/useReduceMotion";

import { colors, motion, radius as radii } from "@/theme/tokens";

// Skeleton (design-system.md §5): a 1.2 s shimmer between surface.2 and surface.3 with the
// geometry of the real component; static when the system asks to reduce motion.
export interface SkeletonProps {
  width: DimensionValue;
  height: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width, height, radius = radii.poster, style }: SkeletonProps) {
  const reduceMotion = useReduceMotion();
  const phase = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    phase.set(withRepeat(withTiming(1, { duration: motion.shimmerLoopMs / 2 }), -1, true));
  }, [phase, reduceMotion]);
  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(phase.value, [0, 1], [colors.surface[2], colors.surface[3]]),
  }));
  return (
    <Animated.View
      testID="skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius }, animated, style]}
    />
  );
}
