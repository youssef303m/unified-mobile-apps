# Xtream Codes (XC) playlists

How the IBOPlayer TV app talks to an Xtream Codes panel once the user has picked an
`xc` playlist. Everything below is what the TV code actually does, including its quirks.
Types (`Playlist`, `LiveChannel`, `Movie`, …) are defined in `data-models.md`.

Source: `core/js/login_operation.js` (`proceed_login`), `core/js/home_common.js`
(`requestMovies`), `core/js/common.js` (`getMovieUrl`, `parseM3uUrl`, `getAtob`),
`core/js/channel_operation.js` (`getEpgProgrammes`), `core/js/vod_series_page.js`,
`core/js/vod_summary.js`, `core/js/series_summary.js`, `core/js/vod_series_player.js`,
`core/js/Models/LiveModel.js` (`getProgrammeVideoUrl`), `core/js/time_helper.js`,
`core/js/playlist.js` (account-info cache).

---

## 1. Where the credentials come from

An XC playlist carries `url` (server base, e.g. `http://line.example.tv:8080`),
`username`, `password`, `playlist_type: "xc"`.

Normalisation done by the app:

- **Base URL** (`api_host_url`): `playlist.url` with a single trailing `/` removed.
  The account-info probe on the playlist screen additionally prefixes `http://` when the
  URL has no scheme; the main login path does **not** (see Notes).
- **Backend entries that look like a `get.php` "playlist" path** are converted when the
  IBO backend's list is loaded (`loadApp`): if `url` contains the text `playlist` and
  matches the regex below, the entry becomes XC:

  ```
  /(.*?)\/playlist\/(.*?)\/(.*?)\/(.*?)(?:\/(.*?))?\/?$/
      1 = host   2 = username   3 = password   4 = type   5 = output (optional)
  ```

  Result: `url = host`, `username`, `password`, `playlist_type = origin_type = "xc"`,
  `origin_url = host + "/get.php?username=U&password=P&type=<type>&output=<output>"`.
- **A pasted M3U URL** is classified by `parseM3uUrl`: if the URL contains both
  `username=` and `password=` it is XC; `url` = the part before `?` with `/get.php`
  removed, username/password taken from the query (case-insensitive key match, value =
  text after the first `=`, not URL-decoded). Otherwise it is a `general` (M3U) playlist.

```ts
function parseM3uUrl(playlistUrl: string): { playlist_type: 'xc' | 'general'; url: string; username?: string; password?: string } {
  if (!(playlistUrl.includes('username=') && playlistUrl.includes('password='))) {
    return { playlist_type: 'general', url: playlistUrl };
  }
  const [base, query = ''] = playlistUrl.split('?');
  let username: string | undefined, password: string | undefined;
  for (const pair of query.split('&')) {
    const [k, v] = pair.split('=');          // TV code: only the first '=' split, value not decoded
    if (k.toLowerCase() === 'username') username = v;
    if (k.toLowerCase() === 'password') password = v;
  }
  return { playlist_type: 'xc', url: base.replace('/get.php', ''), username, password };
}
```

All API URLs are built by **string concatenation, with no URL-encoding** of username or
password. A phone app should `encodeURIComponent` them (this is a deviation, but a safe one;
servers accept encoded values).

```ts
const apiBase = (p: Playlist) => p.url.replace(/\/$/, '');
const playerApi = (p: Playlist, action?: string, extra = '') =>
  `${apiBase(p)}/player_api.php?username=${p.username}&password=${p.password}` +
  (action ? `&action=${action}${extra}` : '');
```

---

## 2. Login / account info (no `action`)

```
GET {base}/player_api.php?username={u}&password={p}
Accept: application/json
timeout: 15 s
```

Example response (fields the app reads are marked):

```json
{
  "user_info": {
    "username": "demo123",
    "password": "pass456",
    "auth": 1,                         // read: 0 => failure
    "status": "Active",                // read: "Expired" | "Banned" | "Disabled" => failure
    "exp_date": "1767225599",          // read: unix seconds, or null = unlimited
    "is_trial": "0",
    "active_cons": "0",
    "max_connections": "1",
    "allowed_output_formats": ["m3u8", "ts"]
  },
  "server_info": {
    "url": "line.example.tv",
    "port": "8080",
    "timezone": "Europe/London",
    "timestamp_now": 1727350000,       // read
    "time_now": "2024-09-26 12:26:40"  // read
  }
}
```

