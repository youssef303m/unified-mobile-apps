import { StyleSheet, View } from "react-native";
import { SkipForward, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { IconButton } from "@/components/IconButton";
import { PressableScale } from "@/components/PressableScale";
import { colors, layout, radius, spacing } from "@/theme/tokens";

import type { NextEpisodeCard as CardState } from "../queue";

// N-07: "Next episode" in the last 30 s of an episode. With autoplay on it counts down 10 s and
// has Cancel; with autoplay off it is a plain button.
export interface NextEpisodeCardProps {
  state: Exclude<CardState, { kind: "hidden" }>;
  title: string;
  onPlay: () => void;
  onCancel: () => void;
}

export function NextEpisodeCard({ state, title, onPlay, onCancel }: NextEpisodeCardProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.card} testID="next-episode-card">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${t("mobile_next_episode")}: ${title}`}
        onPress={onPlay}
        style={styles.main}
        testID="next-episode-play"
      >
        <SkipForward
          size={layout.iconSize}
          color={colors.text.inverse}
          fill={colors.text.inverse}
        />
        <View style={styles.text}>
          <AppText variant="bodyStrong" color="inverse">
            {state.kind === "countdown"
              ? t("mobile_next_episode_in", { seconds: state.seconds })
              : t("mobile_next_episode")}
          </AppText>
          <AppText variant="caption" color="inverse" numberOfLines={1}>
            {title}
          </AppText>
        </View>
      </PressableScale>
      {state.kind === "countdown" ? (
        <IconButton icon={X} label={t("cancel")} onPress={onCancel} testID="next-episode-cancel" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  main: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    maxWidth: 280,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: colors.text.primary,
  },
  text: { flexShrink: 1 },
});
