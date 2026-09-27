// Settings (01-product/settings.md, user-flows.md §14, §16, §17): the Hide Categories lists, Clear
// Watch Lists and the playlist expiry notice on Home. The rules themselves live in
// src/content/rules; this layer reads the catalogue for them.
import { playlistExpiryNotice, type ExpiryNotice } from "@/content/rules/app";
import { buildRows, type Row } from "@/content/rules/content";
import { clearWatchList } from "@/content/rules/library";
import { hiddenCategories, toggleHiddenCategory } from "@/content/rules/live";
import type { ContentKind } from "@/content/types";
import { categories } from "@/db/queries/catalogue";
import type { ProviderAccount } from "@/session/playlistLoad";

import { playlistIdOf, sourceTypeOf, type BrowseContext } from "./context";

export interface HideableRow {
  row: Exclude<Row, { type: "custom" }>;
  hidden: boolean;
}

/**
 * settings.md §2.3: every row of a section of the current playlist, virtual ones included, except
 * Search All and custom rows (custom categories are not in v1, D-074). Empty until the section was
 * loaded once ("Categories will show here").
 */
export async function hideableRows(ctx: BrowseContext, kind: ContentKind): Promise<HideableRow[]> {
  const pid = playlistIdOf(ctx);
  const list = await categories(ctx.db, pid, kind);
  if (list.length === 0) return [];
  const hidden = new Set(hiddenCategories(ctx.store, pid, kind));
  return buildRows({ kind, source: sourceTypeOf(ctx), categories: list })
    .filter((r): r is HideableRow["row"] => r.type !== "custom")
    .filter((r) => !(r.type === "virtual" && r.id === "all"))
    .map((row) => ({ row, hidden: hidden.has(row.id) }));
}

/** Hides or shows a row; returns whether it is now hidden. */
export function setRowHidden(ctx: BrowseContext, kind: ContentKind, rowId: string): boolean {
  return toggleHiddenCategory(ctx.store, playlistIdOf(ctx), kind, rowId);
}

/** R-077 for the current playlist. */
export function clearWatchListOf(ctx: BrowseContext, kind: "movie" | "series"): void {
  clearWatchList(ctx.store, playlistIdOf(ctx), kind);
}

/** R-114: the notice for the loaded provider account (only Xtream playlists have one). */
export function providerExpiryNotice(
  provider: ProviderAccount | undefined,
  now: Date = new Date(),
): ExpiryNotice | undefined {
  if (provider?.type !== "xtream") return undefined;
  return playlistExpiryNotice("xtream", provider.account.expUnix, now);
}

/**
 * user-flows.md §17 Mobile: the notice sheet opens once per launch for each playlist (the Home
 * banner stays until dismissed). `shown` is the launch's memory, owned by the caller.
 */
export function expirySheetDue(shown: Set<string>, playlistId: string): boolean {
  if (shown.has(playlistId)) return false;
  shown.add(playlistId);
  return true;
}
