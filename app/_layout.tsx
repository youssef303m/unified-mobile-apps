import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { reloadAppAsync } from "expo";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initI18n } from "@/i18n";
import { fontMap } from "@/theme/fonts";
import { colors } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [boot] = useState(initI18n);
  // On a font error the system font (Roboto) is used, as design-system.md §2 allows.
  const [fontsLoaded, fontError] = useFonts(fontMap);
  const ready = (fontsLoaded || fontError !== null) && !boot.needsReload;

  useEffect(() => {
    if (boot.needsReload) void reloadAppAsync("Layout direction changed");
  }, [boot.needsReload]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: styles.root }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
});
