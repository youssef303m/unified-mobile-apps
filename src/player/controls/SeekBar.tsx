import { useState } from "react";
import { I18nManager, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { colors, layout, radius, spacing } from "@/theme/tokens";
import { formatClock } from "@/utils/format";

import { SKIP_BUTTON_S } from "../seek";

// The seek bar (player.md §3.1, N-04): elapsed and remaining time, drag or tap to seek, and a
// time bubble (no thumbnail) while dragging. TalkBack adjusts it by ±30 s.
export interface SeekBarProps {
  position: number;
  duration: number;
  onSeek: (target: number) => void;
  onScrub?: (scrubbing: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

const THUMB = 14;
const TRACK = 4;

export function SeekBar({ position, duration, onSeek, onScrub, disabled, testID }: SeekBarProps) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | undefined>();
  const rtl = I18nManager.isRTL;
  const canSeek = !disabled && duration > 0;
  const shown = scrub ?? position;
  const fraction = duration > 0 ? Math.min(1, Math.max(0, shown / duration)) : 0;

  const at = (x: number) => {
    const f = width > 0 ? Math.min(1, Math.max(0, x / width)) : 0;
    return (rtl ? 1 - f : f) * duration;
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(canSeek)
    .minDistance(0)
    .onBegin((e) => {
      onScrub?.(true);
      setScrub(at(e.x));
    })
    .onUpdate((e) => setScrub(at(e.x)))
    .onEnd((e) => onSeek(at(e.x)))
    .onFinalize(() => {
      setScrub(undefined);
      onScrub?.(false);
    });

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const bubbleLeft = Math.min(
    Math.max(0, fraction * width - BUBBLE / 2),
    Math.max(0, width - BUBBLE),
  );

  return (
    <View style={styles.root}>
      <AppText variant="meta" style={styles.time} testID="seek-elapsed">
        {formatClock(shown)}
      </AppText>
      <GestureDetector gesture={pan}>
        <View
          style={styles.touch}
          onLayout={onLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t("mobile_seek_bar")}
          accessibilityValue={{
            min: 0,
            max: Math.round(duration),
            now: Math.round(shown),
            text: t("mobile_time_of", { time: formatClock(shown), total: formatClock(duration) }),
          }}
          accessibilityState={{ disabled: !canSeek }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => {
            if (!canSeek) return;
            const delta = e.nativeEvent.actionName === "increment" ? SKIP_BUTTON_S : -SKIP_BUTTON_S;
            onSeek(position + delta);
          }}
          testID={testID}
        >
          <View style={styles.track}>
            <View style={[styles.played, { width: `${fraction * 100}%` }]} />
          </View>
          {canSeek ? (
            <View style={[styles.thumb, { start: fraction * width - THUMB / 2 }]} />
          ) : null}
          {scrub !== undefined ? (
            <View style={[styles.bubble, rtl ? { right: bubbleLeft } : { left: bubbleLeft }]}>
              <AppText variant="meta">{formatClock(scrub)}</AppText>
            </View>
          ) : null}
        </View>
      </GestureDetector>
      <AppText variant="meta" color="secondary" style={styles.time} testID="seek-remaining">
        {duration > 0 ? `-${formatClock(Math.max(0, duration - shown))}` : "--:--"}
      </AppText>
    </View>
  );
}

const BUBBLE = 72;

const styles = StyleSheet.create({
  root: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  time: { minWidth: 56, textAlign: "center", fontVariant: ["tabular-nums"] },
  touch: { flex: 1, height: layout.touchTarget, justifyContent: "center" },
  track: {
    height: TRACK,
    borderRadius: TRACK / 2,
    backgroundColor: colors.progress.track,
    overflow: "hidden",
  },
  played: { height: TRACK, backgroundColor: colors.brand.primary },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.brand.primary,
  },
  bubble: {
    position: "absolute",
    bottom: layout.touchTarget - spacing.xs,
    width: BUBBLE,
    alignItems: "center",
    paddingVertical: spacing.xxs,
    borderRadius: radius.button,
    backgroundColor: colors.overlay.panel,
  },
});
