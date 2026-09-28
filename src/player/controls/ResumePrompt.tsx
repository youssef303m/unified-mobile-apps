import { useEffect, useRef } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { RESUME_PROMPT_TIMEOUT_MS } from "@/content/rules/library";
import { useScreenReader } from "@/hooks/useScreenReader";
import { colors, radius, spacing } from "@/theme/tokens";
import { formatClock } from "@/utils/format";

// R-075: "Continue from where you left" / "Do you want to resume the playback from the last
// position?" with the time, Yes and No. It closes by itself after 15 s, which counts as No.
export interface ResumePromptProps {
  position: number;
  onAnswer: (resume: boolean) => void;
}

export function ResumePrompt({ position, onAnswer }: ResumePromptProps) {
  const { t } = useTranslation();
  const answer = useRef(onAnswer);
  useEffect(() => {
    answer.current = onAnswer;
  });
  // 15 s from when it appears, however often the screen re-renders. With TalkBack on it waits
  // for an answer (reading it takes longer) and is announced.
  const screenReader = useScreenReader();
  useEffect(() => {
    if (screenReader) {
      AccessibilityInfo.announceForAccessibility(`${t("resume")}. ${t("resume_video")}`);
      return;
    }
    const timer = setTimeout(() => answer.current(false), RESUME_PROMPT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [screenReader, t]);
  return (
    <View style={styles.backdrop} testID="resume-prompt">
      <View style={styles.card} accessibilityViewIsModal>
        <AppText variant="h3" style={styles.center}>
          {t("resume")}
        </AppText>
        <AppText color="secondary" style={styles.center}>
          {t("resume_video")}
        </AppText>
        <AppText variant="h2" style={styles.center}>
          {formatClock(position)}
        </AppText>
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button label={t("yes")} onPress={() => onAnswer(true)} testID="resume-yes" />
          </View>
          <View style={styles.action}>
            <Button
              label={t("no")}
              variant="secondary"
              onPress={() => onAnswer(false)}
              testID="resume-no"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlay.scrim,
  },
  card: {
    width: 360,
    maxWidth: "90%",
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.card,
    backgroundColor: colors.bg.elevated,
  },
  center: { textAlign: "center" },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1 },
});
