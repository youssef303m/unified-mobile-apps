import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { LOADING_WATCHDOG_MS } from "@/content/rules/startup";
import { colors, layout, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";
import { Button } from "./Button";
import { CopyRow } from "./CopyRow";

const splashLogo = require("../../assets/brand/splash-logo-dark-bg-1024.png") as number;

/** screens.md Splash: after 10 s on one step, a Retry button appears. */
export const RETRY_AFTER_MS = 10_000;

export interface LoadingViewProps {
  /** The boot or load step, already translated. */
  status: string;
  onRetry?: () => void;
  /** R-011: the "Stuck on loading screen?" actions after 120 s. */
  stuck?: { onChangePlaylist: () => void; onRestart: () => void };
  macAddress?: string;
  deviceKey?: string;
}

/** The splash / loading screen (screens.md Splash, current-app-inventory.md §1). */
export function LoadingView({ status, onRetry, stuck, macAddress, deviceKey }: LoadingViewProps) {
  const { t } = useTranslation();
  // The status the Retry timer fired for: a new step hides the button again.
  const [retryFor, setRetryFor] = useState<string | undefined>();
  const retryVisible = retryFor === status;
  const [stuckVisible, setStuckVisible] = useState(false);

  useEffect(() => {
    if (!onRetry) return;
    const timer = setTimeout(() => setRetryFor(status), RETRY_AFTER_MS);
    return () => clearTimeout(timer);
  }, [status, onRetry]);

  const watchdog = stuck !== undefined;
  useEffect(() => {
    if (!watchdog) return;
    const timer = setTimeout(() => setStuckVisible(true), LOADING_WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [watchdog]);

  return (
    <SafeAreaView style={styles.root} testID="loading-screen">
      <View style={styles.center}>
        <Image
          source={splashLogo}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="IBOPlayer"
        />
        <ActivityIndicator color={colors.brand.primary} size="large" />
        <AppText
          variant="meta"
          color="secondary"
          testID="boot-status"
          accessibilityLiveRegion="polite"
        >
          {status}
        </AppText>
        {retryVisible && onRetry ? (
          <Button
            label={t("try_again")}
            variant="secondary"
            onPress={onRetry}
            testID="boot-retry"
          />
        ) : null}
      </View>
      {stuck ? (
        <Modal
          visible={stuckVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setStuckVisible(false)}
        >
          <View style={styles.scrim}>
            <View style={styles.sheet} testID="stuck-panel">
              <ScrollView contentContainerStyle={styles.sheetContent}>
                <AppText variant="h3">{t("stuck_on_loading")}</AppText>
                <AppText color="secondary">{t("stuck_on_loading_desc")}</AppText>
                <AppText variant="bodyStrong">{t("add_playlist_instructions_title")}</AppText>
                <AppText color="secondary">{t("navigate_to_manage_playlists")}</AppText>
                {macAddress ? (
                  <CopyRow label={t("enter_mac_address_label")} value={macAddress} />
                ) : null}
                {deviceKey ? (
                  <CopyRow label={t("enter_device_key_label")} value={deviceKey} />
                ) : null}
                <Button
                  label={t("change_playlist")}
                  variant="brand"
                  onPress={() => {
                    setStuckVisible(false);
                    stuck.onChangePlaylist();
                  }}
                  testID="stuck-change-playlist"
                />
                <Button label={t("restart_app")} variant="secondary" onPress={stuck.onRestart} />
                <Button
                  label={t("dismiss")}
                  variant="ghost"
                  onPress={() => setStuckVisible(false)}
                  testID="stuck-dismiss"
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxl,
    padding: layout.gutter,
  },
  logo: { width: layout.splashLogoWidth, height: layout.splashLogoWidth },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.shadow },
  sheet: {
    backgroundColor: colors.bg.elevated,
    borderTopStartRadius: radius.sheet,
    borderTopEndRadius: radius.sheet,
    maxHeight: "85%",
  },
  sheetContent: { padding: layout.gutter, gap: spacing.md },
});
