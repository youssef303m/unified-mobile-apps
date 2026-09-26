// Opening a row's full list (the category screen), behind the PIN for adult categories (R-061)
// and counted for the Home category rows (N-01).
import { router } from "expo-router";

import type { Row } from "@/browse/rows";
import { recordCategoryOpen } from "@/browse/library";
import type { ContentKind } from "@/content/types";
import { refreshBrowse } from "@/hooks/queryClient";
import { browseContext } from "@/hooks/useBrowse";
import { unlockCategory } from "@/hooks/useParental";

/** Whether the row is an adult category (R-060). */
export const isAdultRow = (row: Row): boolean => row.type === "category" && row.isAdult;

export async function openRow(kind: ContentKind, row: Row, title: string): Promise<boolean> {
  if (!(await unlockCategory(isAdultRow(row)))) return false;
  const ctx = browseContext();
  if (ctx && row.type === "category") {
    recordCategoryOpen(ctx.store, ctx.catalogue.playlistId, kind, row.id, row.isAdult);
    refreshBrowse(ctx.catalogue.playlistId);
  }
  router.push({
    pathname: "/category",
    params: {
      kind,
      type: row.type,
      id: row.id,
      name: title,
      adult: isAdultRow(row) ? "1" : "0",
    },
  });
  return true;
}
