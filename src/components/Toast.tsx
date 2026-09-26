import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";

import { TOAST_MS } from "@/content/rules/app";
import { colors, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";

// Toast (design-system.md §5, R-131): a bottom snackbar on surface.2 for 4 s, with the TV texts
// ("title / text").
interface ToastMessage {
  id: number;
  title?: string;
  text: string;
}

interface ToastState {
  current?: ToastMessage;
}

const useToastStore = create<ToastState>()(() => ({}));
let nextId = 1;

export function showToast(message: { title?: string; text: string }): void {
  useToastStore.setState({ current: { ...message, id: nextId++ } });
}

export function ToastHost() {
  const current = useToastStore((s) => s.current);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => {
      if (useToastStore.getState().current?.id === current.id)
        useToastStore.setState({ current: undefined });
    }, TOAST_MS);
    return () => clearTimeout(timer);
  }, [current]);
  if (!current) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.host, { bottom: insets.bottom + spacing.giant + spacing.lg }]}
    >
      <Animated.View
        key={current.id}
        entering={FadeIn}
        exiting={FadeOut}
        style={styles.toast}
        accessibilityLiveRegion="polite"
        testID="toast"
      >
        {current.title ? <AppText variant="bodyStrong">{current.title}</AppText> : null}
        <AppText variant="meta">{current.text}</AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", start: spacing.lg, end: spacing.lg, alignItems: "center" },
  toast: {
    width: "100%",
    backgroundColor: colors.surface[2],
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.xxs,
  },
});
