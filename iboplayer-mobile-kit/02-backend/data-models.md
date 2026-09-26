# Content data models and category rules

TypeScript shapes of the data the content layer produces, the rules that build the category
lists (virtual rows, favourites, recents, hidden, parental, custom, arrangement, sports,
sorting) and every locally persisted key. Protocol details are in `xtream.md`, `m3u.md`,
`stalker.md`, `epg-and-catchup.md`.

Source: `core/js/Models/{CategoryModel,LiveModel,VodModel,SeriesModel}.js`,
`core/js/common.js` (`checkForAdult`, `getSortedMovies`, `makeRearrangeArray`),
`core/js/utils.js` (`isAdultCategoryName`, top-rated helpers, `readJson`),
`core/js/custom_categories.js`, `core/js/SportsFilterService.js`,
`core/js/home_common.js` (`buildSportsCategories`), `core/js/settings.js`,
`core/js/channel_operation.js`, `core/js/vod_series_page.js`, `core/js/vod_series_player.js`,
`core/js/search_page.js`, `features/category_arrange/js/category_arrange.js`,
`core/js/stalker_integration.js`, `core/js/portal_edit_page.js`.

The storage prefix is `storage_id = "gz3rYzUIC7_"` (from `app.json` `runtime.storageId`).
In key templates below `{P}` = that prefix and `{pid}` = the active playlist's `id`.
Note that most per-playlist keys concatenate **without a separator**:
`{P}{pid}live_favourite` → `gz3rYzUIC7_4821live_favourite`.

---

## 1. Interfaces

```ts
type PlaylistType = 'xc' | 'general' | 'stalker' | 'code';   // 'code' is a feature disabled for iboplayer

/** One entry of playlist_urls (from the IBO backend or created locally). */
interface Playlist {
  id: string | number;                 // prefix of all per-playlist storage keys
  playlist_name?: string;
  playlist_type?: PlaylistType;        // missing => treated as 'general'
  url: string;                         // XC: server base; general: M3U URL; stalker: portal URL
  username?: string;                   // XC
  password?: string;                   // XC
  origin_type?: string;                // 'xc' | 'stalker' | …
  origin_url?: string;                 // XC: the get.php URL (M3U fallback + live ext detection)
  // Stalker only
  portal_name?: string;
  portal_address?: string;
  portal_fallback_address?: string;
  stalker_mac_address?: string;        // 'AA:BB:CC:DD:EE:FF'
  stalker_mac?: string;                // legacy alias
  stalker_mac_mode?: 'prefix_001A79' | 'prefix_001C1D';
  stalker_stb_profile?: 'mag250' | 'mag322' | 'mag520' | 'iboplayer';
  expiry?: string;
  is_created?: boolean;                // local bookkeeping for unsynced edits
}

/** Portal = a Playlist with playlist_type 'stalker' (see stalker.md §1). */
type Portal = Playlist & { playlist_type: 'stalker'; portal_address: string; stalker_mac_address: string };

interface Category<T = unknown> {
  category_id: string;                 // provider id (XC), group name (M3U), String(id) (Stalker) or a virtual id
  category_name: string;
  parent_id: number | string;
  movies: T[];                          // filled by insertMoviesToCategories (empty for Stalker real categories)
  is_hide: boolean;                     // user-hidden
  is_custom?: boolean;                  // custom category row
  cc_icon?: string;                     // custom category icon name
}
// Virtual ids: 'all' (search row), 'recent', 'favourite', 'undefined' (Uncategorized),
// 'top_rated', 'newly_added' (VOD), 'recently_modified' (series), 'sports_my', custom 'cc…'.

interface LiveChannel {
  stream_id: string | number;          // XC number, M3U tvg-id or name, Stalker String(id)
  name: string;
  stream_icon: string;
  num?: number | string;               // channel number
  category_id: string;                 // 'undefined' when missing
  tv_archive?: number | string;        // XC / Stalker (mapped 0|1)
  tv_archive_duration?: number | string;
  epg_channel_id?: string;             // not used
  url?: string;                        // M3U: direct stream URL
  cmd?: string;                        // Stalker: create_link input
  is_recent?: boolean;                 // set false by the model builder
}

interface Movie {
  stream_id: string | number;
  name: string;
  stream_icon: string;
  rating?: string | number;
  added?: string;                      // XC: unix seconds string; Stalker: date string
  category_id: string;
  container_extension?: string;        // XC
  num?: number;
  url?: string;                        // M3U
  // Stalker extras
  cmd?: string; series?: string | unknown[]; storage_id?: string; tmdb_id?: string;
  plot?: string; director?: string; cast?: string; genre?: string; year?: string; duration?: string;
  stream_type?: 'movie';
}

/** XC get_vod_info.info (fields read), or the TMDB-derived object for Stalker. */
interface MovieInfo {
  name?: string; description?: string; plot?: string; cast?: string; actors?: string; director?: string;
  genre?: string; duration?: string; releasedate?: string; releaseDate?: string; rating?: string | number;
  age?: string; tmdb_id?: string | number; tmdb?: string | number;
  backdrop_path?: string[] | string;   // XC array; Stalker/TMDB string
  movie_image?: string; cover?: string; cover_big?: string; youtube_trailer?: string;
}

interface Series {
  series_id: string | number;          // M3U: the series name
  name: string;
  cover: string;
  rating?: string | number;
  last_modified?: string;              // XC unix seconds string
  added?: string;                      // Stalker
  category_id: string;
  plot?: string; cast?: string; director?: string; genre?: string; releaseDate?: string;
  youtube_trailer?: string; backdrop_path?: string[] | string; tmdb_id?: string;
  num?: number;
  stalker_category_id?: string;        // Stalker
  info?: MovieInfo;                    // XC, after get_series_info
  seasons?: Season[];                  // after loading details (M3U: at parse time)
  episodes?: Record<string, Episode[]>;// M3U only, keyed by season name
}

interface Season {
  season_number?: number | string;
  name: string;                        // "Season 1" (XC), "Season 01" (M3U), portal name (Stalker)
  cover?: string;
  episodes: Episode[];
  // Stalker
  stalker_season_id?: string; raw_cmd?: string; raw_series?: number[]; storage_id?: string;
}

interface Episode {
  id: string;                          // XC episode stream id; M3U label "01"; Stalker "<seasonId>:<n>"
  title: string;
  name?: string;
  container_extension?: string;        // XC; Stalker always 'mp4'
  info: { duration_secs?: number; [k: string]: unknown };
  url?: string;                        // M3U
  // Stalker
  cmd?: string; series?: string; storage_id?: string; season?: string; episode_num?: number;
}

interface EpgProgramme {
  start: string;                       // 'YYYY-MM-DD HH:mm' (XC, catch-up) or 'YYYY-MM-DD HH:mm:ss' (Stalker now/next), device-local
  stop: string;
  title: string;                       // plain, except catch-up lists where it is base64 (decoded at display)
  description?: string;                // XC live / XC catch-up (base64 in catch-up)
  desc?: string;                       // Stalker catch-up (base64)
  _raw?: unknown;                      // Stalker catch-up: original portal item (id, real_id…)
}
```

