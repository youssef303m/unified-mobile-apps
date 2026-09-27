import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import Video from "react-native-video";
import { Maximize2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { recordChannelView } from "@/browse/library";
import { AppText } from "@/components/AppText";
import type { CatalogueItem } from "@/content/types";
import { refreshBrowse } from "@/hooks/queryClient";
import { useBrowse } from "@/hooks/useBrowse";
import { useEpgNow } from "@/hooks/useEpgNow";
import { artwork, colors, gradients, layout, radius, spacing } from "@/theme/tokens";

import { PlayerStatus } from "./controls/PlayerStatus";
import { resolveLive } from "./resolve";
import { usePlayback } from "./usePlayback";

// The Live tab's sticky 16:9 preview (03-design/screens.md "Live", R-091): the selected channel
// plays here; a tap goes full screen. Leaving the tab stops it (one stream at a time: IPTV
// accounts often allow a single connection).
export interface MiniPlayerProps {
  channel: CatalogueItem;
  isAdult: boolean;
  onFullscreen: () => void;
}

export function MiniPlayer(props: MiniPlayerProps) {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const { width } = useWindowDimensions();
  const height = (width - layout.gutter * 2) / artwork.liveNowCard.aspect;
  return (
    <View style={[styles.frame, { height }]} testID="live-preview">
      {focused ? <MiniVideo key={props.channel.item_id} {...props} /> : null}
    </View>
  );
}

function MiniVideo({ channel, isAdult, onFullscreen }: MiniPlayerProps) {
  const { t } = useTranslation();
  const ctx = useBrowse();
  const now = useEpgNow(channel);
  const recorded = useRef(false);
  const playback = usePlayback({
    playKey: `mini:${channel.item_id}`,
    resolve: async () => {
      if (!ctx) throw new Error("No playlist");
      return resolveLive(ctx.catalogue.source, channel);
    },
    restoreOnReconnect: false,
  });
  // R-072 / R-063: a channel that plays goes first in Recently Viewed (never adult ones).
  useEffect(() => {
    if (!playback.started || !ctx || recorded.current) return;
    recorded.current = true;
    if (recordChannelView(ctx, channel, isAdult)) refreshBrowse(ctx.catalogue.playlistId);
  }, [playback.started, ctx, channel, isAdult]);
  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={onFullscreen}
      accessibilityRole="button"
      accessibilityLabel={`${channel.name}, ${t("mobile_full_screen")}`}
      testID="live-preview-open"
    >
      {playback.source ? (
        <Video
          key={playback.videoKey}
          source={playback.source}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          progressUpdateInterval={1000}
          onLoad={playback.handlers.onLoad}
          onReadyForDisplay={playback.handlers.onReadyForDisplay}
          onPlaybackStateChanged={playback.handlers.onPlaybackStateChanged}
          onProgress={playback.handlers.onProgress}
          onBuffer={playback.handlers.onBuffer}
          onError={playback.handlers.onError}
          onEnd={() => playback.handlers.onError({ error: {} })}
          testID="live-preview-video"
        />
      ) : null}
      <PlayerStatus playback={playback} compact />
      <View style={styles.caption} pointerEvents="none">
        <View style={styles.captionText}>
          <AppText variant="meta" numberOfLines={1}>
            {channel.name}
          </AppText>
          {now?.current ? (
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {now.current.title}
            </AppText>
          ) : null}
        </View>
        <Maximize2 size={layout.iconSize - spacing.xs} color={colors.text.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    marginHorizontal: layout.gutter,
    marginBottom: spacing.sm,
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: colors.overlay.video,
    boxShadow: `0px -4px 16px ${colors.shadow}`,
  },
  caption: {
    position: "absolute",
    start: 0,
    end: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    experimental_backgroundImage: gradients.fadeBottom,
  },
  captionText: { flex: 1 },
});
