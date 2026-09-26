// The Live tab's opening selection (R-092 Live Initialization, R-058): which row opens and which
// channel is selected first.
import { customMembers } from "@/content/rules/customCategories";
import { liveInitialization, type LiveRow } from "@/content/rules/live";
import type { CatalogueItem } from "@/content/types";
import { itemsByIds, itemsPage } from "@/db/queries/catalogue";

import { playlistIdOf, sourceTypeOf, type BrowseContext } from "./context";
import { favouriteItems, recentChannels } from "./library";
import { tabRows } from "./rows";

const ref = (i: CatalogueItem) => ({ item_id: i.item_id, category_id: i.category_id });

export async function initialLiveSelection(
  ctx: BrowseContext,
  choice: "default" | "last" | "favorite",
): Promise<{ rowId?: string; channelId?: string }> {
  const pid = playlistIdOf(ctx);
  const source = sourceTypeOf(ctx);
  const recent = await recentChannels(ctx);
  const last = recent[0];
  const rows: LiveRow[] = [];
  // The TV counts "Search All Channels" as row 0 (D-043); it is never opened from here.
  if (source !== "stalker") rows.push({ id: "all", channels: [] });
  for (const row of await tabRows(ctx, "live")) {
    if (row.type === "virtual") {
      const items = row.id === "recent" ? recent : await favouriteItems(ctx, "live");
      rows.push({ id: row.id, channels: items.map(ref) });
    } else if (row.type === "custom") {
      const ids = customMembers(ctx.store, pid, "live", row.id);
      rows.push({ id: row.id, channels: (await itemsByIds(ctx.db, pid, "live", ids)).map(ref) });
    } else {
      const first = await itemsPage(ctx.db, pid, "live", row.id, { offset: 0, limit: 1 });
      const channels = first.map(ref);
      if (last && last.category_id === row.id) channels.push(ref(last));
      rows.push({ id: row.id, channels });
    }
  }
  const { categoryId, channelId } = liveInitialization(
    choice,
    source,
    rows,
    recent.map((r) => r.item_id),
  );
  return { rowId: categoryId, channelId };
}
