import { Pressable, StyleSheet, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { IconButton } from "@/components/IconButton";
import { colors, layout, radius, spacing } from "@/theme/tokens";

import {
  BG_COLOR_KEYS,
  BG_COLORS,
  stepValue,
  SUBTITLE_POSITION,
  SUBTITLE_SIZE,
  TEXT_COLOR_KEYS,
  TEXT_COLORS,
  type SubtitleStyle,
} from "../playerSettings";

// The saved subtitle style (settings.md §2.9): a preview, colour swatches instead of the TV's
// arrow cycling, the size and the position. Used by the player's track sheet and by Settings →
// Subtitle Settings.
export function Section({ title }: { title: string }) {
  return (
    <AppText variant="caption" color="secondary" style={styles.section} accessibilityRole="header">
      {title.toUpperCase()}
    </AppText>
  );
}

export function Stepper({
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

export function SubtitleStyleEditor({
  style,
  onStyle,
}: {
  style: SubtitleStyle;
  onStyle: (style: SubtitleStyle) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
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
    </>
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
