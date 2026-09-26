import { StyleSheet } from "react-native";
import { Stack } from "expo-router";

import { accountOk, contentReady, useSession } from "@/session/store";
import { colors } from "@/theme/tokens";

/**
 * The root stack. R-006: without a valid account nothing but the boot screens is reachable; the
 * tabs also need a loaded playlist. A blocked route falls back to the splash, which boots again.
 */
export function AppStack() {
  const canUseAccount = useSession(accountOk);
  const canBrowse = useSession(contentReady);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: styles.root }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(boot)" />
      <Stack.Screen name="loading" options={{ gestureEnabled: false }} />
      <Stack.Screen name="dev" />
      <Stack.Screen name="gallery" />
      <Stack.Protected guard={canBrowse}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="movie/[id]" />
        <Stack.Screen name="series/[id]" />
        <Stack.Screen name="category" />
        <Stack.Screen name="search" options={{ animation: "fade" }} />
      </Stack.Protected>
      <Stack.Protected guard={canUseAccount}>
        <Stack.Screen name="account" />
        <Stack.Screen name="playlists/index" />
        <Stack.Screen name="playlists/add" />
        <Stack.Screen name="portals/index" />
        <Stack.Screen name="portals/add" />
        <Stack.Screen name="settings/parental" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
});