---

## 2. Model build (`insertMoviesToCategories`)

Input: provider categories (`setCategories`) + all items (`setMovies`). `setCategories`
marks `is_hide` from the hidden list. Then:

1. Append `{ category_id: 'undefined', category_name: 'Uncategorized' }`.
2. Every item with `category_id` `undefined`/`null`/`"null"` gets `'undefined'`. Items are
   grouped by `String(category_id)`; each category's `movies` = its group (provider order).
   An item whose category id is not in the category list is in no category (only in
   Favourites/Recent/Search All if matched there).
3. Build virtual rows (below) and put them in front.
4. Remove "Uncategorized" if empty.
5. Live only: apply the legacy category/channel order (§6), then custom rows, then the
   `category_arrange` order (§6).
6. VOD/series: inject custom rows after Favourites.
7. The model's flat item list is then discarded (items live only inside categories).

Resulting order:

| Live | Movies | Series |
|---|---|---|
| `all` "Search All Channels" (not for Stalker) | `all` "Search All Movies" (not Stalker) | `all` "Search All Series" (not Stalker) |
| `recent` "Recently Viewed" | `recent` "Continue Watching" | `recent` "Recently Viewed" |
| `favourite` "Favourites" | `favourite` "Favourites" | `favourite` "Favourites" |
| custom rows… | custom rows… | custom rows… |
| provider categories… | `top_rated` "Top Rated" (removed for Stalker) | `top_rated` "Top Rated" (removed for Stalker) |
| `undefined` "Uncategorized" | `newly_added` "Newly Added" (removed for Stalker) | `recently_modified` "Recently Added/Updated" (removed for Stalker) |
| | provider categories…, `undefined` | provider categories…, `undefined` |

