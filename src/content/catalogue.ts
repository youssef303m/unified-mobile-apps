// The active playlist's catalogue: opens the right source, logs in (with the Xtream → M3U
// fallback), and syncs sections into SQLite on demand. One instance per active playlist; a
// playlist switch creates a new one (R-040).
import { AuthError, CancelledError } from "@/api/errors";
import type { Playlist } from "@/api/ibo/types";
import type { XtreamAccount } from "@/api/xtream/types";
import type { KeyValueStore } from "@/api/store";
import type { Db } from "@/db/database";
import { syncState } from "@/db/queries/catalogue";
import { ensureLoadOnDemandDefault, readSettings } from "@/storage/settings";

import type { ContentSource } from "./ContentSource";
import { M3uSource } from "./M3uSource";
import { StalkerSource } from "./StalkerSource";
import { cachePage, writeCatalogue, writeCategories, type SyncProgress } from "./sync";
import type { ContentKind } from "./types";
import { XtreamSource } from "./XtreamSource";

export const KINDS: readonly ContentKind[] = ["live", "movie", "series"];

/** Stalker: pages fetched per batch when a category opens or scrolls (stalker.md §4.4). */
export const STALKER_PAGES_PER_BATCH = 5;

export function createSource(playlist: Playlist, store: KeyValueStore): ContentSource {
  const settings = readSettings(store);
  if (playlist.playlist_type === "stalker")
    return new StalkerSource(playlist, store, settings.stbProfile);
  if (playlist.playlist_type === "xc")
    return new XtreamSource(playlist, { streamFormat: settings.streamFormat });
  return new M3uSource(playlist.id, playlist.url);
}

/** R-024 fallback triggers: the Xtream API failed at the transport or parse level. */
function canFallBack(error: unknown): boolean {
  return !(error instanceof AuthError) && !(error instanceof CancelledError);
}

export interface LoginResult {
  source: ContentSource;
  account?: XtreamAccount;
  /** The Xtream playlist is being read as M3U (R-024). */
  fellBack: boolean;
}

/**
 * Logs in to the playlist. Xtream: R-023 account checks; on a network or parse failure the same
 * playlist is retried as M3U from its get.php URL (R-024). Q-behaviour-fixes #8: when both fail,
 * the original Xtream error is thrown. M3U: downloads and validates the file (R-025).
 * Stalker: connects and checks the profile (R-026).
 */
export async function login(
  playlist: Playlist,
  store: KeyValueStore,
  signal?: AbortSignal,
): Promise<LoginResult> {
  const source = createSource(playlist, store);
  if (source instanceof XtreamSource) {
    try {
      const account = await source.login(signal);
      ensureLoadOnDemandDefault(store);
      return { source, account, fellBack: false };
    } catch (xtreamError) {
      if (!canFallBack(xtreamError) || !playlist.origin_url) throw xtreamError;
      const m3u = new M3uSource(playlist.id, playlist.origin_url);
      try {
        await m3u.load({ signal });
      } catch {
        throw xtreamError;
      }
      return { source: m3u, fellBack: true };
    }
  }
  if (source instanceof M3uSource) await source.load({ signal });
  if (source instanceof StalkerSource) await source.connect();
  return { source, fellBack: false };
}

export class CatalogueSession {
  /** R-050: sections loaded in this session (reset by a playlist switch = a new session). */
  private readonly loaded = new Set<ContentKind>();
  private readonly pending = new Map<ContentKind, Promise<void>>();

  constructor(
    private readonly db: Db,
    public source: ContentSource,
    private readonly playlist: Playlist,
  ) {}

  get playlistId(): string {
    return this.source.id;
  }

  isLoaded(kind: ContentKind): boolean {
    return this.loaded.has(kind);
  }

  /** Whether the section has a cached copy from an earlier session (Home renders from it). */
  async hasCache(kind: ContentKind): Promise<boolean> {
    return (await syncState(this.db, this.playlistId, kind)) !== undefined;
  }

  /** R-050: load a section the first time it is opened in this session; shared while running. */
  ensureSection(
    kind: ContentKind,
    options: { signal?: AbortSignal; onProgress?: (p: SyncProgress) => void } = {},
  ) {
    if (this.loaded.has(kind)) return Promise.resolve();
    let run = this.pending.get(kind);
    if (!run) {
      run = this.syncSection(kind, options).finally(() => this.pending.delete(kind));
      this.pending.set(kind, run);
    }
    return run;
  }

  private async syncSection(
    kind: ContentKind,
    options: { signal?: AbortSignal; onProgress?: (p: SyncProgress) => void },
  ) {
    const source = this.source;
    if (source.catalogue) {
      const catalogue = await source.catalogue(kind, { signal: options.signal });
      if (options.signal?.aborted) throw new CancelledError("Section loading cancelled");
      await writeCatalogue(this.db, this.playlistId, kind, catalogue, {
        onProgress: options.onProgress,
      });
    } else {
      await writeCategories(
        this.db,
        this.playlistId,
        kind,
        await source.categories(kind, options.signal),
      );
      options.onProgress?.({ kind, fraction: 1 });
    }
    this.loaded.add(kind);
  }

  /**
   * Load on demand off: all six lists at login (R-050). If Xtream fails, the playlist is read
   * as M3U instead (xtream.md §3), keeping the original error if that fails too.
   */
  async loadAll(
    options: { signal?: AbortSignal; onProgress?: (p: SyncProgress) => void } = {},
  ): Promise<void> {
    try {
      for (const kind of KINDS) await this.ensureSection(kind, options);
    } catch (error) {
      if (
        !(this.source instanceof XtreamSource) ||
        !canFallBack(error) ||
        !this.playlist.origin_url
      )
        throw error;
      const m3u = new M3uSource(this.playlist.id, this.playlist.origin_url);
      try {
        await m3u.load({ signal: options.signal });
      } catch {
        throw error;
      }
      this.source = m3u;
      this.loaded.clear();
      for (const kind of KINDS) await this.ensureSection(kind, options);
    }
  }

  /** R-052 / N-09: pull to refresh re-downloads the sections loaded so far. */
  async refresh(
    options: { signal?: AbortSignal; onProgress?: (p: SyncProgress) => void } = {},
  ): Promise<void> {
    const kinds = [...this.loaded];
    this.loaded.clear();
    if (this.source instanceof M3uSource)
      this.source = new M3uSource(this.playlistId, this.source.url);
    for (const kind of kinds) await this.ensureSection(kind, options);
  }

  /**
   * Stalker (paged sources): loads up to 5 pages of a category starting at `fromPage`, stopping
   * early when a page adds no new id or everything is loaded. Returns the next page to load, or
   * undefined when the category is complete.
   */
  async loadPages(
    kind: ContentKind,
    categoryId: string,
    fromPage: number,
    sort?: string,
    pages = kind === "live" ? 1 : STALKER_PAGES_PER_BATCH,
  ): Promise<number | undefined> {
    if (!this.source.page) return undefined;
    for (let page = fromPage; page < fromPage + pages; page++) {
      const result = await this.source.page(kind, categoryId, page, sort);
      const fresh = await cachePage(this.db, this.playlistId, kind, categoryId, page, result.items);
      const count = await this.db.first<{ n: number }>(
        `SELECT COUNT(*) AS n FROM items WHERE playlist_id = ? AND kind = ? AND category_id = ?`,
        [this.playlistId, kind, categoryId],
      );
      // A page with no new id clamps the total (portals repeating pages).
      if (fresh === 0 || (count?.n ?? 0) >= result.total) return undefined;
    }
    return fromPage + pages;
  }
}
