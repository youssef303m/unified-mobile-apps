// Move (R-093, user-flows.md §5 Mobile): the Live categories and a category's channels in the
// user's order, moved one step at a time and saved in the TV's format after every step.
import { moveStep, orderChannels, saveChannelOrder, saveRowOrder } from "@/content/rules/live";
import type { CatalogueItem } from "@/content/types";
import { categoryCount, itemsPage } from "@/db/queries/catalogue";
import type { SortKey } from "@/storage/settings";

import { playlistIdOf, type BrowseContext } from "./context";
import { fullRows, type Row } from "./rows";

/** The Live rows in the user's order, Search All included where the TV has it. */
export function liveRowOrder(ctx: BrowseContext): Promise<Row[]> {
  return fullRows(ctx, "live");
}

/** Moves the row at `index` one step; returns the new order, or undefined when not allowed. */
export function moveLiveRow(
  ctx: BrowseContext,
  rows: readonly Row[],
  index: number,
  delta: -1 | 1,
): Row[] | undefined {
  const next = moveStep(rows, index, delta, "category");
  if (next) saveRowOrder(ctx.store, playlistIdOf(ctx), next);
  return next;
}

/**
 * Channels can be moved in a provider category of a playlist the phone holds whole (Xtream,
 * M3U). A Stalker category arrives page by page from the portal, so it has no full list to order
 * (docs/decisions.md D-075).
 */
export function channelMoveAvailable(ctx: BrowseContext, row: Row | undefined): boolean {
  return row?.type === "category" && !ctx.catalogue.source.page;
}

/** Every channel of a category, in the user's order (on top of the live sort, as the list). */
export async function categoryChannels(
  ctx: BrowseContext,
  categoryId: string,
  sort: SortKey = "default",
): Promise<CatalogueItem[]> {
  const pid = playlistIdOf(ctx);
  const count = await categoryCount(ctx.db, pid, "live", categoryId);
  const all = await itemsPage(ctx.db, pid, "live", categoryId, {
    offset: 0,
    limit: Math.max(count, 1),
    sort,
  });
  return orderChannels(ctx.store, pid, categoryId, all);
}

/** Moves the channel at `index` one step; returns the new order, or undefined at the ends. */
export function moveChannel(
  ctx: BrowseContext,
  categoryId: string,
  channels: readonly CatalogueItem[],
  index: number,
  delta: -1 | 1,
): CatalogueItem[] | undefined {
  const withIds = channels.map((c) => ({ ...c, id: c.item_id }));
  const next = moveStep(withIds, index, delta, "channel");
  if (!next) return undefined;
  saveChannelOrder(ctx.store, playlistIdOf(ctx), categoryId, next);
  return next;
}

/** Whether the row at `index` can move one step (for the up / down buttons). */
export function rowMovable(rows: readonly Row[], index: number, delta: -1 | 1): boolean {
  return moveStep(rows, index, delta, "category") !== undefined;
}
