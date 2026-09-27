import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { CategoryChips } from "@/components/CategoryChips";
import { ListRow } from "@/components/ListRow";
import { Sheet } from "@/components/Sheet";
import { TextField } from "@/components/TextField";
import { spacing } from "@/theme/tokens";
import { formatClock } from "@/utils/format";

import { ASPECT_MODES, type AspectMode } from "../aspect";

// The player's other settings (player.md §3.1, §3.3): playback speed (VOD, new), aspect ratio (not
// saved), the autoplay toggle (the global `auto_play`), background audio (N-06) and Quick Seek
// (a minute number; hidden for catch-up and live).
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export interface MoreSheetProps {
  visible: boolean;
  onClose: () => void;
  aspect: AspectMode;
  onAspect: (mode: AspectMode) => void;
  backgroundAudio: boolean;
  onBackgroundAudio: (on: boolean) => void;
  /** VOD only (undefined hides them). */
  speed?: number;
  onSpeed?: (rate: number) => void;
  autoPlay?: boolean;
  onAutoPlay?: (on: boolean) => void;
  /** Quick Seek: the duration in seconds (movies and episodes). */
  quickSeekDuration?: number;
  onQuickSeek?: (seconds: number) => void;
}

const ASPECT_KEYS: Record<AspectMode, string> = {
  fit: "mobile_aspect_fit",
  fill: "mobile_aspect_fill",
  stretch: "stretch",
  "16:9": "aspect_standard",
  "4:3": "aspect_traditional",
  "21:9": "aspect_ultra_widescreen",
  "1:1": "aspect_square",
};

function QuickSeek({ duration, onSeek }: { duration: number; onSeek: (s: number) => void }) {
  const { t } = useTranslation();
  const [minute, setMinute] = useState("");
  const target = Number(minute) * 60;
  const valid = minute !== "" && Number.isInteger(Number(minute)) && Number(minute) >= 0;
  const tooLong = valid && target > duration;
  return (
    <View style={styles.block}>
      <AppText color="secondary">{t("quick_seek_desc")}</AppText>
      <TextField
        label={t("minute")}
        value={minute}
        onChangeText={(v) => setMinute(v.replace(/\D/g, ""))}
        keyboardType="number-pad"
        maxLength={4}
        error={tooLong ? `${t("msg_too_long_max_is")} ${formatClock(duration)}` : undefined}
        testID="quick-seek-minute"
      />
      <Button
        label={valid && !tooLong ? `${t("msg_seek_to")} ${formatClock(target)}` : t("msg_seek_to")}
        disabled={!valid || tooLong}
        onPress={() => onSeek(target)}
        testID="quick-seek-go"
      />
    </View>
  );
}

export function MoreSheet(props: MoreSheetProps) {
  const { t } = useTranslation();
  const { speed, onSpeed, autoPlay, onAutoPlay, quickSeekDuration, onQuickSeek } = props;
  return (
    <Sheet
      visible={props.visible}
      onClose={props.onClose}
      title={t("mobile_player_settings")}
      scrollable
      maxWidth={560}
      testID="more-sheet"
    >
      {speed !== undefined && onSpeed ? (
        <View style={styles.block}>
          <AppText variant="caption" color="secondary">
            {t("mobile_speed").toUpperCase()}
          </AppText>
          <CategoryChips
            chips={SPEEDS.map((s) => ({
              key: String(s),
              label: s === 1 ? t("normal") : `${s}×`,
              selected: s === speed,
              testID: `speed-${s}`,
            }))}
            onPress={(key) => onSpeed(Number(key))}
          />
        </View>
      ) : null}
      <View style={styles.block}>
        <AppText variant="caption" color="secondary">
          {t("aspect_ratio").toUpperCase()}
        </AppText>
        <CategoryChips
          chips={ASPECT_MODES.map((mode) => ({
            key: mode,
            label: `${t(ASPECT_KEYS[mode] as "stretch")}${mode.includes(":") ? ` ${mode}` : ""}`,
            selected: mode === props.aspect,
            testID: `aspect-${mode.replace(":", "x")}`,
          }))}
          onPress={(key) => props.onAspect(key as AspectMode)}
        />
      </View>
      {autoPlay !== undefined && onAutoPlay ? (
        <ListRow
          title={autoPlay ? t("mobile_autoplay_on") : t("autoplay_off")}
          subtitle={t("mobile_autoplay_hint")}
          toggle={{ value: autoPlay, onChange: onAutoPlay }}
          testID="autoplay-toggle"
        />
      ) : null}
      <ListRow
        title={t("mobile_background_audio")}
        subtitle={t("mobile_background_audio_hint")}
        toggle={{ value: props.backgroundAudio, onChange: props.onBackgroundAudio }}
        testID="background-audio-toggle"
      />
      {quickSeekDuration !== undefined && quickSeekDuration > 0 && onQuickSeek ? (
        <View style={styles.block}>
          <AppText variant="caption" color="secondary">
            {t("quick_seek").toUpperCase()}
          </AppText>
          <QuickSeek duration={quickSeekDuration} onSeek={onQuickSeek} />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
});