The `all` row has no items; selecting it opens the search screen (live/VOD/series).
Pages show `getCategories(false, true)` = everything except hidden rows. The virtual names
are display strings (translated in the UI); code keys on `category_id` only.

### Live row rules

- **Recently Viewed**: ids in `{P}{pid}live_recent` (array of `stream_id`). Built in item
  order, each match `unshift`ed. When a channel is played (and is not in an adult category)
  `addRecentOrFavouriteMovie(channel, 'recent')`: if already present nothing changes;
  otherwise inserted at the front, list truncated to **15**, ids saved.
- **Favourites**: ids in `{P}{pid}live_favourite`. Built in item (provider) order,
  appended. Add = append at the end, max **500**; remove by id. Adding a channel whose
  category is adult is refused ("Adding protected content to favourites is not allowed.").
- Id matching uses `Array.includes` (strict): number vs string ids do not match.

### Movie row rules

- **Continue Watching (recent)** is derived from watch progress
  `{P}{pid}_saved_vod_times` = `[{ stream_id, time, duration }]`. Recent ids = those
  `stream_id`s (XC: `parseInt`), ordered by walking the saved list and `unshift`ing, i.e.
  the entry saved first-most-recently is first. At runtime `addToWatchList` puts a movie at
  the front (max 15) once progress is saved.
- **Favourites**: `{P}{pid}vod_favourite` ids, max 200, append.
- **Top Rated**: items whose `rating` parses as a number and whose category name is not
  adult (`isAdultCategoryName`). Sort by rating desc; `pool` = all items sharing the highest
  rating; if `pool.length > 10` show 10 random from the pool (shuffled cycle without repeats,
  a shuffle button appears when `pool.length >= 20`), else the top 10.
- **Newly Added**: non-adult items with `now − added ≤ 15 days` (`added` in unix seconds).

### Series row rules

- **Recently Viewed**: from `{P}{pid}_saved_series_times` (see §7), same ordering as
  movies; `addToWatchList` does nothing when the row already holds 15.
- **Favourites**: `{P}{pid}series_favourite` (series_id), max 200.
- **Top Rated**: as movies.
- **Recently Added/Updated**: non-adult, `now − parseInt(last_modified) ≤ 15 days`.

### Stalker

Real categories have `movies: []`; items are fetched per category with paging
(`stalker.md` §4). Recent/Favourites rows are filled from stored full objects
(`stalker.md` §5).

---

## 3. Hidden categories

Settings → Hide Categories (tabs Live/Movies/Series) toggles any row (virtual ones included,
except `all` which is never hideable by data). Stored per playlist and type:
`{P}{pid}{live|vod|series}_hiddens` = array of `category_id`. Hidden rows vanish from the
Live/Movies/Series pages and from search.

## 4. Parental control

- PIN: `parent_account_password`, default `"0000"`, overwritten by the IBO backend's
  `parent_pin` at login, stored `{P}parent_account_password`. Value `"off"` disables the
  category lock.
- **Adult category test A** (`checkForAdult`): lowercase `category_name` contains `xxx`,
  `adult` or `porn`. For a channel/movie it looks up the item's category by `category_id`.
- **Adult category test B** (`isAdultCategoryName`): contains `xxx`, `adult`, `porn` or
  `sex` — used only to keep items out of Top Rated / Newly Added / Recently Added.

Where it applies:

| action | rule |
|---|---|
| Opening an adult category (live, movies, series, replay) | PIN prompt, unless PIN is `"off"`; wrong PIN → "Sorry, parent password does not match." |
| Adding to favourites / custom categories | refused for adult items, **even when PIN is off** |
| Live "recently viewed" | adult channels never added |
| Movie/episode watch progress | not saved for adult items |
| Search | adult categories are never searched (even when PIN is off) |
| Top Rated / Newly Added / Recently Added | adult items excluded (test B) |

Stalker `censored` flags are ignored; detection is name-based for all providers.

## 5. Custom categories ("collections")

- Global switch `{P}custom_categories_enabled` = `"true"` / `"false"` (default off). Off:
  the favourite action toggles Favourites directly; custom rows are hidden (data kept).
- Definitions (global, all playlists): `{P}custom_categories` =
  `[{ id: "cc<base36 time><base36 rand>", name, icon }]` (default icon `"cc-heart"`).
