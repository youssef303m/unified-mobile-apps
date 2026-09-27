import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, CalendarDays } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { guideDays, mobileGuideTap, startOfDay } from "@/browse/guide";
import { AppText } from "@/components/AppText";
import { CategoryChips } from "@/components/CategoryChips";
import { EmptyState } from "@/components/EmptyState";
import { EpgTimeline } from "@/components/EpgTimeline";
import { IconButton } from "@/components/IconButton";
import { Sheet } from "@/components/Sheet";
import { showToast } from "@/components/Toast";
import { hasArchive } from "@/content/rules/live";
import type { CatalogueItem } from "@/content/types";
import { useBrowse } from "@/hooks/useBrowse";
import { useGuide } from "@/hooks/useGuide";
import { usePlayerStore } from "@/player/session";
import { colors, layout, spacing } from "@/theme/tokens";
import { playCatchup, playChannel } from "@/utils/content";
import { formatYmdHm, type EpgProgramme, type GuideProgramme } from "@/utils/epgTime";

// The EPG guide (03-design/screens.md "EPG guide", R-096): the channels of the category the user
// was on, a day picker and "Now". A current programme plays the channel; a past one with an archive
// plays the catch-up (Xtream, R-097); a future one shows its details; a past one without an
// archive says there is none.
const NOW_TICK_MS = 60_000;

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), NOW_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function GuideScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const ctx = useBrowse();
  const request = usePlayerStore((s) => s.guide);
  const channels = useMemo(() => request?.channels ?? [], [request]);
  const [attempt, setAttempt] = useState(0);
  const { loader } = useGuide(channels, attempt);
  const now = useNow();
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [nowTick, setNowTick] = useState(0);
  const [details, setDetails] = useState<
    { channel: CatalogueItem; p: GuideProgramme } | undefined
  >();
  const source = ctx?.catalogue.source;
  const canReplay = useCallback(
    (c: CatalogueItem) => source?.capabilities.replay === true && hasArchive(c),
    [source],
  );

  const rows = channels.map((c) => loader?.row(c) ?? ({ status: "loading" } as const));
  const days = guideDays(rows, now);
  const probe = loader?.probe ?? "pending";
  const adult = request?.adultCategories ?? [];

  const tap = (channel: CatalogueItem, p: GuideProgramme) => {
    const action = mobileGuideTap(p, canReplay(channel), now);
    if (action === "play_live") return playChannel(channels, channels.indexOf(channel), adult);
    if (action === "details") return setDetails({ channel, p });
    if (action === "no_archive") {
      showToast({ text: t("msg_no_archive_video_available_for_this_programme") });
      return;
    }
    // The catch-up queue: that day's finished programmes with an archive.
    const row = loader?.row(channel);
    const dayKey = formatYmdHm(p.start).slice(0, 10);
    const list: EpgProgramme[] = (row?.status === "done" ? row.programmes : [])
      .filter((x) => x.archive && x.stop.getTime() <= now.getTime())
      .filter((x) => formatYmdHm(x.start).slice(0, 10) === dayKey)
      .map((x) => ({
        start: formatYmdHm(x.start),
        stop: formatYmdHm(x.stop),
        title: x.title,
        description: x.description,
      }));
    const index = list.findIndex((x) => x.start === formatYmdHm(p.start));
    playCatchup(channel, list, Math.max(0, index));
  };

  let body;
  if (!source?.guide)
    body = (
      <EmptyState icon={CalendarDays} title={t("msg_epg_is_not_available_for_this_playlist")} />
    );
  else if (channels.length === 0)
    body = <EmptyState icon={CalendarDays} title={t("msg_this_category_has_no_channels")} />;
  else if (probe === "no_epg")
    body = <EmptyState icon={CalendarDays} title={t("msg_no_epg_available_for_this_category")} />;
  else if (probe === "failed")
    body = (
      <EmptyState
        icon={CalendarDays}
        title={t("msg_epg_could_not_be_loaded_please_try")}
        action={{ label: t("try_again"), onPress: () => setAttempt((n) => n + 1) }}
      />
    );
  else
    body = (
      <EpgTimeline
        channels={channels}
        rowFor={(c) => loader?.row(c) ?? { status: "loading" }}
        day={day}
        now={now}
        canReplay={canReplay}
        onVisibleRows={(first, last) => loader?.request(channels.slice(first, last + 1))}
        onPressProgramme={tap}
        onPressChannel={(c) => playChannel(channels, channels.indexOf(c), adult)}
        scrollToNow={nowTick}
        testID="epg-timeline"
      />
    );

  const todayKey = startOfDay(now).getTime();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="guide-screen">
      <View style={[styles.header, { paddingLeft: insets.left, paddingRight: insets.right }]}>
        <IconButton
          icon={ArrowLeft}
          label={t("back")}
          onPress={() => router.back()}
          testID="guide-back"
        />
        <View style={styles.title}>
          <AppText variant="h3" numberOfLines={1}>
            {t("epg")}
          </AppText>
          {request?.title ? (
            <AppText variant="meta" color="secondary" numberOfLines={1}>
              {request.title}
            </AppText>
          ) : null}
        </View>
      </View>
      <CategoryChips
        chips={[
          { key: "now", label: t("now"), testID: "guide-now" },
          ...days.map((d) => ({
            key: String(d.getTime()),
            label:
              d.getTime() === todayKey
                ? t("mobile_today")
                : d.toLocaleDateString(i18n.language, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  }),
            selected: d.getTime() === day.getTime(),
            testID: `guide-day-${d.getTime() === todayKey ? "today" : d.getDate()}`,
          })),
        ]}
        onPress={(key) => {
          if (key === "now") {
            setDay(startOfDay(new Date()));
            setNowTick((n) => n + 1);
          } else setDay(new Date(Number(key)));
        }}
        testID="guide-days"
      />
      <View style={[styles.body, { paddingLeft: insets.left, paddingBottom: insets.bottom }]}>
        {body}
      </View>
      <Sheet
        visible={details !== undefined}
        onClose={() => setDetails(undefined)}
        title={details?.p.title || t("mobile_no_title")}
      >
        {details ? (
          <>
            <AppText variant="meta" color="secondary">
              {`${details.channel.name} · ${details.p.start.toLocaleDateString(i18n.language, { weekday: "long" })} ${formatYmdHm(details.p.start).slice(11)} – ${formatYmdHm(details.p.stop).slice(11)}`}
            </AppText>
            {details.p.description ? <AppText>{details.p.description}</AppText> : null}
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: layout.touchTarget + spacing.sm,
  },
  title: { flex: 1 },
  body: { flex: 1 },
});
