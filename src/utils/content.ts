// Opening and playing catalogue items from any screen.
import { router } from "expo-router";

import { isAdultItem, seriesDetails, seriesPlayTarget } from "@/browse/details";
import { showToast } from "@/components/Toast";
import type { CatalogueItem, Episode } from "@/content/types";
import { browseContext } from "@/hooks/useBrowse";
import { i18n } from "@/i18n";
import {
  setLiveRequest,
  setVodRequest,
  usePlayerStore,
  type StartAt,
  type VodItem,
} from "@/player/session";
import type { EpgProgramme } from "@/utils/epgTime";

/** The details page of a movie or series; a channel opens on the Live tab. */
export function openItem(item: CatalogueItem): void {
  if (item.kind === "movie") router.push({ pathname: "/movie/[id]", params: { id: item.item_id } });
  else if (item.kind === "series")
    router.push({ pathname: "/series/[id]", params: { id: item.item_id } });
  else
    router.navigate({
      pathname: "/live",
      params: { channel: item.item_id, category: item.category_id },
    });
}

function openVod(items: VodItem[], index: number, start: StartAt): void {
  setVodRequest({ items, index }, start);
  router.push("/player");
}

/** A movie; `start`: "ask" offers the resume prompt (R-075), a number starts there. */
export function playMovie(item: CatalogueItem, isAdult: boolean, start: StartAt = "ask"): void {
  openVod([{ kind: "movie", item, isAdult }], 0, start);
}

/** An episode, with the season's episodes as Previous/Next (player.md §3.1). */
export function playEpisode(
  series: CatalogueItem,
  episodes: readonly Episode[],
  index: number,
  options: { isAdult: boolean; start?: StartAt; tmdbId?: string },
): void {
  const items: VodItem[] = episodes.map((episode) => ({
    kind: "episode",
    series,
    episode,
    isAdult: options.isAdult,
    tmdbId: options.tmdbId,
  }));
  openVod(items, index, options.start ?? "ask");
}

/** A catch-up programme, with the programmes of that day as Previous/Next. */
export function playCatchup(
  channel: CatalogueItem,
  programmes: readonly EpgProgramme[],
  index: number,
): void {
  openVod(
    programmes.map((programme) => ({ kind: "catchup", channel, programme })),
    index,
    0,
  );
}

/** The full-screen live player; zapping stays in `channels` (the current category). */
export function playChannel(
  channels: readonly CatalogueItem[],
  index: number,
  adultCategories: readonly string[],
): void {
  const channel = channels[index];
  if (!channel) return;
  setLiveRequest(channels, index, adultCategories);
  router.push({ pathname: "/channel/[id]", params: { id: channel.item_id } });
}

/** The EPG guide for the channels of a category (R-096). */
export function openGuide(
  title: string,
  channels: readonly CatalogueItem[],
  adultCategories: readonly string[],
): void {
  usePlayerStore.setState({ guide: { title, channels, adultCategories } });
  router.push("/guide");
}

/**
 * Play from a card (the Home hero): a movie asks to resume; a series plays its last watched
 * episode or S1E1 (R-076).
 */
export async function playItem(item: CatalogueItem): Promise<void> {
  const ctx = browseContext();
  if (!ctx) return;
  const isAdult = await isAdultItem(ctx, item);
  if (item.kind === "movie") return playMovie(item, isAdult);
  if (item.kind !== "series") return openItem(item);
  try {
    const result = await seriesDetails(ctx, item);
    if (result.kind !== "ok") {
      showToast({ text: i18n.t("msg_no_seasons_available") });
      return;
    }
    const target = seriesPlayTarget(ctx, item, result.details.seasons);
    if (!target) return;
    const episodes = target.season.episodes;
    playEpisode(item, episodes, episodes.indexOf(target.episode), {
      isAdult,
      tmdbId: result.details.info.tmdbId,
    });
  } catch {
    showToast({ text: i18n.t("msg_data_loading_failed") });
  }
}
