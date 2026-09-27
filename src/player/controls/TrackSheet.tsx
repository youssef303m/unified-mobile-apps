import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Check, Minus, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { IconButton } from "@/components/IconButton";
import { ListRow } from "@/components/ListRow";
import { Sheet } from "@/components/Sheet";
import { colors, layout, radius, spacing } from "@/theme/tokens";

import {
  BG_COLOR_KEYS,
  BG_COLORS,
  stepValue,
  SUBTITLE_DELAY,
  SUBTITLE_POSITION,
  SUBTITLE_SIZE,
  TEXT_COLOR_KEYS,
  TEXT_COLORS,
  type SubtitleStyle,
} from "../playerSettings";
import type { SubtitleLanguage } from "../subtitles/lookup";
import type { TrackOption } from "../tracks";

// Audio and subtitles (player.md §5): the audio tracks; subtitles Off, the embedded tracks and the
// ibosub languages (VOD; the lookup runs when this sheet first opens); the saved style (colour
// swatches instead of the TV's arrow cycling, size, position) and the per-video delay.
export type SubtitleChoice =
  { kind: "off" } | { kind: "embedded"; index: number } | { kind: "external"; code: string };

export type ExternalState =
  { kind: "idle" | "loading" | "none" } | { kind: "ok"; languages: SubtitleLanguage[] };

export interface TrackSheetProps {
  visible: boolean;
  onClose: () => void;
  audio: TrackOption[];
  onAudio: (index: number) => void;
  embedded: TrackOption[];
  external?: ExternalState;
  subtitle: SubtitleChoice;
  onSubtitle: (choice: SubtitleChoice) => void;
  style: SubtitleStyle;
  onStyle: (style: SubtitleStyle) => void;
  /** Per video, external subtitles only; undefined hides it (live). */
  delay?: number;
  onDelay?: (delay: number) => void;
}

const SHEET_WIDTH = 560;

function Section({ title }: { title: string }) {
  return (
    <AppText variant="caption" color="secondary" style={styles.section} accessibilityRole="header">
      {title.toUpperCase()}
    </AppText>
  );
}

function Tick({ on }: { on: boolean }) {
  return on ? <Check size={layout.iconSize} color={colors.text.primary} /> : null;
}

function Stepper({
  label,
  value,
  onStep,
  testID,
}: {
  label: string;
  value: string;
  onStep: (direction: 1 | -1) => void;
  testID: string;
}) {
  return (
    <View style={styles.stepper}>
      <AppText style={styles.grow}>{label}</AppText>
      <IconButton
        icon={Minus}
        label={`${label} −`}
        onPress={() => onStep(-1)}
        testID={`${testID}-minus`}
      />
      <AppText variant="bodyStrong" style={styles.value} testID={`${testID}-value`}>
        {value}
      </AppText>
      <IconButton
        icon={Plus}
        label={`${label} +`}
        onPress={() => onStep(1)}
        testID={`${testID}-plus`}
      />
    </View>
  );
}

function Swatches({
  label,
  palette,
  names,
  value,
  onChange,
  testID,
}: {
  label: string;
  palette: readonly string[];
  names: readonly string[];
  value: string;
  onChange: (color: string) => void;
  testID: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.swatchRow}>
      <AppText style={styles.grow}>{label}</AppText>
      {palette.map((color, i) => (
        <Pressable
          key={color}
          accessibilityRole="radio"
          accessibilityState={{ selected: color === value }}
          accessibilityLabel={t(`mobile_color_${names[i] ?? "none"}` as "mobile_color_none")}
          onPress={() => onChange(color)}
          style={styles.swatchTouch}
          testID={`${testID}-${names[i]}`}
        >
          <View
            style={[
              styles.swatch,
              { backgroundColor: color },
              color === "transparent" && styles.swatchNone,
              color === value && styles.swatchOn,
            ]}
          />
        </Pressable>
      ))}
    </View>
  );
}