- Membership per playlist and type:
  - XC/M3U: `{P}{pid}{type}_cc_{catId}` = array of id strings (max 500, oldest dropped);
  - Stalker: `{P}{pid}_stalker_{type}_cc_{catId}_objs` = array of full objects (newest
    first, max 500).
  `type` = `live` | `vod` | `series`; id = `stream_id` (live/vod) or `series_id`.
- Rows `{ category_id: def.id, category_name: def.name, cc_icon, is_custom: true,
  parent_id: 0, is_hide: false, movies }` are inserted right after Favourites, in
  definition order. XC/M3U rows resolve ids against the loaded items (missing ids dropped).
- System category "My Sports Channels" (`sports_my`, live only, only when the sports flag is
  on): members stored globally in `{P}wc_my_channel_ids` (array of `stream_id`s, **not** per
  playlist); never shown as a normal row.
- Deleting a definition removes its membership keys for the current playlist only.

## 6. Category and channel ordering (live only)

Three mechanisms exist, applied in this order during the live build:

1. **Legacy move mode** — `{P}{pid}_category_orders` = `[{ id, position }]` sorted by
   position; each moves the category with that id to index `position`
   (`makeRearrangeArray` = remove + insert). `{P}{pid}_channel_orders` =
   `{ [categoryId]: [{ id: stream_id, name, position }] }` reorders channels within a
   category (match on both id and name).
2. Custom rows injected after Favourites.
3. **Arrange Categories** (feature `category_arrange`, enabled for iboplayer):
   `{P}{pid}_live_category_arrangement` = array of category id strings (the pinned ids `all`,
   `recent`, `favourite` are never stored). Apply: keep the leading run of pinned rows, then
   the stored ids in order (those that exist), then all remaining rows in their existing
   order. Empty list → key removed. Not available for Stalker or Sports mode.

```ts
function applyArrangement<T extends { category_id: string }>(cats: T[], order: string[]): T[] {
  const pinned = new Set(['all', 'recent', 'favourite']);
  let start = 0; while (start < cats.length && pinned.has(String(cats[start].category_id))) start++;
  const head = cats.slice(0, start), rest = cats.slice(start);
  const chosen = order.map(id => rest.find(c => String(c.category_id) === id)).filter(Boolean) as T[];
  return [...head, ...chosen, ...rest.filter(c => !chosen.includes(c))];
}
```

## 7. Watch progress (resume)

- Movies: `{P}{pid}_saved_vod_times` = `[{ stream_id, time, duration }]` (update in place or
  append).
- Series: `{P}{pid}_saved_series_times` =

  ```json
  [ { "stream_id": 3301,
      "video_times": { "0": { "2": { "time": 812.4, "duration": 1795.2 } },
                       "recent": { "ep": 3, "s": 1 } } } ]
  ```

  keyed by **season index** and **episode index** (0-based positions in the displayed lists,
  not ids); `recent` = last watched as 1-based numbers. `stream_id` here is the series_id.
- Saved every 60 s during playback and on exit, only if `time ≥ 10 s` and
  `duration − time ≥ 10 s` (TV Samsung uses ms). Reaching the last 10 s removes the entry
  (and the item from Continue Watching / Stalker recent objects). A series entry is removed
  when no episode entries remain.
- Units: seconds on non-Samsung players (Samsung stores milliseconds — TV-only).
- "Clear watch lists" (settings) deletes `_saved_vod_times` / `_saved_series_times` for the
  current playlist.

## 8. Sorting

Settings keys: `vod_sort` (default `"added"`), `series_sort` (default `"added"`),
`live_sort` (default `"default"`, used by the Replay page). Sort dialog options: `default`,
`added`, `a_z`, `z_a`, `rating`. (`number`, `name`, `last_modified` are also understood.)
The Live channel list itself is never sorted (provider order / `channel_orders`).

```ts
/** getSortedMovies: sorts IN PLACE; for series 'added' is mapped to 'last_modified' by the caller. */
function sortItems<T extends Record<string, any>>(items: T[], key: string): T[] {
  const field = key === 'a_z' || key === 'z_a' ? 'name' : key === 'number' ? 'num' : key;
  if (items.length === 0 || items[0][field] === undefined) return items;   // judged on the FIRST item only
  switch (key) {
    case 'rating': case 'added': case 'last_modified':
      return items.sort((a, b) => (parseFloat(b[field]) || 0) - (parseFloat(a[field]) || 0));  // descending
    case 'number':
      return items.sort((a, b) => (parseFloat(a[field]) || 0) - (parseFloat(b[field]) || 0));  // ascending
    case 'a_z': case 'name':
      return items.sort((a, b) => a[field].localeCompare(b[field]));
    case 'z_a':
      return items.sort((a, b) => b[field].localeCompare(a[field]));
    default:                   // 'default' = provider order
      return items;
  }
}
```

