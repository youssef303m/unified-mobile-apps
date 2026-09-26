# Architecture

## Principles

1. **Screens never talk to a server.** Screens use hooks, hooks use services, and services use
   API clients. Only `src/api/` knows URLs, parameters or encryption.
2. **One content interface, three sources.** Xtream, M3U and Stalker portals all implement the same
   `ContentSource` interface. Everything above it (rows, details, player, search, favourites,
   downloads) is source-agnostic. The differences (for example "no replay for Stalker") are
   expressed as **capabilities** on the source, not as `if (type === "stalker")` checks in screens.
3. **Catalogues live in SQLite, not in memory.** A playlist's lists are synced into SQLite, and
   screens query pages of them. React state holds only what is on screen.
4. **Same rules as the TV app.** Every rule in 01-product/business-rules.md (R-xxx) is implemented
   once, in the service layer, with a test that names the rule id.
5. **Same persisted keys where they matter.** The TV app stores its state in `localStorage` under
   the `gz3rYzUIC7_` prefix. The phone app uses MMKV with the same key names and value shapes
   (02-backend/data-models.md), so the documentation, the rules and support conversations stay
   the same.

## Folder layout (the new project)

```
app/                        expo-router routes (screens only; thin)
  _layout.tsx               providers: QueryClient, i18n, theme, gesture handler, bottom sheet
  (boot)/                   splash, terms, activation (device not activated / expired)
  (tabs)/                   bottom tabs
    _layout.tsx             TabBar
    index.tsx               Home
    live.tsx                Live TV
    movies.tsx              Movies
    series.tsx              Series
    my-list.tsx             favourites, continue watching, downloads
  movie/[id].tsx            movie details
  series/[id].tsx           series details (seasons, episodes)
  channel/[id].tsx          full-screen live player (landscape)
  player.tsx                VOD/episode player (landscape)
  epg.tsx                   EPG guide
  search.tsx
  playlists/…               the playlist list and switching; the portal list and editing
  settings/…                one route per settings section
  account.tsx
src/
  api/
    http.ts                 fetch wrapper: timeouts, retries, logging, error mapping
    ibo/                    IBO backend: server selection, registration, playlists, … (02-backend/ibo-api-reference.md)
    crypto.ts               the encryption/decoding of backend payloads (02-backend/device-and-auth.md)
    xtream/                 player_api.php client (02-backend/xtream.md)
    m3u/                    download + streaming parser (02-backend/m3u.md)
    stalker/                portal client: handshake, token rotation, lists, create_link (02-backend/stalker.md)
    tmdb.ts, imageCache.ts, analytics.ts, stararcs.ts   (02-backend/services.md)
  content/
    ContentSource.ts        the interface (below)
    XtreamSource.ts, M3uSource.ts, StalkerSource.ts
    sync.ts                 pulls a source's catalogue into SQLite, with progress, and load-on-demand
    rules/                  business rules (R-xxx): parental, sports detection, sorting, recent, favourites
  db/
    schema.ts, migrations/  SQLite tables + FTS5
    queries/                typed query functions (pages of a category, search, by id)
  storage/
    kv.ts                   MMKV wrapper, the key names from 02-backend/data-models.md
    secure.ts
  session/                  the zustand stores: device, account, activePlaylist, parental unlock state
  player/
    PlayerScreen.tsx        react-native-video + custom controls
    controls/               gesture layer, seek bar, track sheets, next-episode card
    resume.ts               positions, continue watching (01-product/player.md §4)
    subtitles/              external SRT fetch + parse + render
  downloads/
    manager.ts              queue, background downloader, storage, expiry, DB rows
    DownloadButton.tsx
  i18n/                     i18next setup; locales copied from 05-reference/locales
  theme/                    tokens.ts, typography.ts (03-design/design-system.md)
  components/               the design-system components (03-design/design-system.md §5)
  hooks/                    useHomeRows, useCategory, useSearch, useEpg, useAccount, …
  platform/                 anything Android-specific (device id, PiP, orientation)
  utils/                    time (EPG parsing), formatting, urls
e2e/                        Maestro flows
docs/decisions.md           decision log (library choices, deviations from this kit)
```

## The content interface

