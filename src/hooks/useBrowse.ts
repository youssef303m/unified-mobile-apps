// The browse context of the active playlist (src/browse/context.ts), for the content screens.
import { useMemo } from "react";

import type { BrowseContext } from "@/browse/context";
import { useSession } from "@/session/store";
import { kvStore } from "@/storage/kv";

export function useBrowse(): BrowseContext | undefined {
  const catalogue = useSession((s) => s.active?.catalogue);
  return useMemo(
    () => (catalogue ? { db: catalogue.db, store: kvStore, catalogue } : undefined),
    [catalogue],
  );
}

/** Outside React (event handlers that run after navigation). */
export function browseContext(): BrowseContext | undefined {
  const catalogue = useSession.getState().active?.catalogue;
  return catalogue ? { db: catalogue.db, store: kvStore, catalogue } : undefined;
}