export function TrackSheet(props: TrackSheetProps) {
  const { t } = useTranslation();
  const { audio, embedded, external, subtitle, style, onStyle } = props;
  const isOn = (choice: SubtitleChoice) =>
    choice.kind === subtitle.kind &&
    (choice.kind !== "embedded" ||
      (subtitle.kind === "embedded" && subtitle.index === choice.index)) &&
    (choice.kind !== "external" || (subtitle.kind === "external" && subtitle.code === choice.code));
  const pick = (choice: SubtitleChoice) => props.onSubtitle(choice);

  return (
    <Sheet
      visible={props.visible}
      onClose={props.onClose}
      title={t("mobile_audio_subtitles")}
      scrollable
      maxWidth={SHEET_WIDTH}
      testID="track-sheet"
    >
      <Section title={t("audio")} />
      {audio.length === 0 ? (
        <AppText color="secondary">{t("msg_no_audios_exist")}</AppText>
      ) : (
        audio.map((track) => (
          <ListRow
            key={`a${track.index}`}
            title={track.label}
            selected={track.selected}
            trailing={<Tick on={track.selected} />}
            onPress={() => props.onAudio(track.index)}
            testID={`audio-track-${track.index}`}
          />
        ))
      )}

      <Section title={t("subtitles")} />
      <ListRow
        title={t("subtitle_off")}
        selected={isOn({ kind: "off" })}
        trailing={<Tick on={isOn({ kind: "off" })} />}
        onPress={() => pick({ kind: "off" })}
        testID="subtitle-off"
      />
      {embedded.map((track) => {
        const choice = { kind: "embedded", index: track.index } as const;
        return (
          <ListRow
            key={`e${track.index}`}
            title={track.label}
            subtitle={t("mobile_subtitle_embedded")}
            selected={isOn(choice)}
            trailing={<Tick on={isOn(choice)} />}
            onPress={() => pick(choice)}
            testID={`subtitle-embedded-${track.index}`}
          />
        );
      })}
      {external?.kind === "loading" ? (
        <ActivityIndicator color={colors.brand.primary} testID="subtitle-loading" />
      ) : null}
      {external?.kind === "none" ? (
        <AppText color="secondary" testID="subtitle-none">
          {t("no_subtitles_found")}
        </AppText>
      ) : null}
      {external?.kind === "ok"
        ? external.languages.map((language) => {
            const choice = { kind: "external", code: language.code } as const;
            return (
              <ListRow
                key={`x${language.code}`}
                title={language.label}
                selected={isOn(choice)}
                trailing={<Tick on={isOn(choice)} />}
                onPress={() => pick(choice)}
                testID={`subtitle-lang-${language.code}`}
              />
            );
          })
        : null}

      <Section title={t("subtitles_settings")} />
      <View style={[styles.preview, { backgroundColor: colors.overlay.video }]}>
        <AppText
          style={{ color: style.textColor, backgroundColor: style.bgColor }}
          testID="subtitle-preview"
        >
          {t("subtitle_preview_text")}
        </AppText>
      </View>
      <Swatches
        label={t("text_color")}
        palette={TEXT_COLORS}
        names={TEXT_COLOR_KEYS}
        value={style.textColor}
        onChange={(textColor) => onStyle({ ...style, textColor })}
        testID="subtitle-text-color"
      />
      <Swatches
        label={t("background_color")}
        palette={BG_COLORS}
        names={BG_COLOR_KEYS}
        value={style.bgColor}
        onChange={(bgColor) => onStyle({ ...style, bgColor })}
        testID="subtitle-bg-color"
      />
      <Stepper
        label={t("size")}
        value={String(style.size)}
        onStep={(d) => onStyle({ ...style, size: stepValue(SUBTITLE_SIZE, style.size, d) })}
        testID="subtitle-size"
      />
      <Stepper
        label={t("subtitle_vertical_position")}
        value={`${style.position}%`}
        onStep={(d) =>
          onStyle({ ...style, position: stepValue(SUBTITLE_POSITION, style.position, d) })
        }
        testID="subtitle-position"
      />
      {props.delay !== undefined && props.onDelay ? (
        <Stepper
          label={t("subtitle_delay")}
          value={t("mobile_seconds_delta", {
            value: `${props.delay > 0 ? "+" : ""}${props.delay}`,
          })}
          onStep={(d) => props.onDelay?.(stepValue(SUBTITLE_DELAY, props.delay ?? 0, d))}
          testID="subtitle-delay"
        />
      ) : null}
    </Sheet>
  );
}

const SWATCH = 24;

const styles = StyleSheet.create({
  section: { marginTop: spacing.sm },
  grow: { flex: 1 },
  stepper: { flexDirection: "row", alignItems: "center" },
  value: { minWidth: 56, textAlign: "center" },
  swatchRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  swatchTouch: {
    width: layout.touchTarget - spacing.sm,
    height: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    borderWidth: 1,
    borderColor: colors.text.tertiary,
  },
  swatchNone: { borderStyle: "dashed" },
  swatchOn: { borderWidth: 3, borderColor: colors.brand.primary },
  preview: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    borderRadius: radius.card,
  },
});
