// The EPG guide's rows (R-096): one GuideLoader per open guide; rows re-render as they arrive.
import { useEffect, useMemo, useReducer } from "react";

import { GuideLoader } from "@/browse/guide";
import type { CatalogueItem } from "@/content/types";

import { useBrowse } from "./useBrowse";

export function useGuide(channels: readonly CatalogueItem[], attempt: number) {
  const ctx = useBrowse();
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const loader = useMemo(
    () => (ctx ? new GuideLoader(ctx.catalogue.source, ctx.catalogue.playlistId, bump) : undefined),
    // A retry (`attempt`) opens a fresh loader, which retries the failed rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, channels, attempt],
  );
  useEffect(() => () => loader?.dispose(), [loader]);
  return { loader, version };
}
