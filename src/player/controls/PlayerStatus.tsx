import { ActivityIndicator, StyleSheet, View } from "react-native";
import { CircleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { colors, layout, radius, spacing } from "@/theme/tokens";

import type { Playback } from "../usePlayback";

// Loading, "Reconnecting...", and the failed state (player.md §6): after the 10th failed retry,
// "Can't play this stream" with the reason, Retry and, on live, Next channel (§6 Mobile).
export interface PlayerStatusProps {
  playback: Pick<Playback, "status" | "error" | "buffering" | "started" | "retry">;
  onNextChannel?: () => void;
  compact?: boolean;
}

const ERROR_TEXT = {
  access_denied: "mobile_play_error_access",
  not_found: "mobile_play_error_not_found",
  unsupported: "mobile_play_error_format",
  network: "mobile_play_error_network",
  generic: "mobile_play_error_generic",
  not_started: "msg_stream_could_not_be_started",
} as const;

export function PlayerStatus({ playback, onNextChannel, compact }: PlayerStatusProps) {
  const { t } = useTranslation();
  const { status, error, buffering, started } = playback;
  if (status === "failed") {
    return (
      <View style={styles.center} testID="player-error" accessibilityLiveRegion="assertive">
        <View style={[styles.panel, compact && styles.compact]}>
          <CircleAlert size={compact ? layout.iconSize : 40} color={colors.status.danger} />
          <AppText variant={compact ? "bodyStrong" : "h3"} style={styles.text}>
            {t("mobile_play_error_title")}
          </AppText>
          {!compact ? (
            <AppText color="secondary" style={styles.text}>
              {t(ERROR_TEXT[error ?? "generic"])}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button label={t("try_again")} onPress={playback.retry} testID="player-retry" />
            {onNextChannel ? (
              <Button
                label={t("mobile_next_channel")}
                variant="secondary"
                onPress={onNextChannel}
                testID="player-next-channel"
              />
            ) : null}
          </View>
        </View>
      </View>
    );
  }
  const reconnecting = status === "reconnecting";
  const loading = status === "resolving" || status === "loading" || !started || buffering;
  if (!reconnecting && !loading) return null;
  return (
    <View
      style={styles.center}
      pointerEvents="none"
      testID="player-loading"
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator size={compact ? "small" : "large"} color={colors.brand.primary} />
      {reconnecting ? (
        <AppText variant="meta" style={styles.reconnecting} testID="player-reconnecting">
          {t("reconnecting")}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  panel: {
    alignItems: "center",
    gap: spacing.sm,
    maxWidth: 420,
    padding: spacing.xl,
    borderRadius: radius.card,
    backgroundColor: colors.overlay.panel,
  },
  compact: { padding: spacing.md, gap: spacing.xs },
  text: { textAlign: "center" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  reconnecting: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.chip,
    backgroundColor: colors.overlay.panel,
  },
});
