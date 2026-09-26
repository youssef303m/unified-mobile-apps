import { useEffect, useState } from "react";
import { I18nManager, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotion } from "@/hooks/useReduceMotion";
import { Delete } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { colors, layout, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";

// PinPad (design-system.md §5): 4 dots and a 3×4 numeric keypad. It shakes on a wrong PIN: the
// parent remounts it with a new `key` and `shake` after a wrong attempt, which also clears it.
export const PIN_LENGTH = 4;

export interface PinPadProps {
  title: string;
  message?: string;
  error?: string;
  shake?: boolean;
  onComplete: (pin: string) => void;
  onCancel?: () => void;
  testID?: string;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "cancel", "0", "delete"] as const;
const SHAKE = 10;
const SHAKE_MS = 50;

export function PinPad({
  title,
  message,
  error,
  shake = false,
  onComplete,
  onCancel,
  testID,
}: PinPadProps) {
  const { t } = useTranslation();
  const [digits, setDigits] = useState("");
  const reduceMotion = useReduceMotion();
  const offset = useSharedValue(0);
  useEffect(() => {
    if (!shake || reduceMotion) return;
    offset.set(
      withSequence(
        withTiming(-SHAKE, { duration: SHAKE_MS }),
        withTiming(SHAKE, { duration: SHAKE_MS }),
        withTiming(-SHAKE, { duration: SHAKE_MS }),
        withTiming(SHAKE, { duration: SHAKE_MS }),
        withTiming(0, { duration: SHAKE_MS }),
      ),
    );
  }, [offset, reduceMotion, shake]);
  const shaking = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  const press = (key: (typeof KEYS)[number]) => {
    if (key === "cancel") return onCancel?.();
    if (key === "delete") return setDigits((d) => d.slice(0, -1));
    if (digits.length >= PIN_LENGTH) return;
    const next = digits + key;
    setDigits(next);
    if (next.length === PIN_LENGTH) onComplete(next);
  };

  return (
    <View style={styles.root} testID={testID}>
      <AppText variant="h3" style={styles.center} accessibilityRole="header">
        {title}
      </AppText>
      {message ? (
        <AppText color="secondary" style={styles.center}>
          {message}
        </AppText>
      ) : null}
      <Animated.View
        style={[styles.dots, shaking]}
        accessibilityLabel={t("mobile_pin_entered", { count: digits.length, total: PIN_LENGTH })}
        testID="pin-dots"
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, i < digits.length && styles.dotFilled]} />
        ))}
      </Animated.View>
      <AppText variant="meta" color="danger" style={styles.center} testID="pin-error">
        {error ?? " "}
      </AppText>
      <View style={styles.pad}>
        {KEYS.map((key) => {
          if (key === "cancel" && !onCancel) return <View key={key} style={styles.key} />;
          const label =
            key === "cancel" ? t("cancel") : key === "delete" ? t("mobile_delete_digit") : key;
          return (
            <Pressable
              key={key}
              testID={`pin-key-${key}`}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => press(key)}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
            >
              {key === "delete" ? (
                <Delete
                  size={layout.iconSize}
                  color={colors.text.primary}
                  style={I18nManager.isRTL ? styles.mirror : undefined}
                />
              ) : (
                <AppText variant={key === "cancel" ? "meta" : "h2"}>{label}</AppText>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const DOT = 14;
const KEY_HEIGHT = 56;

const styles = StyleSheet.create({
  root: { gap: spacing.md, alignItems: "stretch" },
  center: { textAlign: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: spacing.lg },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: colors.text.secondary,
  },
  dotFilled: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },
  pad: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.sm },
  key: {
    width: "33.33%",
    height: KEY_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.card,
  },
  keyPressed: { backgroundColor: colors.surface[2] },
  mirror: { transform: [{ scaleX: -1 }] },
});
