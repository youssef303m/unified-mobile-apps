import { Stack } from "expo-router";

import { colors } from "@/theme/tokens";

// The onboarding stack (no tabs): terms, verification, welcome / expired, server failure.
export default function BootLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.base } }}
    />
  );
}