Stalker uses server-side `sort` + client re-sort per batch (`stalker.md` §4.10).

## 9. Sports mode (flag `sports: true` for iboplayer)

Built on demand from the loaded live categories (excluding `all`, `recent`, `favourite`):

1. Row 1: `sports_my` "My Sports Channels" = all live channels whose `stream_id` is in
   `{P}wc_my_channel_ids`.
2. Then every category whose name matches the category rule, with its channels filtered by
   the channel rule; categories left empty are dropped.
3. If no category has channels → "No sport channels found in your playlist."

Rule (both levels): upper-case name must contain at least one INCLUDE keyword and none of
the EXCLUDE keywords (plain substring tests).

```ts
const CATEGORY_INCLUDE = ["WORLD CUP", "FIFA", "MUNDIAL", "WC 20", "SPORT", "SPORTS", "⚽", "FOOTBALL", "SOCCER",
  "FUTBOL", "BEIN", "FOX SPORT", "SKY SPORT", "TSN", "ESPN", "ALWAN SPORT"];
const CATEGORY_EXCLUDE = ["ENTERTAINMENT", "MOVIES", "AFLAM", "CINEMA", "MOSALSALAT", "MUSIC", "AGHANI", "KIDS",
  "ATFAL", "ANIME", "QURAN", "MEDIA", "NEWS", "AKHBAR", "DOCUMENTARY", "WATHAEQ", "HORSE RACING", "RACING",
  "MOTOR", "F1", "WWE", "UFC", "KOREA", "BOLLYWOOD", "TURKEY"];
const CHANNEL_INCLUDE = ["WORLD CUP", "FIFA WC", "FIFA", "MUNDIAL", "SPORT", "SPORTS", "⚽", "BEIN", "FOX SPORT",
  "SKY SPORT", "TSN", "ESPN", "BBC", "ITV", "ZDF", "RAI", "TRT SPOR", "M6", "SVT", "NRK", "RTE", "TELEMUNDO",
  "UNIVERS", "CARACOL", "TVP", "HRT", "RTS", "BNT", "TVR", "SBS", "FUBO", "WCTV", "ALWAYS ON", "DSPORT", "CAZE",
  "SPORZA", "ARENA SPORT", "WIN SPORT", "TIGO SPORT", "TELETICA", "SIGMA", "CT SPORT", "NRK", "TVNZ", "ALWAN SPORT"];
const CHANNEL_EXCLUDE = ["F1", "FORMULA", "WWE", "UFC", "BOXING", "NBA", "NFL", "MLB", "NHL", "CRICKET", "GOLF",
  "HORSE", "RACING", "MOTOR", "AFLAM", "MOSALSALAT", "ANIME", "QURAN", "MOVIES", "CINEMA", "SERIES", "BOX OFFICE",
  "D-SMART", "AGHANI", "ATFAL", "BOLLYWOOD", "KOREA"];

const matches = (name: string | undefined, inc: string[], exc: string[]) => {
  if (!name) return false;
  const u = name.toUpperCase();
  return inc.some(k => u.includes(k.toUpperCase())) && !exc.some(k => u.includes(k.toUpperCase()));
};
```

(`SportsFilterService.filterChannelsByCategories` exists but is unused.)

## 10. Search (non-Stalker)

Searches only already-loaded data: case-insensitive substring on `name` across
`getCategories(false, false)` (no hidden, no favourites/recent), skipping adult categories,
`top_rated`, `newly_added`, `recently_modified`, de-duplicated by id. Hidden in the home
when load-on-demand is on (data may not be loaded). Stalker search → `stalker.md` §4.11.

## 11. Loading modes and caching summary

| playlist | mode | what is fetched | cached across sessions |
|---|---|---|---|
| XC, load-on-demand = 1 (default) | per section, first open | categories + streams of that section | no |
| XC, load-on-demand = 0 | at login | all 6 lists | no |
| M3U | at login | whole file | no |
| Stalker | per section categories; items per category page | – | favourites/recents/custom as objects |

