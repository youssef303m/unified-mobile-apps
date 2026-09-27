import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { I18nManager, StyleSheet, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Video, { SelectedTrackType, type VideoRef } from "react-native-video";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  CalendarDays,
  Captions,
  ChevronLeft,
  ChevronRight,
  Heart,
  Rewind,
  List,
  PictureInPicture2,
  Settings2,
  SkipBack,
  SkipForward,
  Tv,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { recordChannelView } from "@/browse/library";
import { AppText } from "@/components/AppText";
import { CatchupSheet } from "@/components/CatchupSheet";
import { EmptyState } from "@/components/EmptyState";
import { IconButton } from "@/components/IconButton";
import { ListRow } from "@/components/ListRow";
import { ProgressBar } from "@/components/ProgressBar";
import { ListSheet } from "@/components/Sheet";
import { hasArchive } from "@/content/rules/live";
import type { CatalogueItem } from "@/content/types";
import { refreshBrowse } from "@/hooks/queryClient";
import { useBrowse } from "@/hooks/useBrowse";
import { useEpgNow } from "@/hooks/useEpgNow";
import { useIsFavourite, useToggleFavourite } from "@/hooks/useFavourite";
import { kvStore } from "@/storage/kv";
import { colors, layout, motion, radius, spacing } from "@/theme/tokens";
import { openGuide } from "@/utils/content";
import { epgClock } from "@/utils/epgTime";

import { aspectLayout, pinchAspect, type AspectMode } from "./aspect";
import { GestureLayer } from "./controls/GestureLayer";
import { MoreSheet } from "./controls/MoreSheet";
import { PlayerStatus } from "./controls/PlayerStatus";
import { TrackSheet, type SubtitleChoice } from "./controls/TrackSheet";
import { debounce, ZAP_DEBOUNCE_MS, zapIndex, type ZapDirection } from "./live";
import { PlayerChrome, useKeepAwakeWhile } from "./PlayerChrome";
import {
  backgroundAudioOn,
  readSubtitleStyle,
  saveSubtitleStyle,
  setBackgroundAudio,
} from "./playerSettings";
import { resolveLive } from "./resolve";
import { usePlayerStore, type LiveRequest } from "./session";
import { trackOptions } from "./tracks";
import { usePlayback } from "./usePlayback";

// The full-screen live player (03-design/screens.md "Live player", player.md §3.2/§3.3): the
// channel number and name, the programme on now with its progress and EPG ‹ › for the next ones,
// the channels panel of the category, catch-up when the channel has an archive, audio, subtitles,
// aspect and favourite. Zapping (buttons, or a swipe up/down on the channel name, N-04) moves
// within the category, clamps at the ends and starts after 400 ms. No pause on live (parity).

const SWIPE_ZAP_PX = 40;

export function LivePlayerScreen() {
  const { t } = useTranslation();
  const request = usePlayerStore((s) => s.live);
  if (!request || request.channels.length === 0) {
    return (
      <View style={styles.empty}>
        <EmptyState
          icon={Tv}
          title={t("msg_stream_could_not_be_started")}
          action={{ label: t("back"), onPress: () => router.back() }}
        />
      </View>
    );
  }
  return <LivePlayer key={request.id} request={request} />;
}

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function LivePlayer({ request }: { request: LiveRequest }) {
  const { t, i18n } = useTranslation();
  const ctx = useBrowse();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { channels, adultCategories } = request;
  const [index, setIndex] = useState(request.index);
  const [playIndex, setPlayIndex] = useState(request.index);
  const channel = channels[index] as CatalogueItem;
  const playing = channels[playIndex] as CatalogueItem;
  const isAdult = adultCategories.includes(playing.category_id);

  const zapPlay = useMemo(() => debounce((i: number) => setPlayIndex(i), ZAP_DEBOUNCE_MS), []);
  useEffect(() => () => zapPlay.cancel(), [zapPlay]);

  const videoRef = useRef<VideoRef>(null);
  // One stream at a time: with the guide or a catch-up player on top, the live video is unmounted
  // (IPTV accounts often allow a single connection); back on top, it reloads at the live edge.
  const [focused, setFocused] = useState(true);
  const retryOnFocus = useRef<(() => void) | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      retryOnFocus.current?.();
      return () => setFocused(false);
    }, []),
  );
  const playback = usePlayback({
    playKey: `live:${playing.item_id}`,
    resolve: async () => {
      if (!ctx) throw new Error("No playlist");
      return resolveLive(ctx.catalogue.source, playing);
    },
    restoreOnReconnect: false,
    metadata: { title: playing.name, imageUri: playing.icon || undefined },
  });

  useEffect(() => {
    retryOnFocus.current = playback.retry;
  });
  const [bar, setBar] = useState(true);
  const [tick, setTick] = useState(0);
  const [sheet, setSheet] = useState<"channels" | "tracks" | "more" | "catchup" | undefined>();
  const [aspect, setAspect] = useState<{ channel: string; mode: AspectMode }>({
    channel: playing.item_id,
    mode: "fit",
  });
  const [audioIndex, setAudioIndex] = useState<{ channel: string; index: number } | undefined>();
  const [subtitle, setSubtitle] = useState<{ channel: string; choice: SubtitleChoice }>({
    channel: playing.item_id,
    choice: { kind: "off" },
  });
  const [subtitleStyle, setSubtitleStyle] = useState(() => readSubtitleStyle(kvStore));
  const [backgroundAudio, setBackgroundAudioState] = useState(() => backgroundAudioOn(kvStore));
  const [inPip, setInPip] = useState(false);
  const [epgIndex, setEpgIndex] = useState<{ channel: string; index: number }>({
    channel: channel.item_id,
    index: 0,
  });
  const now = useEpgNow(channel);
  const favourite = useIsFavourite(channel);
  const toggleFavourite = useToggleFavourite();
  const clock = useClock();

  useKeepAwakeWhile(playback.started && focused);

  // Aspect, tracks and the EPG position reset on every channel change (parity: aspect resets).
  const mode = aspect.channel === playing.item_id ? aspect.mode : "fit";
  const chosenAudio = audioIndex?.channel === playing.item_id ? audioIndex.index : undefined;
  const choice =
    subtitle.channel === playing.item_id ? subtitle.choice : ({ kind: "off" } as const);
  const programmes = now?.programmes ?? [];
  const shownIndex = epgIndex.channel === channel.item_id ? epgIndex.index : 0;
  const programme = programmes[Math.min(shownIndex, Math.max(0, programmes.length - 1))];

  // R-072 / R-063: a channel that plays goes first in Recently Viewed (never adult ones).
  const recorded = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!playback.started || !ctx || recorded.current === playing.item_id) return;
    recorded.current = playing.item_id;
    if (recordChannelView(ctx, playing, isAdult)) refreshBrowse(ctx.catalogue.playlistId);
  }, [playback.started, ctx, playing, isAdult]);

  const showBar = useCallback(() => {
    setBar(true);
    setTick((n) => n + 1);
  }, []);
  useEffect(() => {
    if (!bar || sheet) return;
    const timer = setTimeout(() => setBar(false), motion.liveBarHideMs);
    return () => clearTimeout(timer);
  }, [bar, sheet, tick]);

  const zap = (direction: ZapDirection) => {
    const next = zapIndex(channels.length, index, direction);
    if (next === undefined) return;
    setIndex(next);
    showBar();
    zapPlay.call(next);
  };
  const jump = (next: number) => {
    setSheet(undefined);
    setIndex(next);
    zapPlay.cancel();
    setPlayIndex(next);
    showBar();
  };

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY([-12, 12])
    .onEnd((e) => {
      if (e.translationY < -SWIPE_ZAP_PX) zap("next");
      else if (e.translationY > SWIPE_ZAP_PX) zap("previous");
    });

  const layoutBox = aspectLayout(mode, width, height);
  const canReplay = ctx?.catalogue.source.capabilities.replay === true && hasArchive(channel);
  const side = { paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg };
  const mirror = I18nManager.isRTL ? styles.mirror : undefined;
  const audio = trackOptions(
    playback.audioTracks.map((a) => ({
      ...a,
      selected: chosenAudio === undefined ? a.selected : a.index === chosenAudio,
    })),
    (n) => t("mobile_audio_n", { n }),
    i18n.language,
  );
  const embedded = trackOptions(
    playback.textTracks,
    (n) => t("mobile_track_n", { n }),
    i18n.language,
  );
  const resolution = playback.videoSize
    ? `${Math.round(playback.videoSize.width)} x ${Math.round(playback.videoSize.height)}`
    : undefined;

  return (
    <View style={styles.root} testID="live-player">
      {!inPip ? <PlayerChrome /> : null}
      <View style={styles.videoBox}>
        {playback.source && focused ? (
          <Video
            key={playback.videoKey}
            ref={videoRef}
            source={playback.source}
            style={{ width: layoutBox.width, height: layoutBox.height }}
            resizeMode={layoutBox.resizeMode}
            progressUpdateInterval={1000}
            selectedAudioTrack={
              chosenAudio === undefined
                ? undefined
                : { type: SelectedTrackType.INDEX, value: chosenAudio }
            }
            selectedTextTrack={
              choice.kind === "embedded"
                ? { type: SelectedTrackType.INDEX, value: choice.index }
                : { type: SelectedTrackType.DISABLED }
            }
            playInBackground={backgroundAudio}
            showNotificationControls={backgroundAudio}
            enterPictureInPictureOnLeave={playback.started}
            onPictureInPictureStatusChanged={(e) => setInPip(e.isActive)}
            onLoad={playback.handlers.onLoad}
            onReadyForDisplay={playback.handlers.onReadyForDisplay}
            onPlaybackStateChanged={playback.handlers.onPlaybackStateChanged}
            onProgress={playback.handlers.onProgress}
            onBuffer={playback.handlers.onBuffer}
            onError={playback.handlers.onError}
            onAudioTracks={playback.handlers.onAudioTracks}
            onTextTracks={playback.handlers.onTextTracks}
            // A live stream that "ends" (a finite TS file, a dropped server) reconnects.
            onEnd={() => playback.handlers.onError({ error: {} })}
            testID="live-video"
          />
        ) : null}
      </View>
      {inPip ? null : (
        <>
          <GestureLayer
            onTap={() => (bar ? setBar(false) : showBar())}
            onPinch={(out) => setAspect({ channel: playing.item_id, mode: pinchAspect(out) })}
          />
          <PlayerStatus
            playback={playback}
            onNextChannel={
              zapIndex(channels.length, index, "next") !== undefined ? () => zap("next") : undefined
            }
          />
          {bar ? (
            <Animated.View
              entering={FadeIn.duration(motion.controlsFadeMs)}
              exiting={FadeOut.duration(motion.controlsFadeMs)}
              style={styles.bar}
              pointerEvents="box-none"
              testID="live-bar"
            >
              <View style={[styles.top, side]}>
                <View style={mirror}>
                  <IconButton
                    icon={ArrowLeft}
                    label={t("back")}
                    onPress={() => router.back()}
                    testID="player-back"
                  />
                </View>
                <GestureDetector gesture={swipe}>
                  <View style={styles.name} accessibilityHint={t("mobile_swipe_to_zap")}>
                    <AppText variant="h3" numberOfLines={1} testID="live-channel-name">
                      {channel.num !== undefined ? `${channel.num}  ${channel.name}` : channel.name}
                    </AppText>
                    {resolution ? (
                      <AppText variant="caption" color="secondary">
                        {resolution}
                      </AppText>
                    ) : null}
                  </View>
                </GestureDetector>
                <AppText variant="bodyStrong" testID="live-clock">
                  {clock}
                </AppText>
              </View>

              <View style={[styles.bottom, side, { paddingBottom: insets.bottom + spacing.sm }]}>
                <View style={styles.epg}>
                  <IconButton
                    icon={ChevronLeft}
                    label={t("previous")}
                    disabled={shownIndex <= 0}
                    onPress={() => setEpgIndex({ channel: channel.item_id, index: shownIndex - 1 })}
                    testID="epg-previous"
                  />
                  <View style={styles.epgText}>
                    {programme ? (
                      <>
                        <AppText variant="bodyStrong" numberOfLines={1} testID="live-programme">
                          {`${epgClock(programme.start)} – ${epgClock(programme.stop)}  ${programme.title}`}
                        </AppText>
                        {programme === now?.current ? (
                          <ProgressBar fraction={(now?.progress ?? 0) / 100} />
                        ) : null}
                        {programme.description ? (
                          <AppText variant="meta" color="secondary" numberOfLines={1}>
                            {programme.description}
                          </AppText>
                        ) : null}
                      </>
                    ) : (
                      <AppText color="secondary">
                        {t("msg_no_epg_available_for_current_channel")}
                      </AppText>
                    )}
                  </View>
                  <IconButton
                    icon={ChevronRight}
                    label={t("next")}
                    disabled={shownIndex >= programmes.length - 1}
                    onPress={() => setEpgIndex({ channel: channel.item_id, index: shownIndex + 1 })}
                    testID="epg-next"
                  />
                </View>
                <View style={styles.buttons}>
                  <IconButton
                    icon={List}
                    label={t("channels")}
                    caption={t("channels")}
                    onPress={() => setSheet("channels")}
                    testID="live-channels"
                  />
                  <IconButton
                    icon={SkipBack}
                    label={t("mobile_previous_channel")}
                    disabled={zapIndex(channels.length, index, "previous") === undefined}
                    onPress={() => zap("previous")}
                    testID="live-previous"
                  />
                  <IconButton
                    icon={SkipForward}
                    label={t("mobile_next_channel")}
                    disabled={zapIndex(channels.length, index, "next") === undefined}
                    onPress={() => zap("next")}
                    testID="live-next"
                  />
                  {canReplay ? (
                    <IconButton
                      icon={Rewind}
                      label={t("replay")}
                      caption={t("replay")}
                      onPress={() => setSheet("catchup")}
                      testID="live-catchup"
                    />
                  ) : null}
                  {ctx?.catalogue.source.capabilities.epg ? (
                    <IconButton
                      icon={CalendarDays}
                      label={t("epg")}
                      caption={t("epg")}
                      onPress={() => openGuide(t("live_tv"), channels, adultCategories)}
                      testID="live-guide"
                    />
                  ) : null}
                  <View style={styles.grow} />
                  <IconButton
                    icon={Captions}
                    label={t("mobile_audio_subtitles")}
                    onPress={() => setSheet("tracks")}
                    testID="player-tracks"
                  />
                  <IconButton
                    icon={Settings2}
                    label={t("mobile_player_settings")}
                    onPress={() => setSheet("more")}
                    testID="player-more"
                  />
                  <IconButton
                    icon={Heart}
                    filled={favourite}
                    label={favourite ? t("remove_favorites") : t("add_to_favorite")}
                    onPress={() =>
                      toggleFavourite(channel, adultCategories.includes(channel.category_id))
                    }
                    testID="live-favourite"
                  />
                  <IconButton
                    icon={PictureInPicture2}
                    label={t("mobile_picture_in_picture")}
                    onPress={() => videoRef.current?.enterPictureInPicture()}
                    testID="player-pip"
                  />
                </View>
              </View>
            </Animated.View>
          ) : null}
          <ListSheet
            visible={sheet === "channels"}
            onClose={() => setSheet(undefined)}
            title={t("channels")}
            data={channels.map((c, i) => ({ c, i }))}
            keyExtractor={({ c }) => c.item_id}
            testID="live-channels-sheet"
            renderItem={({ c, i }) => (
              <ListRow
                title={c.num !== undefined ? `${c.num}  ${c.name}` : c.name}
                selected={i === index}
                onPress={() => jump(i)}
                testID={`live-channel-${c.item_id}`}
              />
            )}
          />
          <TrackSheet
            visible={sheet === "tracks"}
            onClose={() => setSheet(undefined)}
            audio={audio}
            onAudio={(i) => setAudioIndex({ channel: playing.item_id, index: i })}
            embedded={embedded}
            subtitle={choice}
            onSubtitle={(c) => setSubtitle({ channel: playing.item_id, choice: c })}
            style={subtitleStyle}
            onStyle={(style) => {
              setSubtitleStyle(style);
              saveSubtitleStyle(kvStore, style);
            }}
          />
          <MoreSheet
            visible={sheet === "more"}
            onClose={() => setSheet(undefined)}
            aspect={mode}
            onAspect={(m) => setAspect({ channel: playing.item_id, mode: m })}
            backgroundAudio={backgroundAudio}
            onBackgroundAudio={(on) => {
              setBackgroundAudioState(on);
              setBackgroundAudio(kvStore, on);
            }}
          />
          <CatchupSheet
            channel={sheet === "catchup" ? channel : undefined}
            onClose={() => setSheet(undefined)}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.overlay.video },
  empty: { flex: 1, backgroundColor: colors.bg.base, justifyContent: "center" },
  videoBox: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  bar: { ...StyleSheet.absoluteFill, justifyContent: "space-between" },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.overlay.scrim,
  },
  name: { flex: 1, minHeight: layout.touchTarget, justifyContent: "center" },
  bottom: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    backgroundColor: colors.overlay.panel,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  epg: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  epgText: { flex: 1, gap: spacing.xxs },
  buttons: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  grow: { flex: 1 },
  mirror: { transform: [{ scaleX: -1 }] },
});