```ts
export type ContentKind = "live" | "movie" | "series";

export interface SourceCapabilities {
  replay: boolean;            // catch-up / Replay section (false for Stalker portals, see business rules)
  liveFavorites: boolean;     // false for Stalker portals
  epg: boolean;
  loadOnDemand: boolean;      // lists are fetched per category instead of all at once
  downloads: boolean;         // direct file URLs exist for movies/episodes
}

export interface ContentSource {
  readonly id: string;                  // the playlist or portal id
  readonly type: "xtream" | "m3u" | "stalker";
  readonly capabilities: SourceCapabilities;

  categories(kind: ContentKind): Promise<Category[]>;
  items(kind: ContentKind, categoryId: string, page?: number): Promise<Page<LiveChannel | Movie | Series>>;
  movieInfo(id: string): Promise<MovieInfo>;
  seriesInfo(id: string): Promise<SeriesInfo>;          // seasons + episodes
  epg(channel: LiveChannel, window?: { from: Date; to: Date }): Promise<EpgProgramme[]>;

  // URLs are resolved at play time: Stalker links are short-lived tokens (create_link).
  streamUrl(req: PlayRequest): Promise<{ url: string; headers?: Record<string, string> }>;
  catchupUrl?(channel: LiveChannel, programme: EpgProgramme): Promise<{ url: string; headers?: Record<string, string> }>;
}
```

The types come from 02-backend/data-models.md. A `ContentSource` never touches the UI or MMKV
settings directly. Settings that change URLs (for example the live stream format) are passed in
through the constructor.

## Data flow

```mermaid
flowchart LR
  subgraph Server
    IBO[IBO backend]
    SRC[Xtream / M3U / Stalker server]
    TMDB[TMDB / image cache]
  end
  IBO -->|device, account, playlists| api_ibo[src/api/ibo]
  SRC --> api_src[src/api/xtream|m3u|stalker]
  TMDB --> api_tmdb[src/api/tmdb]
  api_ibo --> session[session store]
  api_src --> source[ContentSource]
  source --> sync[content/sync.ts] --> db[(SQLite)]
  db --> hooks[hooks]
  api_tmdb --> hooks
  session --> hooks
  hooks --> screens[app/ screens]
  screens --> player[player/]
  player -->|streamUrl at play time| source
  player --> resume[(MMKV: positions, recent)]
  screens --> downloads[downloads/manager] -->|streamUrl| source
```

## Boot sequence (summary)

1. Show the splash. Load MMKV, fonts and i18n (the saved language, else the device language if one
   of the 18, else English).
2. Get or create the device identity (02-backend/device-and-auth.md).
3. Pick a working IBO server and register or log in the device (02-backend/overview.md).
4. Route by account state: terms not accepted → Terms. Not activated or expired → Activation
   (shows the device id, the website and the QR). Otherwise continue.
5. Load the playlist list. With no playlist → Playlists (an empty state showing how to add one
   on the website). Otherwise open the last-used playlist (as the TV app does) and sync its
   catalogue (fully, or per category in load-on-demand mode).
6. Home.

The details of each step, and every alternative path, are in 01-product/user-flows.md.

## Error handling

- `src/api/http.ts` maps failures into a small set of typed errors: `NetworkError`, `TimeoutError`,
  `AuthError` (credentials rejected, expired account), `ServerError` (HTTP 5xx), `ParseError`.
- Services catch only what they can handle. For example, a Stalker token error gets one re-handshake
  and retry (02-backend/stalker.md). Everything else propagates to the hook, which shows the
  matching message from the locale files: the same message keys as the TV app, listed in
  01-product/current-app-inventory.md.
- Never swallow an error into an empty list. An empty category and a failed request are different
  states on screen.

## Performance budgets

| Scenario | Target on a mid-range phone (2021, 4GB RAM) |
|---|---|
| Cold start to Home with a cached catalogue | < 2.5s |
| Syncing a 20,000-channel Xtream playlist | shows progress, never freezes the UI; < 30s on 4G |
| Scrolling a 5,000-item category | 60fps with FlashList; images lazy |
| Search across the catalogue | first results in < 300ms (FTS5) |
| Pressing Play to the first frame (VOD, good network) | < 2s; the spinner appears at once |