Movie/series info (hover + details) is cached in `{P}saved-movie-info`:

```json
{ "host_url": "http://line.example.tv:8080",
  "vod55012": { "info": { "name": "Dune: Part Two", "rating": "8.2", "backdrop_path": ["…"], "tmdb_id": "693134" } },
  "series3301": { "info": { … } } }
```

- Cleared entirely when a playlist with a different `api_host_url` is loaded.
- Max ~100 keys: when 100 are present, the **second** key is deleted (index 1, to keep
  `host_url`) before adding.

Section-loaded flags (`dataLoaded.live/vod/series`) are reset on playlist/portal switch.

## 12. Persisted keys (all under prefix `gz3rYzUIC7_` unless noted)

| key | shape | notes |
|---|---|---|
| `playlist_id` | string | active playlist id |
| `playlist` | JSON `Playlist` | active playlist copy |
| `load_on_demand` | `"0"` \| `"1"` | default 1 |
| `vod_sort`, `series_sort`, `live_sort` | sort key | |
| `stream_format` | `"default"` \| `"ts"` \| `"m3u8"` | no UI |
| `tmdb_choice` | `"on"` \| `"off"` | off = no TMDB/info fetch on hover |
| `home_favorites_choice` | `"on"` \| `"off"` | Live Favourites home tile |
| `live_initialization_choice` | `"default"` \| `"last"` \| `"favorite"` | which channel opens first on the Live page |
| `parent_account_password` | PIN string or `"off"` | |
| `stalker_stb_profile` | profile key | |
| `{pid}live_recent` | `stream_id[]` | max 15 |
| `{pid}{live,vod,series}_favourite` | id[] | 500 / 200 / 200 |
| `{pid}{live,vod,series}_hiddens` | category_id[] | |
| `{pid}_saved_vod_times` | `{stream_id,time,duration}[]` | |
| `{pid}_saved_series_times` | see §7 | |
| `{pid}_category_orders` | `{id,position}[]` | legacy |
| `{pid}_channel_orders` | `{[catId]: {id,name,position}[]}` | legacy |
| `{pid}_live_category_arrangement` | category_id[] | feature category_arrange |
| `{pid}{type}_cc_{catId}` | id string[] | custom membership (XC/M3U) |
| `{pid}_stalker_{type}_{recent\|favourite}_objs` | item objects | Stalker |
| `{pid}_stalker_{type}_cc_{catId}_objs` | item objects | Stalker custom membership |
| `custom_categories` | `{id,name,icon}[]` | global |
| `custom_categories_enabled` | `"true"` \| `"false"` | global |
| `wc_my_channel_ids` | stream_id[] | global "My Sports Channels" |
| `saved-movie-info` | see §11 | global |
| `all_playlists_info` | `{[hash]: {playlist_type, fetched_at, expiry_date, status, auth}}` | account info per playlist |
| `local_data`, `api_data` | IBO backend data | see `device-and-auth.md` |
| `stalker_mac` (**unprefixed**) | MAC string | random virtual MAC |
| `stalker_quirks_<host>` (**unprefixed**) | `{loader, preferred_method?}` | |

When the backend assigns a real id to a locally created playlist, every key containing the
old id is renamed (`changeLocalStorageKeysForPlaylist`: substring replace in all prefixed
keys).

## Notes / uncertainties

- Favourites/recent/hidden keys have no separator between playlist id and type
  (`…4821live_favourite`); playlist ids `12` and `1` + type-prefixed names cannot collide in
  practice, but the id-rename step does substring replacement and could touch unrelated keys
  whose text contains the old id.
- The live Recently Viewed list does not move an already-present channel to the front when
  replayed (it stays where it was). Favourites display in provider order, not in the order
  they were added.
- Adult detection differs between the two tests (`sex` only in test B); the PIN `"off"`
  switch only affects opening categories, not favourites/search/progress restrictions.
- `getSortedMovies` checks only the first item for the sort field and mutates the category's
  array in place (so the category keeps the last sort order).
- VOD Continue Watching ordering depends on the order of the saved-times array, which is not
  updated by recency (an updated entry keeps its slot), so "most recently watched" is not
  strictly first.
- Watch progress for series is keyed by list positions; if the provider reorders or adds
  episodes, resume points shift.
- `live_sort` is only used by the Replay page; the live channel list has no sort option.