Decision logic (in order):

1. Response is not a JSON object → error screen "Sorry, there is a problem with your
   playlist. Please contact your IPTV provider. IBOPlayer does not manage or sell playlist
   subscriptions".
2. If `server_info` exists → compute the server time offset (see §8).
3. No `user_info` object → generic playlist error.
4. `user_info.auth == 0` or `status` is `"Expired"`, `"Banned"` or `"Disabled"` → error.
   `"Expired"` gets its own message ("Your playlist subscription has expired…").
5. Success: `exp_date == null` → shown as "Unlimited", else
   `playlist_expire_date = format(exp_date*1000, "YYYY-MM-DD")`. The home page warns when
   the playlist expires in 0–5 days (`ceil((expiry_midnight_local - now)/1 day)`).
6. `playlist_status = user_info.status || "Unknown"` (shown on the account page).
7. Then either stop (load-on-demand, the default) or load everything (§3).

**Network error / timeout on the login call** (anything but a user abort) → the app does
**not** show an error; it silently retries the playlist as an M3U ("general") playlist
using `playlist.origin_url` (`convertToGeneralM3u`). If `origin_url` is missing the
retry fails with "This playlist has no server address…".

### Account-info cache (playlist chooser screen)

The playlist list screen probes each XC playlist with the same URL (timeout 10 s, only if
the stored info is older than 5 min) and stores, under `gz3rYzUIC7_all_playlists_info`,
`{ [hashKey]: { playlist_type:"xc", fetched_at: ISO, expiry_date: exp_date|null,
status: user_info.status|"Unknown", auth: "Active"|"Inactive"|"Unknown" } }`.
`hashKey` = Java-style 32-bit string hash of `host(without scheme, no trailing /)_username_password`.
It also reports this to the IBO backend (covered in `ibo-api-reference.md`).

---

## 3. Catalogue endpoints

| action | extra params | used for | model |
|---|---|---|---|
| `get_live_categories` | – | live categories | `LiveModel.setCategories` |
| `get_live_streams` | – | all live channels | `LiveModel.setMovies` |
| `get_vod_categories` | – | movie categories | `VodModel.setCategories` |
| `get_vod_streams` | – | all movies | `VodModel.setMovies` |
| `get_series_categories` | – | series categories | `SeriesModel.setCategories` |
| `get_series` | – | all series | `SeriesModel.setMovies` |

Never called with `category_id` — the app always downloads the full list and groups
client-side. No timeout is set on these (jQuery default = none).

### Two loading modes

`localStorage["gz3rYzUIC7_load_on_demand"]`: `"1"` (default, written on first successful
XC login when missing) or `"0"`.

