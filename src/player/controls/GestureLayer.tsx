import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import * as Brightness from "expo-brightness";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { VolumeManager } from "react-native-volume-manager";
import { Sun, Volume2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { colors, layout, radius, spacing } from "@/theme/tokens";

import { DOUBLE_TAP_S } from "../seek";

// N-04 gestures over the video: tap shows or hides the controls; double-tap left or right seeks
// −10 / +10 s (taps add up); a vertical swipe on the left half sets the window brightness and on
// the right half the media volume; pinch toggles fit and fill. The live player turns seeking off.
export interface GestureLayerProps {
  onTap: () => void;
  /** Double-tap seek; undefined turns it off (live). */
  onDoubleTapSeek?: (deltaS: number) => void;
  onPinch?: (pinchOut: boolean) => void;
  /** Screen lock: every gesture off except the tap (which shows the unlock button). */
  locked?: boolean;
  children?: ReactNode;
}

type Level = { kind: "brightness" | "volume"; value: number };

/** How much of the screen height a swipe needs for the full 0 → 1 range. */
const SWIPE_RANGE = 0.7;
const SEEK_LABEL_MS = 700;

export function GestureLayer({
  onTap,
  onDoubleTapSeek,
  onPinch,
  locked,
  children,
}: GestureLayerProps) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [level, setLevel] = useState<Level | undefined>();
  const [seekLabel, setSeekLabel] = useState<
    { side: "left" | "right"; total: number } | undefined
  >();
  // The swipe's starting level (gesture callbacks run on the JS thread: runOnJS).
  const panStart = useSharedValue<{ kind: Level["kind"]; value: number } | null>(null);

  // Taps on the same side add up on the label; it hides 700 ms after the last one.
  useEffect(() => {
    if (!seekLabel) return;
    const timer = setTimeout(() => setSeekLabel(undefined), SEEK_LABEL_MS);
    return () => clearTimeout(timer);
  }, [seekLabel]);

  const showSeek = (side: "left" | "right") => {
    const delta = side === "left" ? -DOUBLE_TAP_S : DOUBLE_TAP_S;
    setSeekLabel((prev) => ({ side, total: prev?.side === side ? prev.total + delta : delta }));
    onDoubleTapSeek?.(delta);
  };

  const single = Gesture.Tap()
    .runOnJS(true)
    .onEnd((_, ok) => ok && onTap());
  const double = Gesture.Tap()
    .runOnJS(true)
    .numberOfTaps(2)
    .enabled(!locked && onDoubleTapSeek !== undefined)
    .onEnd((e, ok) => ok && showSeek(e.x < width / 2 ? "left" : "right"));

  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(!locked)
    .activeOffsetY([-12, 12])
    .failOffsetX([-24, 24])
    .onStart((e) => {
      const kind = e.x < width / 2 ? "brightness" : "volume";
      panStart.set({ kind, value: 0.5 });
      const read =
        kind === "brightness"
          ? Brightness.getBrightnessAsync()
          : VolumeManager.getVolume().then((v) => v.volume);
      void read
        .then((value) => {
          if (panStart.get()?.kind === kind) panStart.set({ kind, value });
          setLevel({ kind, value });
        })
        .catch(() => undefined);
    })
    .onUpdate((e) => {
      const start = panStart.get();
      if (!start) return;
      const value = Math.min(1, Math.max(0, start.value - e.translationY / (height * SWIPE_RANGE)));
      setLevel({ kind: start.kind, value });
      if (start.kind === "brightness")
        void Brightness.setBrightnessAsync(value).catch(() => undefined);
      else void VolumeManager.setVolume(value, { showUI: false }).catch(() => undefined);
    })
    .onFinalize(() => {
      panStart.set(null);
      setLevel(undefined);
    });

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .enabled(!locked && onPinch !== undefined)
    .onEnd((e) => onPinch?.(e.scale > 1));

  const gesture = Gesture.Simultaneous(Gesture.Exclusive(double, single), pan, pinch);
  const LevelIcon = level?.kind === "brightness" ? Sun : Volume2;

  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill} testID="player-gestures" collapsable={false}>
        {children}
        {level ? (
          <View style={styles.level} pointerEvents="none" accessibilityLiveRegion="polite">
            <LevelIcon size={layout.iconSize} color={colors.text.primary} />
            <View style={styles.levelTrack}>
              <View style={[styles.levelFill, { height: `${level.value * 100}%` }]} />
            </View>
            <AppText variant="caption">
              {t(level.kind === "brightness" ? "mobile_brightness" : "mobile_volume")}
            </AppText>
          </View>
        ) : null}
        {seekLabel ? (
          <View
            pointerEvents="none"
            style={[styles.seek, seekLabel.side === "left" ? styles.seekLeft : styles.seekRight]}
          >
            <AppText variant="h3">
              {t("mobile_seconds_delta", {
                value: `${seekLabel.total > 0 ? "+" : "−"}${Math.abs(seekLabel.total)}`,
              })}
            </AppText>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  level: {
    position: "absolute",
    alignSelf: "center",
    top: "25%",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.overlay.panel,
  },
  levelTrack: {
    width: 6,
    height: 96,
    borderRadius: 3,
    backgroundColor: colors.progress.track,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  levelFill: { width: 6, backgroundColor: colors.text.primary },
  seek: {
    position: "absolute",
    top: "40%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.chip,
    backgroundColor: colors.overlay.panel,
  },
  seekLeft: { left: "15%" },
  seekRight: { right: "15%" },
});
