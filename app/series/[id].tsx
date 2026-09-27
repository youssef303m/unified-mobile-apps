import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Check, Clapperboard } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { CategoryChips } from "@/components/CategoryChips";
import { EmptyState } from "@/components/EmptyState";
import { EpisodeRow, type DownloadState, type EpisodeRowProps } from "@/components/EpisodeRow";
import { ListRow } from "@/components/ListRow";
import { Sheet } from "@/components/Sheet";
import { showToast } from "@/components/Toast";
import { useArtwork, useSeriesDetails } from "@/hooks/useDetails";
import { useDownloadAction, type DownloadUiState } from "@/hooks/useDownloadAction";
import { useIsFavourite, useToggleFavourite } from "@/hooks/useFavourite";
import { DetailsLayout } from "@/screens/DetailsLayout";
import { colors, layout, spacing } from "@/theme/tokens";
import { playEpisode } from "@/utils/content";
import { durationParts } from "@/utils/format";
import type { CatalogueItem, Episode } from "@/content/types";

const ROW_STATE: Record<DownloadUiState, DownloadState> = {
  idle: "idle",
  queued: "queued",
  paused: "queued",
  downloading: "downloading",
  done: "done",
  failed: "error",
};

/** An episode row with its download button (N-03). */
function SeriesEpisode({
  series,
  episode,
  isAdult,
  ...row
}: Omit<EpisodeRowProps, "download"> & {
  series: CatalogueItem;
  episode: Episode;
  isAdult: boolean;
}) {
  const download = useDownloadAction(
    { kind: "episode", series, episode },
    { title: episode.title, seriesName: series.name, poster: series.icon, isAdult },
  );
  return (
    <EpisodeRow
      {...row}
      download={
        download
          ? { state: ROW_STATE[download.state], onPress: download.onPress, label: download.label }
          : undefined
      }
    />
  );
}

// Series details (03-design/screens.md, user-flows.md §8 Mobile): the details header, Play or
// Continue on the last watched episode (R-076), the season picker (seasons sorted, empty ones
// removed) and the episodes with their progress (R-073). No seasons → the TV toast and back.
export default function SeriesDetailsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item, details, playTarget, resumes } = useSeriesDetails(id);
  const found = item.data?.item;
  const result = details.data;
  const ok = result?.kind === "ok" ? result.details : undefined;
  const art = useArtwork("series", ok?.info.tmdbId);
  const favourite = useIsFavourite(found);
  const toggle = useToggleFavourite();
  const [chosenSeason, setChosenSeason] = useState<number | undefined>();
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (result?.kind !== "no_seasons") return;
    showToast({ text: t("msg_no_seasons_available") });
    router.back();
  }, [result?.kind, t]);

  if (item.isPending)
    return <ActivityIndicator style={styles.center} color={colors.brand.primary} size="large" />;
  if (!found)
    return (
      <View style={styles.center}>
        <EmptyState
          icon={Clapperboard}
          title={t("mobile_item_not_found")}
          action={{ label: t("back"), onPress: () => router.back() }}
        />
      </View>
    );

  const isAdult = item.data?.isAdult ?? false;
  const seasons = ok?.seasons ?? [];
  const seasonNumber = chosenSeason ?? playTarget?.season.number ?? seasons[0]?.number;
  const season = seasons.find((s) => s.number === seasonNumber);
  const target = playTarget;
  const playLabel = target
    ? target.resume
      ? t("mobile_continue_episode", { s: target.season.number, e: target.episode.episodeNumber })
      : t("mobile_play_episode", { s: target.season.number, e: target.episode.episodeNumber })
    : t("mobile_play");

  return (
    <DetailsLayout
      testID="series-details"
      title={found.name}
      info={ok?.info ?? { name: found.name }}
      backdrop={art.data?.backdrop || ok?.info.backdrop || found.icon}
      logo={art.data?.logo}
      cast={[]}
      play={{
        label: playLabel,
        // R-076: the last watched episode at its position, or S1E1.
        onPress: () => {
          if (!target) return;
          const episodes = target.season.episodes;
          playEpisode(found, episodes, episodes.indexOf(target.episode), {
            isAdult,
            start: target.resume ? target.resume.position : 0,
            tmdbId: ok?.info.tmdbId,
          });
        },
        progress: target?.resume ? target.resume.percent / 100 : undefined,
      }}
      favourite={{ value: favourite, onToggle: () => toggle(found, isAdult) }}
    >
      {details.isPending ? (
        <ActivityIndicator style={styles.loading} color={colors.brand.primary} />
      ) : details.isError ? (
        <EmptyState
          icon={Clapperboard}
          title={t("msg_data_loading_failed")}
          action={{ label: t("try_again"), onPress: () => void details.refetch() }}
        />
      ) : season ? (
        <View style={styles.episodes}>
          <CategoryChips
            chips={[
              {
                key: "season",
                label: season.name || t("mobile_season", { n: season.number }),
                dropdown: true,
                testID: "season-picker",
              },
            ]}
            onPress={() => setPicker(true)}
          />
          {season.episodes.length === 0 ? (
            <EmptyState icon={Clapperboard} title={t("msg_no_episodes_available")} />
          ) : (
            season.episodes.map((episode, index) => {
              const d = durationParts(episode.durationSecs);
              return (
                <SeriesEpisode
                  key={episode.id}
                  series={found}
                  episode={episode}
                  isAdult={isAdult}
                  number={episode.episodeNumber}
                  title={episode.title}
                  duration={d ? t("mobile_duration", { h: d.h, m: d.m }) : undefined}
                  synopsis={episode.plot}
                  image={episode.image || found.icon}
                  progress={(resumes[episode.id]?.percent ?? 0) / 100}
                  onPress={() =>
                    playEpisode(found, season.episodes, index, {
                      isAdult,
                      start: "ask",
                      tmdbId: ok?.info.tmdbId,
                    })
                  }
                  testID={`episode-${episode.id}`}
                />
              );
            })
          )}
        </View>
      ) : null}
      <Sheet visible={picker} onClose={() => setPicker(false)} title={t("mobile_seasons")}>
        {seasons.map((s) => (
          <ListRow
            key={s.number}
            title={s.name || t("mobile_season", { n: s.number })}
            subtitle={t("mobile_episode_count", { count: s.episodes.length })}
            selected={s.number === seasonNumber}
            trailing={
              s.number === seasonNumber ? (
                <Check size={layout.iconSize} color={colors.text.primary} />
              ) : undefined
            }
            onPress={() => {
              setChosenSeason(s.number);
              setPicker(false);
            }}
            testID={`season-${s.number}`}
          />
        ))}
      </Sheet>
    </DetailsLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg.base, justifyContent: "center" },
  loading: { marginTop: spacing.lg },
  episodes: { marginTop: spacing.lg, gap: spacing.xs },
});
