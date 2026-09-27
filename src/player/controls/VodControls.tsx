import { I18nManager, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Captions,
  ListVideo,
  Lock,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  SkipBack,
  SkipForward,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { IconButton } from "@/components/IconButton";
import { PressableScale } from "@/components/PressableScale";
import { colors, motion, spacing } from "@/theme/tokens";

import { SKIP_BUTTON_S } from "../seek";
import { SeekBar } from "./SeekBar";

// The VOD control layer (03-design/screens.md "VOD player", player.md §3.1/§3.3): top: back, the
// title, audio and subtitles, settings, PiP and lock; centre: −30 s, play/pause, +30 s (the skip
// buttons stay ±30 s, N-04); bottom: the seek bar, Previous/Next and, for series, Episodes.
export interface VodControlsProps {
  title: string;
  subtitle?: string;
  playing: boolean;
  position: number;
  duration: number;
  onBack: () => void;
  onPlayPause: () => void;
  onSkip: (deltaS: number) => void;
  onSeek: (target: number) => void;
  onScrub: (scrubbing: boolean) => void;
  onTracks: () => void;
  onMore: () => void;
  onPip?: () => void;
  onLock: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onEpisodes?: () => void;
  seekable: boolean;
}

const BIG = 56;

export function VodControls(props: VodControlsProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const side = { paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg };
  const back = I18nManager.isRTL ? styles.mirror : undefined;
  return (
    <Animated.View
      entering={FadeIn.duration(motion.controlsFadeMs)}
      exiting={FadeOut.duration(motion.controlsFadeMs)}
      style={styles.root}
      pointerEvents="box-none"
      testID="vod-controls"
    >
      <View style={[styles.top, side]}>
        <View style={back}>
          <IconButton
            icon={ArrowLeft}
            label={t("back")}
            onPress={props.onBack}
            testID="player-back"
          />
        </View>
        <View style={styles.title}>
          <AppText variant="h3" numberOfLines={1} testID="player-title">
            {props.title}
          </AppText>
          {props.subtitle ? (
            <AppText variant="meta" color="secondary" numberOfLines={1}>
              {props.subtitle}
            </AppText>
          ) : null}
        </View>
        <IconButton
          icon={Captions}
          label={t("mobile_audio_subtitles")}
          onPress={props.onTracks}
          testID="player-tracks"
        />
        <IconButton
          icon={Settings2}
          label={t("mobile_player_settings")}
          onPress={props.onMore}
          testID="player-more"
        />
        {props.onPip ? (
          <IconButton
            icon={PictureInPicture2}
            label={t("mobile_picture_in_picture")}
            onPress={props.onPip}
            testID="player-pip"
          />
        ) : null}
        <IconButton
          icon={Lock}
          label={t("mobile_lock_controls")}
          onPress={props.onLock}
          testID="player-lock"
        />
      </View>

      <View style={styles.centre} pointerEvents="box-none">
        <IconButton
          icon={RotateCcw}
          label={t("mobile_rewind", { seconds: SKIP_BUTTON_S })}
          caption={String(SKIP_BUTTON_S)}
          size={36}
          disabled={!props.seekable}
          onPress={() => props.onSkip(-SKIP_BUTTON_S)}
          testID="player-rewind"
        />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={props.playing ? t("mobile_pause") : t("mobile_play")}
          onPress={props.onPlayPause}
          style={styles.playPause}
          testID="player-play-pause"
        >
          {props.playing ? (
            <Pause size={BIG} color={colors.text.primary} fill={colors.text.primary} />
          ) : (
            <Play size={BIG} color={colors.text.primary} fill={colors.text.primary} />
          )}
        </PressableScale>
        <IconButton
          icon={RotateCw}
          label={t("mobile_forward", { seconds: SKIP_BUTTON_S })}
          caption={String(SKIP_BUTTON_S)}
          size={36}
          disabled={!props.seekable}
          onPress={() => props.onSkip(SKIP_BUTTON_S)}
          testID="player-forward"
        />
      </View>

      <View style={[styles.bottom, side, { paddingBottom: insets.bottom + spacing.sm }]}>
        <SeekBar
          position={props.position}
          duration={props.duration}
          onSeek={props.onSeek}
          onScrub={props.onScrub}
          disabled={!props.seekable}
          testID="player-seek-bar"
        />
        <View style={styles.row}>
          <IconButton
            icon={SkipBack}
            label={t("previous")}
            disabled={!props.onPrevious}
            onPress={() => props.onPrevious?.()}
            testID="player-previous"
          />
          <IconButton
            icon={SkipForward}
            label={t("next")}
            disabled={!props.onNext}
            onPress={() => props.onNext?.()}
            testID="player-next"
          />
          <View style={styles.grow} />
          {props.onEpisodes ? (
            <IconButton
              icon={ListVideo}
              label={t("mobile_episodes")}
              caption={t("mobile_episodes")}
              onPress={props.onEpisodes}
              testID="player-episodes"
            />
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
    backgroundColor: colors.overlay.scrim,
  },
  top: { flexDirection: "row", alignItems: "center", paddingTop: spacing.sm, gap: spacing.xs },
  title: { flex: 1, marginHorizontal: spacing.sm },
  centre: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.giant,
  },
  playPause: { padding: spacing.sm },
  bottom: { gap: spacing.xxs },
  row: { flexDirection: "row", alignItems: "center" },
  grow: { flex: 1 },
  mirror: { transform: [{ scaleX: -1 }] },
});
