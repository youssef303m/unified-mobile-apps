import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotion } from "@/hooks/useReduceMotion";

import { motion } from "@/theme/tokens";

// The card press effect (design-system.md §7): scale 0.96 in 120 ms, ease-out; none when the
// system asks to reduce motion.
export interface PressableScaleProps extends Omit<PressableProps, "style" | "children"> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

const timing = { duration: motion.pressMs, easing: Easing.out(Easing.quad) };

export function PressableScale({
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        if (!reduceMotion) scale.set(withTiming(motion.pressScale, timing));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, timing));
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}
