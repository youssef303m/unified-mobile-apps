// The programme on now for a channel row or a Live Now card (R-095), fetched when the row is
// rendered and kept for 10 minutes.
import { useQuery } from "@tanstack/react-query";

import type { CatalogueItem } from "@/content/types";
import { getNextProgrammes, programmeProgress, type EpgProgramme } from "@/utils/epgTime";

import { need } from "./queryClient";
import { useBrowse } from "./useBrowse";

const EPG_STALE_MS = 10 * 60_000;

export interface NowPlaying {
  current?: EpgProgramme;
  next?: EpgProgramme;
  /** Up to 4 programmes that have not ended (the live player's EPG ‹ ›). */
  programmes: EpgProgramme[];
  /** 0-100. */
  progress: number;
}

export function useEpgNow(channel: CatalogueItem | undefined): NowPlaying | undefined {
  const ctx = useBrowse();
  const epg = ctx?.catalogue.source.capabilities.epg ?? false;
  const query = useQuery({
    queryKey: ["epg-now", ctx?.catalogue.playlistId, channel?.item_id],
    enabled: epg && channel !== undefined,
    staleTime: EPG_STALE_MS,
    queryFn: ({ signal }) => need(ctx).catalogue.source.epg(need(channel), signal),
  });
  if (!query.data) return undefined;
  const { current, next, programmes } = getNextProgrammes(query.data);
  return { current, next, programmes, progress: current ? programmeProgress(current) : 0 };
}
