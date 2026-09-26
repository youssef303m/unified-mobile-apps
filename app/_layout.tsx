import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { reloadAppAsync } from "expo";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PinPrompt } from "@/components/PinPrompt";
import { QuickActionsSheet } from "@/components/QuickActionsSheet";
import { ToastHost } from "@/components/Toast";
import { queryClient } from "@/hooks/queryClient";
import { initI18n } from "@/i18n";
import { AppStack } from "@/navigation/AppStack";
import { applyNetworkSetting } from "@/session/network";
import { fontMap } from "@/theme/fonts";
import { colors } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync();

function boot() {
  applyNetworkSetting();
  return initI18n();
}

export default function RootLayout() {
  const [booted] = useState(boot);
  // On a font error the system font (Roboto) is used, as design-system.md §2 allows.
  const [fontsLoaded, fontError] = useFonts(fontMap);
  const ready = (fontsLoaded || fontError !== null) && !booted.needsReload;

  useEffect(() => {
    if (booted.needsReload) void reloadAppAsync("Layout direction changed");
  }, [booted.needsReload]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <BottomSheetModalProvider>
            <StatusBar style="light" />
            <AppStack />
            <PinPrompt />
            <QuickActionsSheet />
            <ToastHost />
          </BottomSheetModalProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
});
