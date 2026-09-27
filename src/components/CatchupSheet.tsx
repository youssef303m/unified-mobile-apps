import { useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { loadCatchup } from "@/browse/guide";
import type { CatalogueItem } from "@/content/types";
import { need } from "@/hooks/queryClient";
import { useBrowse } from "@/hooks/useBrowse";
import { colors, spacing } from "@/theme/tokens";
import { playCatchup } from "@/utils/content";
import { epgClock, parseWallClock, type CatchupDay } from "@/utils/epgTime";

import { AppText } from "./AppText";
import { CategoryChips } from "./CategoryChips";
import { ListRow } from "./ListRow";
import { ListSheet } from "./Sheet";

// Catch-up (R-097; epg-and-catchup.md §3): the finished programmes with an archive, grouped by
// day (the latest day selected), each "HH:mm Title" with its description. A tap plays it, with
// that day's programmes as Previous/Next.
export interface CatchupSheetProps {
  channel: CatalogueItem | undefined;
  onClose: () => void;
}

const CATCHUP_STALE_MS = 5 * 60_000;

function dayLabel(day: CatchupDay, language: string): string {
  const date = parseWallClock(`${day.date} 12:00`);
  if (!date) return day.date;
  return date.toLocaleDateString(language, { weekday: "short", month: "short", day: "numeric" });
}

export function CatchupSheet({ channel, onClose }: CatchupSheetProps) {
  const { t, i18n } = useTranslation();
  const ctx = useBrowse();
  const [chosen, setChosen] = useState<{ channel: string; date: string } | undefined>();
  const query = useQuery({
    queryKey: ["catchup", ctx?.catalogue.playlistId, channel?.item_id],
    enabled: channel !== undefined && ctx !== undefined,
    staleTime: CATCHUP_STALE_MS,
    queryFn: ({ signal }) => loadCatchup(need(ctx).catalogue.source, need(channel), signal),
  });
  const result = query.data;
  const days = result?.kind === "ok" ? result.days : [];
  const date =
    (chosen?.channel === channel?.item_id ? chosen?.date : undefined) ?? days.at(-1)?.date;
  const day = days.find((d) => d.date === date);

  let message: string | undefined;
  if (query.isError || result?.kind === "error")
    message =
      result?.kind === "error" && result.reason === "bad_reply"
        ? t("something_went_wrong")
        : t("msg_something_went_wrong_or_no_epg_available");
  else if (result?.kind === "empty") message = t("msg_no_epg_available_for_current_channel");

  return (
    <ListSheet
      visible={channel !== undefined}
      onClose={onClose}
      title={channel ? `${t("replay")} · ${channel.name}` : t("replay")}
      testID="catchup-sheet"
      data={day?.programmes ?? []}
      keyExtractor={(p) => `${p.start}-${p.title}`}
      header={
        <>
          {query.isPending && channel ? <ActivityIndicator color={colors.brand.primary} /> : null}
          {message ? (
            <AppText color="secondary" style={styles.center} testID="catchup-message">
              {message}
            </AppText>
          ) : null}
          {days.length > 0 ? (
            <CategoryChips
              chips={days.map((d) => ({
                key: d.date,
                label: dayLabel(d, i18n.language),
                selected: d.date === date,
                testID: `catchup-day-${d.date}`,
              }))}
              onPress={(key) => channel && setChosen({ channel: channel.item_id, date: key })}
            />
          ) : null}
        </>
      }
      renderItem={(p) => (
        <ListRow
          title={`${epgClock(p.start)}  ${p.title}`}
          subtitle={p.description || undefined}
          onPress={() => {
            if (!channel || !day) return;
            onClose();
            playCatchup(channel, day.programmes, day.programmes.indexOf(p));
          }}
          testID={`catchup-${epgClock(p.start).replace(":", "")}`}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center", paddingVertical: spacing.md },
});
