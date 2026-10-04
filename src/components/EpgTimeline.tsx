import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Rewind } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import type { GuideRow } from "@/browse/guide";
import type { CatalogueItem } from "@/content/types";
import { artwork, colors, radius, spacing } from "@/theme/tokens";
import type { GuideProgramme } from "@/utils/epgTime";

import { AppText } from "./AppText";
import { Artwork } from "./Artwork";
import { Skeleton } from "./Skeleton";

// EpgTimeline (design-system.md §5): a horizontally scrolling time grid (1 hour = 240 dp), rows as
// tall as ChannelRow, a now-line in brand.vivid, a catch-up icon on past programmes with an
// archive, and sticky channel logos. Only the rows near the screen render their programmes
// (R-096: ±10 rows around the visible ones load and render).
export const HOUR_WIDTH = 240;
export const ROW_HEIGHT = artwork.channelLogo.height + spacing.lg;
const LOGO_COLUMN = 88;
const RULER_HEIGHT = 32;
const DAY_WIDTH = HOUR_WIDTH * 24;
const WINDOW_ROWS = 10;
const HOUR_MS = 3_600_000;

export interface EpgTimelineProps {
  channels: readonly CatalogueItem[];
  rowFor: (channel: CatalogueItem) => GuideRow;
  /** Local midnight of the day shown. */
  day: Date;
  now: Date;
  canReplay: (channel: CatalogueItem) => boolean;
  /** The rows near the screen changed (first and last index). */
  onVisibleRows: (first: number, last: number) => void;
  onPressProgramme: (channel: CatalogueItem, programme: GuideProgramme) => void;
  onPressChannel: (channel: CatalogueItem) => void;
  /** A new value scrolls to the current time. */
  scrollToNow: number;
  testID?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function Ruler() {
  return (
    <View style={styles.ruler}>
      {Array.from({ length: 24 }, (_, h) => (
        <View key={h} style={styles.hour}>
          <AppText variant="caption" color="secondary">{`${pad(h)}:00`}</AppText>
        </View>
      ))}
    </View>
  );
}

function Cell({
  programme,
  dayStart,
  now,
  replay,
  onPress,
}: {
  programme: GuideProgramme;
  dayStart: number;
  now: number;
  replay: boolean;
  onPress: () => void;
}) {
  const start = Math.max(programme.start.getTime(), dayStart);
  const stop = Math.min(programme.stop.getTime(), dayStart + 24 * HOUR_MS);
  const left = ((start - dayStart) / HOUR_MS) * HOUR_WIDTH;
  const width = Math.max(2, ((stop - start) / HOUR_MS) * HOUR_WIDTH - 2);
  const past = programme.stop.getTime() <= now;
  const current = programme.start.getTime() <= now && now < programme.stop.getTime();
  const { t } = useTranslation();
  const title = programme.title || t("mobile_no_title");
  const times = `${clock(programme.start)} – ${clock(programme.stop)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${times}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        { left, width },
        past && styles.past,
        current && styles.current,
        pressed && styles.pressed,
      ]}
      testID={`guide-cell-${programme.start.getTime()}`}
    >
      <View style={styles.cellTitle}>
        {past && replay && programme.archive ? (
          <View testID="guide-archive">
            <Rewind size={12} color={colors.text.secondary} />
          </View>
        ) : null}
        <AppText
          variant="meta"
          numberOfLines={1}
          style={styles.flex}
          color={past ? "secondary" : "primary"}
        >
          {title}
        </AppText>
      </View>
      <AppText variant="caption" color="tertiary" numberOfLines={1}>
        {times}
      </AppText>
    </Pressable>
  );
}

function Strip({
  row,
  dayStart,
  now,
  replay,
  onPress,
}: {
  row: GuideRow;
  dayStart: number;
  now: number;
  replay: boolean;
  onPress: (p: GuideProgramme) => void;
}) {
  const { t } = useTranslation();
  if (row.status === "loading")
    return <Skeleton width={HOUR_WIDTH * 2} height={ROW_HEIGHT - spacing.md} />;
  if (row.status === "error")
    return (
      <AppText variant="meta" color="tertiary" style={styles.note}>
        {t("msg_failed_to_load_epg_for_this_channel")}
      </AppText>
    );
  const dayEnd = dayStart + 24 * HOUR_MS;
  const inDay = row.programmes.filter(
    (p) => p.stop.getTime() > dayStart && p.start.getTime() < dayEnd,
  );
  if (inDay.length === 0)
    return (
      <AppText variant="meta" color="tertiary" style={styles.note}>
        {t("msg_no_epg_available_for_current_channel")}
      </AppText>
    );
  return (
    <>
      {inDay.map((p) => (
        <Cell
          key={p.start.getTime()}
          programme={p}
          dayStart={dayStart}
          now={now}
          replay={replay}
          onPress={() => onPress(p)}
        />
      ))}
    </>
  );
}

function scrollX(ref: RefObject<ScrollView | null>, x: number, animated: boolean) {
  ref.current?.scrollTo({ x: Math.max(0, x), animated });
}

export function EpgTimeline(props: EpgTimelineProps) {
  const { channels, day, now, onVisibleRows } = props;
  const header = useRef<ScrollView>(null);
  const body = useRef<ScrollView>(null);
  const [span, setSpan] = useState({ first: 0, last: WINDOW_ROWS * 2 });
  const dayStart = day.getTime();
  const nowMs = now.getTime();
  const nowX = ((nowMs - dayStart) / HOUR_MS) * HOUR_WIDTH;
  const today = nowMs >= dayStart && nowMs < dayStart + 24 * HOUR_MS;

  const report = (offsetY: number, height: number) => {
    const firstVisible = Math.max(0, Math.floor((offsetY - RULER_HEIGHT) / ROW_HEIGHT));
    const lastVisible = Math.min(
      channels.length - 1,
      firstVisible + Math.ceil(height / ROW_HEIGHT),
    );
    onVisibleRows(firstVisible, lastVisible);
    const next = {
      first: Math.max(0, firstVisible - WINDOW_ROWS),
      last: Math.min(channels.length - 1, lastVisible + WINDOW_ROWS),
    };
    if (next.first !== span.first || next.last !== span.last) setSpan(next);
  };

  // "Now" (and opening the guide on today): the current time, a little in from the start edge.
  useEffect(() => {
    const x = today ? nowX - HOUR_WIDTH / 2 : 0;
    const timer = setTimeout(() => {
      scrollX(body, x, props.scrollToNow > 0);
      scrollX(header, x, false);
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.scrollToNow, dayStart]);

  const onVertical = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    report(e.nativeEvent.contentOffset.y, e.nativeEvent.layoutMeasurement.height);
  const onHorizontal = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    scrollX(header, e.nativeEvent.contentOffset.x, false);

  return (
    <ScrollView
      stickyHeaderIndices={[0]}
      onScroll={onVertical}
      scrollEventThrottle={64}
      // The first rows load once the grid knows its height.
      onLayout={(e) => report(0, e.nativeEvent.layout.height)}
      style={styles.ltr}
      testID={props.testID}
    >
      <View style={styles.headerRow}>
        <View style={styles.corner} />
        <ScrollView
          ref={header}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
        >
          <Ruler />
        </ScrollView>
      </View>
      <View style={styles.bodyRow}>
        <View>
          {channels.map((channel) => (
            <Pressable
              key={channel.item_id}
              accessibilityRole="button"
              accessibilityLabel={channel.name}
              onPress={() => props.onPressChannel(channel)}
              style={styles.logoCell}
              testID={`guide-channel-${channel.item_id}`}
            >
              <Artwork uri={channel.icon} style={styles.logo} contentFit="contain" />
              <AppText variant="caption" numberOfLines={1} style={styles.logoName}>
                {channel.num !== undefined ? `${channel.num} ${channel.name}` : channel.name}
              </AppText>
            </Pressable>
          ))}
        </View>
        <ScrollView
          ref={body}
          horizontal
          onScroll={onHorizontal}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
        >
          <View style={{ width: DAY_WIDTH }}>
            {channels.map((channel, i) => (
              <View key={channel.item_id} style={styles.row}>
                {i >= span.first && i <= span.last ? (
                  <Strip
                    row={props.rowFor(channel)}
                    dayStart={dayStart}
                    now={nowMs}
                    replay={props.canReplay(channel)}
                    onPress={(p) => props.onPressProgramme(channel, p)}
                  />
                ) : null}
              </View>
            ))}
            {today ? (
              <View style={[styles.nowLine, { left: nowX }]} testID="guide-now-line" />
            ) : null}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // The time axis runs left to right in every language.
  ltr: { direction: "ltr" },
  flex: { flex: 1 },
  headerRow: { flexDirection: "row", backgroundColor: colors.bg.base, height: RULER_HEIGHT },
  corner: { width: LOGO_COLUMN },
  ruler: { flexDirection: "row", width: DAY_WIDTH, height: RULER_HEIGHT },
  hour: {
    width: HOUR_WIDTH,
    justifyContent: "center",
    paddingStart: spacing.xs,
    borderStartWidth: 1,
    borderColor: colors.border.subtle,
  },
  bodyRow: { flexDirection: "row" },
  logoCell: {
    width: LOGO_COLUMN,
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.bg.base,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
  },
  logo: { width: 40, height: 32, backgroundColor: "transparent" },
  logoName: { maxWidth: LOGO_COLUMN - spacing.sm },
  row: {
    height: ROW_HEIGHT,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
  },
  cell: {
    position: "absolute",
    top: spacing.xs,
    bottom: spacing.xs,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.badge + 2,
    backgroundColor: colors.surface[2],
  },
  past: { backgroundColor: colors.surface[1] },
  current: {
    backgroundColor: colors.surface[3],
    borderWidth: 1,
    borderColor: colors.brand.vivid,
  },
  pressed: { opacity: 0.7 },
  cellTitle: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  note: { paddingHorizontal: spacing.sm },
  nowLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.brand.vivid,
  },
});
