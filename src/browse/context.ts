// What every browse service needs: the catalogue database, the key-value store and the active
// playlist's catalogue session. Platform-free: the app passes MMKV and expo-sqlite, the tests an
// in-memory store and better-sqlite3.
import type { KeyValueStore } from "@/api/store";
import type { CatalogueSession } from "@/content/catalogue";
import type { SourceType } from "@/content/types";
import type { Db } from "@/db/database";

export interface BrowseContext {
  db: Db;
  store: KeyValueStore;
  catalogue: CatalogueSession;
  /** Unix seconds (injected by tests). */
  now?: () => number;
}

export const playlistIdOf = (ctx: BrowseContext): string => ctx.catalogue.playlistId;
export const sourceTypeOf = (ctx: BrowseContext): SourceType => ctx.catalogue.source.type;
export const nowSeconds = (ctx: BrowseContext): number =>
  ctx.now ? ctx.now() : Math.floor(Date.now() / 1000);