- **Load on demand (1)** — after login the home screen opens immediately. When the user
  opens Live / Live Favourites / Sports, Movies or Series for the first time in the session,
  only that section's pair (`categories` + `streams`) is fetched in parallel. Once both
  succeed, `insertMoviesToCategories()` runs and the section opens; the section is then
  flagged loaded (`dataLoaded.live|vod|series`) until the playlist changes or the app
  restarts. Failure → toast "Failed / Data loading failed" (or "Cancelled / Data loading
  aborted" if the user pressed Back). Home search is hidden in this mode.
- **Load all (0)** — the 6 requests run in parallel right after login; when all six
  succeed, all three models are built and the home opens. If any fails, or building
  throws, the app falls back to treating the playlist as M3U (`convertToGeneralM3u`).

Nothing from these lists is persisted — every session re-downloads.

### `get_live_categories` / `get_vod_categories` / `get_series_categories`

```json
[
  { "category_id": "12", "category_name": "UK | SPORTS", "parent_id": 0 },
  { "category_id": "13", "category_name": "UK | NEWS",   "parent_id": 0 }
]
```

Used fields: `category_id` (compared after `toString()`), `category_name`. Everything else
is passed through.

### `get_live_streams`

```json
[
  {
    "num": 1,
    "name": "UK: Sky Sports Main Event HD",
    "stream_type": "live",
    "stream_id": 10231,
    "stream_icon": "http://logo.example.tv/skyme.png",
    "epg_channel_id": "SkySpMainEvHD.uk",
    "added": "1690000000",
    "category_id": "12",
    "custom_sid": "",
    "tv_archive": 1,
    "direct_source": "",
    "tv_archive_duration": 7
  }
]
```

Used fields: `stream_id` (identity, favourites, stream URL, EPG), `name`, `stream_icon`,
`num` (displayed channel number, numeric jump, "number" sort), `category_id`
(`null`/`"null"`/missing → `"undefined"` = Uncategorized), `tv_archive`,
`tv_archive_duration` (replay filter). `epg_channel_id` and `direct_source` are **not** used.

### `get_vod_streams`

```json
[
  {
    "num": 1,
    "name": "EN - Dune: Part Two (2024)",
    "stream_type": "movie",
    "stream_id": 55012,
    "stream_icon": "http://img.example.tv/dune2.jpg",
    "rating": "8.2",
    "rating_5based": 4.1,
    "added": "1726000000",
    "category_id": "40",
    "container_extension": "mkv",
    "custom_sid": null,
    "direct_source": ""
  }
]
```

Used: `stream_id`, `name`, `stream_icon`, `rating` (Top Rated + sort), `added` (unix seconds;
"Newly Added" = within 15 days, and "added" sort), `category_id`, `container_extension`
(movie URL), `num` ("number" sort).

### `get_series`

```json
[
  {
    "num": 1,
    "name": "The Bear",
    "series_id": 3301,
    "cover": "http://img.example.tv/bear.jpg",
    "plot": "A young chef…",
    "cast": "Jeremy Allen White",
    "director": "",
    "genre": "Drama / Comedy",
    "releaseDate": "2022-06-23",
    "last_modified": "1726500000",
    "rating": "8.6",
    "rating_5based": 4.3,
    "backdrop_path": ["http://img.example.tv/bear_bd.jpg"],
    "youtube_trailer": "",
    "episode_run_time": "30",
    "category_id": "70"
  }
]
```

Used: `series_id` (identity), `name`, `cover`, `rating`, `last_modified` ("Recently
Added/Updated" = within 15 days; also what "added" sort uses for series), `category_id`,
`plot`, `cast`, `genre`, `releaseDate` (summary screen header before info loads).

---

## 4. `get_vod_info` (movie details)

```
GET {base}/player_api.php?username=U&password=P&action=get_vod_info&vod_id={stream_id}
```

Called when a movie tile is focused (hover preview, only if the TMDB setting is on and the
info is not cached) and when the movie details screen opens (always, for XC).

```json
{
  "info": {
    "name": "Dune: Part Two",
    "tmdb_id": "693134",
    "movie_image": "http://img.example.tv/dune2.jpg",
    "backdrop_path": ["http://img.example.tv/dune2_bd.jpg"],
    "youtube_trailer": "Way9Dexny3w",
    "genre": "Science Fiction, Adventure",
    "plot": "Paul Atreides unites with Chani…",
    "description": "Paul Atreides unites with Chani…",
    "cast": "Timothée Chalamet, Zendaya",
    "director": "Denis Villeneuve",
    "releasedate": "2024-02-27",
    "duration": "02:46:00",
    "duration_secs": 9960,
    "rating": "8.2",
    "age": "PG-13"
  },
  "movie_data": { "stream_id": 55012, "name": "Dune: Part Two", "container_extension": "mkv" }
}
```

Only `info` is read: `name`, `description || plot`, `cast`, `director`, `releasedate ||
releaseDate`, `duration`, `genre`, `rating`, `age`, `tmdb_id || tmdb`, `backdrop_path`
(array; `[0]` used; if absent `movie_image`), `youtube_trailer`. `movie_data` is ignored —
the playback extension comes from the list item's `container_extension`.
Missing/empty `info` → nothing shown (the list's own name/poster/rating stay).

Cached in `gz3rYzUIC7_saved-movie-info` (see `data-models.md` §Persisted data): key
`"vod" + stream_id`, value `{ info: pick(info, [name, duration, cover, cover_big,
movie_image, releasedate, releaseDate, director, actors, cast, description, plot, genre,
rating, backdrop_path, tmdb, tmdb_id]) }`. Hover preview reads the cache first; the details
screen always refetches.

## 5. `get_series_info` (seasons + episodes)

```
GET {base}/player_api.php?username=U&password=P&action=get_series_info&series_id={series_id}
```

```json
{
  "seasons": [
    { "season_number": 1, "name": "Season 1", "episode_count": 8, "cover": "…", "air_date": "2022-06-23" }
  ],
  "info": { "name": "The Bear", "releaseDate": "2022-06-23", "plot": "…", "cast": "…", "genre": "…",
            "rating": "8.6", "backdrop_path": ["…"], "tmdb": "136315" },
  "episodes": {
    "1": [
      {
        "id": "880011",
        "episode_num": 1,
        "title": "The Bear - S01E01 - System",
        "container_extension": "mp4",
        "info": { "duration_secs": 1800, "duration": "00:30:00", "movie_image": "…", "plot": "…" },
        "season": 1
      }
    ]
  }
}
```

Parsing (exactly as `series_summary.js`):

1. `current_series.info = response.info`.
2. Proceed only if `response.episodes` is truthy **and** (`seasons.length > 0` **or**
   `episodes` is a non-empty array/object). Otherwise toast "No seasons available" and go back.
3. If `episodes` is an **array**, convert it: element `i` (only if itself an array) becomes key
   `String(i+1)`.
4. Build seasons **from the `episodes` keys only** (the `seasons` array is not used for
   names, covers or order):
   - sort keys: numeric keys ascending first, then non-numeric keys alphabetically;
   - `season_number = parseInt(key)`; non-numeric keys get the lowest unused positive
     number;
   - `name = "Season " + season_number`, `cover` = a bundled placeholder image,
     `episodes = episodes[key]`;
   - drop seasons with no episodes; sort by `season_number`.
5. Episode fields used: `id` (stream URL), `container_extension`, `title` (fallback
   `"Episode " + (index+1)`), `info.duration_secs` (shown as `floor(secs/60) + "min"`).
6. Series info cached like movies with key `"series" + series_id` (hover preview only).

```ts
function normalizeSeasons(episodes: Record<string, XcEpisode[]> | XcEpisode[][]): Season[] {
  const map: Record<string, XcEpisode[]> = Array.isArray(episodes)
    ? Object.fromEntries(episodes.map((e, i) => [String(i + 1), e]).filter(([, e]) => Array.isArray(e)))
    : episodes;
  const keys = Object.keys(map).sort((a, b) => {
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return a.localeCompare(b);
  });
  const used = new Set<number>(); let fallback = 1; const out: Season[] = [];
  for (const key of keys) {
    let n = parseInt(key, 10);
    if (isNaN(n)) { while (used.has(fallback)) fallback++; n = fallback++; }
    used.add(n);
    out.push({ season_number: n, name: `Season ${n}`, episodes: map[key] ?? [] });
  }
  return out.filter(s => s.episodes.length > 0).sort((a, b) => a.season_number - b.season_number);
}
```

---

## 6. Stream URLs

```ts
type StreamKind = 'live' | 'movie' | 'series';

/** getMovieUrl in common.js */
function xcStreamUrl(p: Playlist, kind: StreamKind, id: string | number, ext: string,
                     streamFormatSetting: 'default' | 'ts' | 'm3u8' = 'default'): string {
  if (kind === 'live') {
    if (streamFormatSetting !== 'default') {
      ext = streamFormatSetting;
    } else {
      // look at the output= of the original get.php URL, if any
      const out = (p.origin_url ?? '').split('output=')[1] ?? '';
      if (out === 'mpegts' || out === 'ts') ext = 'ts';
      else if (out === 'hls' || out === 'm3u8') ext = 'm3u8';
      // else keep the caller's ext
    }
  }
  return `${apiBase(p)}/${kind}/${p.username}/${p.password}/${id}.${ext}`;
}

// Live:    xcStreamUrl(p, 'live',   ch.stream_id, 'ts')
// Movie:   xcStreamUrl(p, 'movie',  movie.stream_id, movie.container_extension)
// Episode: xcStreamUrl(p, 'series', episode.id, episode.container_extension)
```

Examples:

```
http://line.example.tv:8080/live/demo123/pass456/10231.ts
http://line.example.tv:8080/movie/demo123/pass456/55012.mkv
http://line.example.tv:8080/series/demo123/pass456/880011.mp4
```

- Live defaults to **`.ts`**. `settings.stream_format` exists (default `"default"`, persisted
  as `gz3rYzUIC7_stream_format`) but the TV UI has no control for it, so in practice the
  choice comes only from `output=` in `origin_url`. The `output=` split takes everything
  after `output=` — `...&output=ts&x=1` would yield `ts&x=1` and not match.
- If the smart proxy is on, every URL (API and media) is prefixed with the proxy URL; see
  `services.md` (not part of this document).

## 7. Catch-up (timeshift) URL

See `epg-and-catchup.md` for EPG and timing. The URL builder
(`LiveModel.getProgrammeVideoUrl`, XC only):

```ts
/** programme.start/stop are local-wall-clock strings "YYYY-MM-DD HH:mm" (already shifted
 *  by getLocalChannelTime). timeDiffMin = time_difference_with_server (§8). */
function xcTimeshiftUrl(p: Playlist, streamId: string | number,
                        programme: { start: string; stop: string }, timeDiffMin: number) {
  const start = moment(programme.start, 'YYYY-MM-DD HH:mm')
    .subtract(timeDiffMin, 'minute')          // back to the server's wall clock
    .format('YYYY-MM-DD:HH-mm');              // e.g. 2024-09-25:20-00
  const minutes = (s: string) => Math.floor(new Date(s).getTime() / 60000);
  const duration = minutes(programme.stop) - minutes(programme.start);   // whole minutes
  return {
    duration,
    url: `${apiBase(p)}/streaming/timeshift.php?username=${p.username}&password=${p.password}` +
         `&stream=${streamId}&start=${start}&duration=${duration}`,
  };
}
```

Example: `http://line.example.tv:8080/streaming/timeshift.php?username=demo123&password=pass456&stream=10231&start=2024-09-25:20-00&duration=60`

The alternative `/timeshift/{u}/{p}/{duration}/{start}/{id}.ts` form is **not** used.

## 8. Server time offset

On login, if `server_info` is present:

```ts
// calculateTimeDifference(time_now, timestamp_now)
// new Date("2024-09-26 12:26:40") parses the server's wall clock AS DEVICE-LOCAL time.
time_difference_with_server = Math.trunc((timestamp_now * 1000 - new Date(time_now).getTime()) / 60000);
// = (device UTC offset − server UTC offset) in minutes. Default 0.
```

It is added to every EPG time (see `epg-and-catchup.md`) and subtracted when building the
timeshift `start`.

## 9. EPG actions

| action | params | where | details |
|---|---|---|---|
| `get_short_epg` | `stream_id`, `limit=30` | live player, now/next | `epg-and-catchup.md` §2 |
| `get_simple_data_table` | `stream_id` | Replay (catch-up list), EPG guide grid | `epg-and-catchup.md` §3 |

`xmltv.php` is **never** used, nor is `epg_channel_id`.

---

## 10. Edge cases handled

- `category_id` of `null`, `"null"` or missing → `"undefined"` (the "Uncategorized"
  category is added only if it ends up non-empty).
- The whole XC path is abortable: Back while loading aborts outstanding requests
  (`textStatus === "abort"` is ignored, no fallback).
- A 2-minute "loading too long" timer offers the user options (retry/change playlist); this
  is TV UI.
- VOD recent ids are compared as numbers for XC (`parseInt(stream_id)`), because the
  watch-progress store may hold strings while the list holds numbers.

## Notes / uncertainties

- **No URL encoding** of username/password anywhere (API, stream, timeshift). Credentials
  containing `&`, `#`, `+` or spaces would break. Recommended for mobile: encode.
- Main login path does not add `http://` when `url` has no scheme (only the chooser's info
  probe does). A scheme-less URL would be requested relative to the app origin and fail,
  then fall back to M3U.
- `new Date("YYYY-MM-DD HH:mm:ss")` (server `time_now`) is invalid on some engines
  (older Safari/JSC → `NaN`, so offset becomes `NaN`). Hermes/V8 parse it as local time. Use an
  explicit parser (`moment(str, 'YYYY-MM-DD HH:mm:ss')`) on mobile.
- The login response's `status` check is case-sensitive (`"Expired"`), and `auth == 0`
  uses loose equality (`"0"` counts).
- On a network error the app silently re-tries as M3U instead of reporting the XC error;
  this can turn an "account expired / wrong password" into a confusing M3U failure.
- `get_vod_info`'s `movie_data.container_extension` is ignored; if the list item lacks
  `container_extension` the URL ends in `.undefined`.
- Live `ext` override reads `origin_url`, which is only set for entries converted from a
  `/playlist/` URL or created locally; backend XC entries without it always get `.ts`.
- `time_format` (12/24 h) exists in settings but is never loaded from storage (always
  `"24"`); the 12 h branches in EPG formatting are dead code.
