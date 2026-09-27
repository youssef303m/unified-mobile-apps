import { ActivityIndicator } from "react-native";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { ListRow } from "@/components/ListRow";
import { Sheet } from "@/components/Sheet";
import { colors, layout } from "@/theme/tokens";

import { stepValue, SUBTITLE_DELAY, type SubtitleStyle } from "../playerSettings";
import type { SubtitleLanguage } from "../subtitles/lookup";
import type { TrackOption } from "../tracks";

import { Section, Stepper, SubtitleStyleEditor } from "./SubtitleStyleEditor";

// Audio and subtitles (player.md §5): the audio tracks; subtitles Off, the embedded tracks and the
// ibosub languages (VOD; the lookup runs when this sheet first opens); the saved style (colour
// swatches, size, position: SubtitleStyleEditor) and the per-video delay.
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

function Tick({ on }: { on: boolean }) {
  return on ? <Check size={layout.iconSize} color={colors.text.primary} /> : null;
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
      <SubtitleStyleEditor style={style} onStyle={onStyle} />
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
