# Stalker / MAG / Ministra portals

The full Stalker middleware protocol as implemented by the TV app's `StalkerClient`
(transport + auth) and `stalkerIntegration` (mapping into the app's models, pagination,
favourites). All parameter names and header strings below are copied verbatim.

Source: `core/js/StalkerClient.js`, `core/js/stalker_integration.js`,
`core/js/login_operation.js` (stalker branch), `core/js/common.js`
(`buildStalkerMac`, `getOrCreateFallbackMac`, `getStalkerMac`),
`core/js/portal_list_page.js`, `core/js/portal_edit_page.js`, `core/js/playlist.js`,
`homes/iboplayer/js/home_operation.js`, `features/epg_guide/js/epg_guide_page.js`.

---

## 1. Portal record

A portal is a playlist entry with `playlist_type: "stalker"` (full type in
`data-models.md`). Fields the content layer uses:

| field | meaning |
|---|---|
| `id` | playlist id (prefix of all per-playlist storage keys) |
| `portal_name` / `playlist_name` | display name |
| `portal_address` (fallback `url`) | portal URL as typed by the user (any form, normalised by the client) |
| `portal_fallback_address` | optional second URL tried when the primary fails |
| `stalker_mac_address` (legacy `stalker_mac`) | MAC sent to the portal, `AA:BB:CC:DD:EE:FF` |
| `stalker_mac_mode` | `"prefix_001A79"` (default) or `"prefix_001C1D"` — which OUI the edit screen prefills |
| `stalker_stb_profile` | optional per-portal profile key (`mag250`/`mag322`/`mag520`/`iboplayer`) |
| `expiry` | expiry string captured from `get_profile` at save time |

When a portal is saved (`portal_edit_page.savePortal`): name, URL and MAC are required, MAC
must match `/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/`. The app first **connects** (full
handshake + profile). If the profile is not `status === 1`, it tries the fallback URL (if
given); if that also fails it shows `profile.msg` or "Portal connection failed" / "Server
not responding" (timeout). On success it writes to the IBO backend (see
`ibo-api-reference.md`):

```json
{
  "id": null, "is_created": true, "playlist_type": "stalker", "origin_type": "stalker",
  "origin_url": "http://portal.example.tv:8080/c/", "url": "http://portal.example.tv:8080/c/",
  "portal_name": "My Portal", "portal_address": "http://portal.example.tv:8080/c/",
  "portal_fallback_address": "", "stalker_mac_address": "00:1A:79:4C:9E:21",
  "stalker_mac_mode": "prefix_001A79", "playlist_name": "My Portal",
  "username": "", "password": "", "expiry": "2025-03-01 00:00:00"
}
```

### Virtual MAC

- `buildStalkerMac(hwMac)`: upper-case, `-`→`:`, must have 6 octets →
  `"00:1A:79:" + last three octets`.
- `getStalkerMac()`: uses the device's hardware MAC (TV platform APIs) → `buildStalkerMac`;
  otherwise `getOrCreateFallbackMac()`: a random `00:1A:79:XX:XX:XX` generated once and
  stored in localStorage under the **unprefixed** key `stalker_mac`.
- The portal edit screen pre-fills `<OUI>:<suffix>` where OUI is `00:1A:79` or
  `00:1C:1D` (user toggle) and suffix is the last three octets of the virtual MAC. The user
  can type any MAC.
- **Phone app:** Android gives no hardware MAC, so use the random persisted MAC path
  (`00:1A:79:` + 3 random bytes, generated once, stored).

---

## 2. Transport

### 2.1 URL normalisation (`_normalizeUrl`)

Trim, then strip (case-insensitive, in this order): `/c/server/load.php…`,
`/stalker_portal/server/load.php…`, `/portal/server/load.php…`,
`/ministra/server/load.php…`, `/ministra/server/api.php…`, `/server/load.php…`,
`/magLoad.php…`, `/load.php…`; then trailing path segments `/c/server`,
`/stalker_portal/server`, `/portal/server`, `/ministra/server`, `/ministra`, `/server`,
`/stalker_portal`, `/portal`, `/c` (each optionally with trailing `/`); then the query string
and trailing slashes. `portalOrigin` = `scheme://host[:port]` of the result (must match
`^https?://[^/]+`, else error "Invalid portal URL"). Only the **origin** is used to build
loader URLs.

```ts
function normalizePortalUrl(url: string): string {
  let u = (url || '').trim();
  for (const re of [
    /\/c\/server\/load\.php.*$/i, /\/stalker_portal\/server\/load\.php.*$/i, /\/portal\/server\/load\.php.*$/i,
    /\/ministra\/server\/load\.php.*$/i, /\/ministra\/server\/api\.php.*$/i, /\/server\/load\.php.*$/i,
    /\/magLoad\.php.*$/i, /\/load\.php.*$/i,
    /\/c\/server\/?$/i, /\/stalker_portal\/server\/?$/i, /\/portal\/server\/?$/i, /\/ministra\/server\/?$/i,
    /\/ministra\/?$/i, /\/server\/?$/i, /\/stalker_portal\/?$/i, /\/portal\/?$/i, /\/c\/?$/i,
    /\?.*$/, /\/+$/,
  ]) u = u.replace(re, '');
  return u;
}
```

### 2.2 Identity values (computed per connect)

```ts
mac        = macAddress.trim().toUpperCase();          // validated with the MAC regex
sn         = mac.replace(/:/g, '');                     // e.g. "001A794C9E21"
deviceId   = sha1(mac);                                  // hex
random     = rand36(8) + rand36(8);                      // Math.random().toString(36).slice(2,10) twice
deviceId2  = sha1(mac + random);
signature  = sha1(deviceId + deviceId2 + mac);
timezone   = "UTC";                                      // constant
```

(If the handshake returns `js.random`, `random` is replaced, but `deviceId2`/`signature`
were already computed from the local random.)

### 2.3 STB profiles (verbatim)

| key | stb_type | User-Agent | X-User-Agent | ver |
|---|---|---|---|---|
| `mag250` | `MAG250` | `Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 4 rev: 874 Mobile Safari/533.3` | `Model: MAG250; Link: Ethernet` | `ImageDescription:%200.2.18-r12-874;ModelDescription:MAG250;ETH_MAC:00:00:00:00:00:00;HDMI:1;ScreenWidth:1920;ScreenHeight:1080;` |
| `mag322` | `MAG322` | `Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Mobile Safari/533.3` | `Model: MAG322; Link: Ethernet` | `ImageDescription:%200.2.18-r12-250;ModelDescription:MAG322;ETH_MAC:00:00:00:00:00:00;HDMI:1;ScreenWidth:1920;ScreenHeight:1080;` |
| `mag520` | `MAG520` | `Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/68.0.3440.106 Chrome/68.0.3440.106 Safari/537.36 MAG520 stbapp ver: 4` | `Model: MAG520; Link: Ethernet` | `ImageDescription:%200.2.18-r12-254;ModelDescription:MAG520;ETH_MAC:00:00:00:00:00:00;HDMI:1;ScreenWidth:1920;ScreenHeight:1080;` |
| `iboplayer` | `MAG254` | `Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG254 stbapp ver: 4 rev: 2721 IBOPlayer Mobile Safari/533.3` | `Model: IBOPlayer; Link: Ethernet` | `ImageDescription:%200.2.18-r14-pub-254;ModelDescription:IBOPlayer;ETH_MAC:00:00:00:00:00:00;HDMI:1;ScreenWidth:1920;ScreenHeight:1080;` |

`hw_version` is `2.4.14-4228-g5e21c7f` for all. The brand word in the `iboplayer` row is
`APP_CONFIG.stalkerIdentity || APP_CONFIG.brand.name` = `IBOPlayer`. Legacy key
`stbstalker` maps to `iboplayer`. Unknown key → `mag250`.

Auto-retry order: configured profile first, then the rest of `["mag250","mag322","mag520"]`
(`iboplayer` is never an automatic fallback).

### 2.4 Headers and cookie

`_buildHeaders(withAuth)`:

```
Accept: */*
User-Agent: <profile.ua>
X-User-Agent: <profile.x_user_agent>
Cookie: PHPSESSID=null; timezone=UTC; mac=00%3A1A%3A79%3A4C%3A9E%3A21; stb_lang=English; language=en
Authorization: Bearer <token>        (only when withAuth and a token exists)
```

**TV-only detail:** the WebView forbids `User-Agent` and `Cookie`, so the TV actually sends
only `Accept`, `X-User-Agent` and `Authorization`. A native phone client *can* send
`User-Agent` and `Cookie`; doing so is closer to a real MAG box and recommended (portals
that gate on UA may accept the phone where they reject the TV). `withCredentials: false`.

### 2.5 Request helpers

Two ways requests are made; both put params in the **query string** (GET) via jQuery's
`$.param`, i.e. URL-encoded (`mac=00%3A1A%3A79%3A4C%3A9E%3A21`). Timeout 15 s.

**`_stbGet(loader, params, withAuth)`** — handshake and get_profile only. Plain GET, no
extra params added, no POST retry, does not pick up rotated tokens. Non-JSON → `null`.
Errors: timeout → `TIMEOUT`; anything else (including status 0) → `AUTH_FAILED {status}`.

**`_request(params, withAuth=true)`** — every other call. Merged params:

```
mac=<MAC>&sn=<SN>&JsHttpRequest=1-xml[&token=<token> when authed]&<call params…>
```

(call params override base params with the same name). Method = `preferred_method` from the
quirks cache, default GET. Responses:

- empty body (`undefined`/`null`/`""`) → reject `EMPTY_RESPONSE`;
- string → `JSON.parse` attempted (failure passes the raw string through);
- if `data.js.token` exists, the client's token is replaced (**token rotation**);
- errors: timeout → `TIMEOUT`; `xhr.status === 0` → `NETWORK_UNREACHABLE`;
  **405 on GET → persist `preferred_method: "POST"` in the quirks cache and retry once as
  POST** (params in the body); any other status → `AUTH_FAILED {status}`.

Error codes: `"AUTH_FAILED"`, `"TIMEOUT"`, `"EMPTY_RESPONSE"`, `"NETWORK_UNREACHABLE"`
(reject objects `{ code, status?, msg? }`).

### 2.6 Quirks cache

`localStorage["stalker_quirks_" + portalHost.replace(/[^a-zA-Z0-9._-]/g, "_")]`
(**not** prefixed with the app's storage id), e.g. `stalker_quirks_portal.example.tv_8080`:

```json
{ "loader": "http://portal.example.tv:8080/c/server/load.php", "preferred_method": "POST" }
```

`loader` is rewritten on every successful discovery (which drops `preferred_method`, see
Notes).

### 2.7 Proxy (TV-specific)

If the app's smart proxy is on, every portal URL is sent as `PROXY_PREFIX + target`, with
the params serialised into the target URL. If a full connect cascade fails through the proxy,
the whole cascade is repeated direct, and that portal is remembered (in memory, per session)
as "direct only". Stream URLs are still proxied. The proxy is described in `services.md`;
if the mobile app has no proxy, ignore this.

---

## 3. Connect flow

```
connect(portalUrl, mac, fallbackUrl?)
  for url in [portalUrl, fallbackUrl?]:              // fallback only after ALL profiles failed on primary
    for profile in [configured, ...others]:           // next profile ONLY on AUTH_FAILED
      _connectToUrl(url, mac):
        normalise url, validate MAC, compute ids
        _discoverLoader()  -> loader URL (+ token if the probe got one)
        token ? get_profile : handshake then get_profile
  (TV: if everything failed through the smart proxy, repeat once direct)
  on success with status==1 && registered!==false: start keepalive
```

Concurrent `connect()` calls on the same client with the same `url|mac` share one promise.
Other errors (`TIMEOUT`, `NETWORK_UNREACHABLE`, `EMPTY_RESPONSE`) stop the profile loop for
that URL and go straight to the fallback URL (if any).

### 3.1 Loader discovery

If the quirks cache has `loader`, probe it first; on failure (or no cache) probe these
paths on `portalOrigin`, **in order, one at a time**:

```
/portal.php
/stalker_portal/server/load.php
/portal/server/load.php
/ministra/server/load.php
/ministra/server/api.php
/server/load.php
/c/server/load.php
/mag/server/load.php
/stb/server/load.php
/magLoad.php
/load.php
/mag/server/magload.php
/server/magload.php
/portal/magload.php
/stalker_portal/server/magload.php
```

A probe is a handshake (`_stbGet`, no auth). It **wins** if the reply parses to a non-null
value: with `js.token` → `{url, token, random}`; without → `{url, token:null}` (explicit
handshake follows). Non-JSON/empty/error → next path. All fail → `AUTH_FAILED "No valid
loader path found"` (so the next STB profile is tried — each profile re-probes everything).

### 3.2 Handshake

```
GET {loader}?mac=00%3A1A%3A79%3A4C%3A9E%3A21&sn=001A794C9E21&action=handshake&type=stb&prehash=0
Accept: */*
X-User-Agent: Model: MAG250; Link: Ethernet
```

```json
{ "js": { "token": "8F3C2A0D7E6B4F1A9C5D2E8B7A6F3C1D", "random": "b1c2d3e4f5a6b7c8", "not_valid": 0 } }
```

No `js.token` in the explicit handshake → `AUTH_FAILED "No token in handshake response"`.

### 3.3 get_profile

```
GET {loader}?mac=00%3A1A%3A79%3A4C%3A9E%3A21&sn=001A794C9E21&action=get_profile&type=stb
    &ver=ImageDescription%3A%25200.2.18-r12-874%3BModelDescription%3AMAG250%3B...
    &device_id=<sha1 hex>&device_id2=<sha1 hex>&signature=<sha1 hex>
    &stb_type=MAG250&not_valid_token=0&num_banks=1&hw_version=2.4.14-4228-g5e21c7f
Authorization: Bearer 8F3C2A0D7E6B4F1A9C5D2E8B7A6F3C1D
```

Note `ver` contains a literal `%20`, which gets encoded again to `%2520`.

```json
{ "js": { "id": "10452", "name": "001A794C9E21", "status": 1, "phone": "2025-03-01 00:00:00",
          "end_date": null, "expire_billing_date": "0000-00-00 00:00:00", "msg": "" } }
```

Mapping to the app's profile result:

```ts
interface StalkerProfile { status: 0 | 1; expiry: string; msg: string; expired: boolean; registered: boolean }

function mapProfile(js: any): StalkerProfile {
  const status = [1, 0, '1', '0'].includes(js.status) ? 1 : 0;      // 0 AND 1 both mean "OK"
  const expiry = js.phone || js.end_date || js.expire_date || '';
  const t = expiry ? Date.parse(expiry) : NaN;
  return {
    status, expiry, msg: js.msg || '',
    expired: !isNaN(t) && t < Date.now(),
    registered: js.id !== undefined && js.id !== null && Number(js.id) !== 0,
  };
}
```

No `js` → `EMPTY_RESPONSE`.

### 3.4 Login decision (`proceed_login`)

Profile used: `playlist.stalker_stb_profile || settings.stalker_stb_profile || "mag250"`.

- `!profile || status !== 1 || expired || registered === false` → back to the portal list
  with: expired or unregistered → "Your portal subscription has expired. Please contact your
  IPTV provider."; otherwise → "Sorry, the portal is currently unavailable. Please contact
  your IPTV provider."
- Connect rejected → "Sorry, the portal is currently unavailable…".
- Success → client becomes the active client; if the working profile differs from the
  configured one (and the configured one is not `iboplayer`), save it as
  `gz3rYzUIC7_stalker_stb_profile`. Home opens in on-demand mode (always, regardless of the
  load-on-demand setting).

### 3.5 Keepalive and reconnect

- Every **90 s** while a token exists:
  `_request({ action: "get_events", type: "watchdog", init: "0" })`; a returned
  `js.token` replaces the token. On `AUTH_FAILED` / 401 / 403 → `connect(portalBase, mac)`
  again (no fallback URL).
- `ensureClient()` (called before every data request): active client with a token → use it;
  otherwise build a fresh client from the current playlist (portal_address/url, MAC,
  stored profile, fallback) and connect; concurrent callers share the pending connect. A
  non-OK profile sends the user back to the portal list with the messages above.
- Keepalive is stopped when leaving the live page, switching portal, or replacing the client.

---

## 4. Content API

All via `_request` with auth (`token` param + `Authorization: Bearer`). Base params
(`mac`, `sn`, `JsHttpRequest=1-xml`, `token`) are implied below.

### 4.1 Paged-result helper

`get_ordered_list` replies are normalised by `pageResult`:

```ts
function pageResult(data: any): { data: any[]; total_items: number } {
  if (!data || !data.js) return { data: [], total_items: 0 };
  const js = data.js;
  const items = Array.isArray(js) ? js : (js.data || []);
  let total = parseInt(js.total_items, 10);
  if (isNaN(total)) total = items.length;
  return { data: items, total_items: total };
}
```

Typical reply: `{"js":{"total_items":342,"max_page_items":14,"selected_item":0,"cur_page":1,"data":[…]}}`.

### 4.2 Categories

| type | params | result |
|---|---|---|
| live | `action=get_genres&type=itv` | `data.js` (array) |
| movies | `action=get_categories&type=vod` | `data.js` |
| series | `action=get_categories&type=series` | `data.js` |

```json
{ "js": [ { "id": "*", "title": "All", "alias": "*" },
          { "id": "5", "title": "UK | Sports", "alias": "uk_sports", "censored": 0 },
          { "id": "9", "title": "XXX Adults", "alias": "adult", "censored": 1 } ] }
```

Mapping: skip entries whose `(title || name).trim().toLowerCase()` is `all`,
`all channels`, `all movies` or `all series`; others →
`{ category_id: String(id), category_name: title || name || "", parent_id: "0" }`.
`censored` is **not** used (adult detection is by name, see `data-models.md`).
Then the model is built with **no items** (`setMovies([])` + `insertMoviesToCategories()`),
the Recently Viewed / Favourites rows are restored from stored objects (§5), and for
VOD the `top_rated`/`newly_added` rows and for series `top_rated`/`recently_modified` rows
are removed. No "Search All" row is added for Stalker. Categories are fetched once per
section per session (like load-on-demand).

### 4.3 Live channels (paged, infinite scroll)

```
action=get_ordered_list&type=itv&genre=<catId>&force_ch_link_check=0&fav=0&sortby=number&hd=0&page_offset=0&p=<page 1-based>
```

```json
{ "js": { "total_items": 212, "max_page_items": 14, "data": [
  { "id": "1284", "name": "Sky Sports Main Event", "number": "101",
    "cmd": "ffmpeg http://localhost/ch/1284_", "logo": "/stalker_portal/misc/logos/320/1284.png",
    "tv_archive": "1", "tv_archive_duration": "7", "epg_id": "", "censored": "0", "use_http_tmp_link": "1" } ] } }
```

- Opening a category loads page 1 only; further pages load when the user scrolls within 200
  px of the bottom (or presses Down on the last row): page+1, de-duplicated by `id`. A page
  with zero new ids clamps the total (portal repeating pages). Stops when
  `loaded >= total_items`.
- Virtual categories (`all`, `recent`, `favourite`, `0`) show their stored objects without a
  request.
- The initial category is the first that is not virtual, not `*`, and not named `all` /
  `all channels`.

Mapping (`mapLiveChannel`):

```ts
function mapLiveChannel(ch: any, catId: string, portalOrigin: string): LiveChannel {
  const archiveFlag = ch.archive || ch.tv_archive || ch.has_archive || ch.mark_archive || 0;
  let days = 0;
  if (ch.tv_archive_duration) days = parseInt(ch.tv_archive_duration, 10) || 0;
  else if (ch.archive_range && typeof ch.archive_range === 'object') {
    if (ch.archive_range.days) days = parseInt(ch.archive_range.days, 10) || 0;
    else if (ch.archive_range.to && ch.archive_range.from) {
      const from = new Date(ch.archive_range.from).getTime(), to = new Date(ch.archive_range.to).getTime();
      if (to > from) days = Math.ceil((to - from) / 86400000);
    }
  } else if (ch.archive_days) days = parseInt(ch.archive_days, 10) || 0;
  if (archiveFlag && days === 0) days = 7;
  return {
    stream_id: String(ch.id), name: ch.name || '',
    stream_icon: absUrl(ch.logo || ch.screenshot_uri || '', portalOrigin),
    num: ch.number || ch.cmd_id || 0, category_id: String(catId), cmd: ch.cmd || '',
    tv_archive: archiveFlag ? 1 : 0, tv_archive_duration: days, epg_channel_id: ch.epg_id || '',
  };
}
// absUrl: http(s) kept; "/x" -> origin + "/x"; "x" -> origin + "/x"
```

Note: `archiveFlag` is truthy for the string `"0"` (see Notes).

### 4.4 Movies (paged)

```
action=get_ordered_list&type=vod&category=<catId>&page_offset=0&p=<page>&search=&sort=<sort>&fav=0&hd=0
```

`sort` from the app's `vod_sort` setting: `a_z`→`name`, `rating`→`rating`, `default`/`added`
→`added`, anything else (`z_a`) → `added`.

On category open the app fetches **up to 5 pages** in a row (stops early when a page adds no
new id or `loaded >= total_items`), then sorts client-side (§4.10). More pages load on
scroll (within 150 px of the bottom), again up to 5 pages per batch.

```json
{ "js": { "total_items": 1200, "data": [
  { "id": "7781", "name": "EN - Dune: Part Two (2024)", "screenshot_uri": "/stalker_portal/screenshots/7781.jpg",
    "rating_imdb": "8.2", "description": "Paul Atreides…", "cmd": "/media/file_7781.mpg",
    "series": [], "storage_id": "", "added": "2024-09-01 10:00:00", "tmdb_id": "693134",
    "director": "Denis Villeneuve", "actors": "Timothée Chalamet", "genres_str": "Sci-Fi", "year": "2024",
    "time": "166" } ] } }
```

Mapping (`mapVodMovie`): `stream_id: String(id)`, `name`, `stream_icon: absUrl(screenshot_uri)`,
`stream_type: "movie"`, `category_id: String(catId)`, `rating: rating_imdb`,
`plot: description`, `cmd`, `series`, `storage_id`, `added`, `tmdb_id`, `director`,
`cast: actors`, `genre: genres_str`, `year`, `duration: time ? time + " min" : ""`
(all defaulting to `""`).

### 4.5 Series list (paged)

```
action=get_ordered_list&type=series&category=<catId>&page_offset=0&p=<page>&sort=<sort>&search=&fav=0
```

Same 5-page batching. Mapping (`mapSeriesItem`): `series_id: String(id)`, `name`,
`cover: absUrl(screenshot_uri)`, `stream_type: "series"`, `category_id` and
`stalker_category_id: String(catId)`, `year`, `plot: description`, `genre: genres_str`,
`cast: actors`, `director`, `rating: rating_imdb`, `added: added || last_modified`,
`tmdb_id`.

### 4.6 Seasons and episodes

Seasons:

```
action=get_ordered_list&type=series&movie_id=<series_id>&season_id=0&episode_id=0&category=<stalker_category_id|category_id|0>&page_offset=0&p=1&sort=added&fav=0
```

```json
{ "js": { "total_items": 2, "data": [
  { "id": "3301:1", "name": "Season 1", "series_num": 1, "cmd": "eyJ0eXBlIjoic2VyaWVzIiwic2Vhc29uX2lkIjoxfQ==",
    "series": [1, 2, 3, 4, 5, 6, 7, 8], "storage_id": "" },
  { "id": "3301:2", "name": "Season 2", "series_num": 2, "cmd": "…", "series": [1, 2, 3], "storage_id": "" } ] } }
```

Only page 1 is read. Season mapping:
`{ name: s.name || "Season " + n, season_number: String(n), stalker_season_id: String(s.id),
raw_cmd: s.cmd || "", raw_series: Array.isArray(s.series) ? s.series : [],
storage_id: s.storage_id || "", episodes: [] }` with `n = s.series_num || (index+1)`,
sorted by `parseInt(season_number)`.

Episodes are **built locally from `raw_series`** — no request per season:

```ts
episodes = season.raw_series.map(epNum => ({
  id: `${season.stalker_season_id}:${epNum}`, title: `Episode ${epNum}`, name: `Episode ${epNum}`,
  cmd: season.raw_cmd, series: String(epNum), storage_id: season.storage_id,
  season: season.season_number, episode_num: epNum, container_extension: 'mp4', info: {},
}));
```

(`getSeriesEpisodes` with a non-zero `season_id` exists in the client but is not used.)
Series info (plot, rating, backdrop) comes from TMDB — `services.md`.

### 4.7 Stream links (`create_link`)

All return `{ js: { cmd?, url?, … } }`. Helpers:

- `_cleanCmd(s)`: trim; replace `%mac%` (case-insensitive) with the MAC; strip a leading
  `ffrt3 `, `ffrt2 `, `ffrt `, `ffmpeg ` or `auto ` (case-insensitive, followed by
  whitespace); if a whitespace follows a URL containing `://`, cut at it.
- `_linkUrl(js, fields)`: first cleaned field that is an absolute `http(s)` URL; else first
  cleaned field starting with `/` → `portalOrigin + value`; else `""`.
- `_repairMangledLink(resolved, directCmd)`: if `directCmd` is an external `http(s)` URL
  (not localhost/127.0.0.1/0.0.0.0) **and** the path of `resolved` contains a segment like
  `/host.name:1234/` (regex `/\/[A-Za-z0-9.-]+:\d+(\/|$)/` on the path without query) →
  return `directCmd` with `resolved`'s `play_token` spliced in (replace existing
  `play_token=` or append `?|&play_token=`). Otherwise `resolved`.

**Live** (`createLiveStreamUrl(cmd, fallbackId=stream_id)`):

```
action=create_link&type=itv&cmd=<raw channel cmd>&series=&forced_storage=&disable_ad=0&download=0
```

```json
{ "js": { "id": "1284", "cmd": "ffmpeg http://cdn.portal.example.tv/live/play/1284?stream=1284&play_token=Xyz123&sn2=" } }
```

1. `resolved = _linkUrl(js, ["cmd","url"])`; none → error.
2. `resolved = _repairMangledLink(resolved, cleanCmd(cmd))`.
3. If the channel's cmd was a local stub (`http://localhost…`, `127.0.0.1`, `0.0.0.0`) and
   `resolved` is external → use it (even with empty `stream=`).
4. If `resolved` has an empty `stream=` (`/[?&]stream=(&|$)/`): take a fresh `play_token`
   from `resolved` (or `js.cmd`); if the cleaned channel cmd has a non-empty `stream=` →
   return the channel cmd with that token spliced in; else error.
5. Otherwise return `resolved`.
6. On any failure, if `fallbackId` differs from `cmd` and the cleaned cmd, retry
   `create_link` with `cmd=<stream_id>`; accept only an absolute URL (after the mangled-link
   repair) whose `stream=` is not empty.

**Movie** (`createVODStreamUrl(cmd, series, storage_id)`):

```
action=create_link&type=vod&cmd=<movie cmd>&series=<movie.series or "">&forced_storage=<storage_id>&disable_ad=0&download=0
```

`_linkUrl(js, ["url","cmd"])` (note: `url` first) → `_repairMangledLink`.

**Episode** (`createSeriesStreamUrl(cmd, series, storage_id)`):

```
action=create_link&type=series&cmd=<season.raw_cmd>&series=<episode number>&forced_storage=<storage_id>&disable_ad=0&download=0
```

`_linkUrl(js, ["url","cmd"])` → repair; on no URL / no `js` / error → falls back to the VOD
form (`type=vod` with the same cmd/series/storage_id).

Example resolved URL: `http://cdn.portal.example.tv/media/7781.mkv?play_token=AbC987`.

After a successful movie/episode link, the item (movie object, or the whole series object)
is stored in the Stalker "recent" object list (§5).

### 4.8 EPG

Short (live player now/next):

```
action=get_short_epg&type=itv&ch_id=<stream_id>&size=2
```

Normalised to `{ js: { data: [...] } }` whether the portal returned an array or
`{data}`. Fields: `name`/`title`, `descr`/`description`, `time`/`time_to`
(`"YYYY-MM-DD HH:mm:ss"`) or `start_timestamp`/`stop_timestamp` (unix seconds).

Full (catch-up list, EPG guide):

```
action=get_simple_data_table&type=itv&ch_id=<stream_id>&size=<100 for catch-up | 400 for the guide>
```

Returns `{ data: items }` from `js` or `js.data`. Item example:

```json
{ "id": "1727290800_1284", "real_id": "1284_1727290800", "ch_id": "1284", "name": "Premier League Live",
  "descr": "Arsenal v Spurs", "time": "2024-09-25 20:00:00", "time_to": "2024-09-25 22:00:00",
  "start_timestamp": 1727290800, "stop_timestamp": 1727298000, "mark_archive": 1 }
```

Parsing details are in `epg-and-catchup.md`. Stalker titles are **plain text** (never
base64-decode them).

### 4.9 Catch-up link

`createCatchupUrl(cmd, arcStart, arcStop, rawProgramme)` — arcStart/arcStop are unix
seconds computed from the programme's `"YYYY-MM-DD HH:mm"` local strings.

Attempt 1 (timeshift shape):

```
action=create_link&type=itv&cmd=<channel cmd>&series=&forced_storage=&disable_ad=0&download=0&timeshift=1&arc_start=<unix>&arc_stop=<unix>
```

URL = `_linkUrl(js, ["cmd","url"])`. No URL or error → attempt 2.

Attempt 2 (`tv_archive` cascade): from the raw programme take
`realId = String(real_id)`, `rawId = String(id)`;
`realIdTs` = last `_` segment of `realId` if it is 9–11 digits;
`rawIdTs` = first `_` segment of `rawId` if 9–11 digits;
`trail = cmd ends with "_"`; `start = String(arcStart)`.
Ordered attempts (skipping any whose `series` is empty, then de-duplicating identical
`cmd||series` pairs):

| label | cmd | series |
|---|---|---|
| reference_media_mpg (only if rawId) | `auto /media/<rawId>.mpg` | `""` |
| utc_ts_in_cmd | `trail && realIdTs ? cmd+realIdTs : cmd` | realIdTs |
| utc_ts_only | cmd | realIdTs |
| raw_id_ts_in_cmd | `trail && rawIdTs ? cmd+rawIdTs : cmd` | rawIdTs |
| raw_id_ts_only | cmd | rawIdTs |
| classic_ts | `trail && start ? cmd+start : cmd` | start |
| plain_ts | cmd | start |
| ministra_real_id | cmd | realId |
| cmd_real_id | `trail && realId ? cmd+realId : cmd` | `start || realId` |
| raw_id | cmd | rawId |

Each: `action=create_link&type=tv_archive&cmd=<cmd>&series=<series>&forced_storage=&disable_ad=0&download=0`.
First reply with a URL (`_linkUrl(js, ["cmd","url"])`) wins. A reply whose `js.error`
contains `epg data not found` or `no cmd` (case-insensitive) → next attempt; any other
URL-less reply or transport error → the cascade stops with an error.
If everything fails, the player falls back to the **live** link for that channel.

### 4.10 Client-side sort after paging (`_clientSort`)

- `default`/`added`/empty: `parseFloat(added)` descending; ties → `added` string compared
  descending (ISO dates sort correctly).
- `a_z`: `name.localeCompare` ascending; `z_a`: descending.
- `rating`: `parseFloat(rating)` descending.
Each loaded batch is sorted on its own and appended (the full list is not re-sorted).

### 4.11 Search

Only from the global search page (the home search box and the live search are hidden for
Stalker):

```
action=get_ordered_list&type=vod&category=*&page_offset=0&p=1&search=<keyword>&sort=added&fav=0&hd=0
action=get_ordered_list&type=series&category=*&page_offset=0&p=1&search=<keyword>&sort=added&fav=0
```

Page 1 only; mapped with `category_id = item.category || "0"`. No live search.

---

## 5. Stalker-specific local persistence

Because Stalker lists are paged, favourites / recents / custom-category members are stored
as **full item objects**, per playlist:

| key | content | limit |
|---|---|---|
| `gz3rYzUIC7_<playlistId>_stalker_live_favourite_objs` | `LiveChannel[]`, newest first | 500 |
| `gz3rYzUIC7_<playlistId>_stalker_live_recent_objs` | `LiveChannel[]` | 15 |
| `gz3rYzUIC7_<playlistId>_stalker_vod_recent_objs` | `Movie[]` | 15 |
| `gz3rYzUIC7_<playlistId>_stalker_series_recent_objs` | `Series[]` | 15 |
| `gz3rYzUIC7_<playlistId>_stalker_<type>_favourite_objs` | vod/series favourites (written by the collection modal) | 500 |
| `gz3rYzUIC7_<playlistId>_stalker_<type>_cc_<catId>_objs` | custom-category members | 500 |

`persist` = remove existing entry with the same `stream_id || series_id`, `unshift` the new
one, truncate. The regular id-list keys (`…live_favourite`, `…live_recent`) are also written
by the shared model code. On building a section, the stored `recent`/`favourite` objects
replace those rows' contents and `favourite_ids` is rebuilt from them.

A VOD recent object is removed when the movie is watched to the end; a series is removed
when its last saved episode progress is removed.

Other unprefixed keys: `stalker_mac` (random virtual MAC), `stalker_quirks_<host>`.
Prefixed: `gz3rYzUIC7_stalker_stb_profile`.

## 6. What Stalker does not support in this app

- Home: "Live Favourites" tile hidden; Replay tile shows "Replay not available for stalker
  portals"; search box hidden; playlist expiry banner hidden.
- Live page: search button and category arrangement hidden; category counts not shown.
- Catch-up code exists (§4.9) but is only reachable if the Replay page is opened for a
  Stalker portal, which the iboplayer home blocks (see Notes).
- EPG guide works (uses `get_simple_data_table`, size 400).

## Notes / uncertainties

- `settings.stalker_stb_profile` is saved but not re-loaded on boot (`initFromLocal` does not
  list it), so after a restart login uses `playlist.stalker_stb_profile || "mag250"`. The
  portal list page reads the localStorage key directly. Likely a bug; mobile should load it.
- Successful loader discovery overwrites the quirks entry with `{loader}` only, dropping a
  learned `preferred_method: "POST"`; the next 405 re-learns it.
- `_stbGet` maps network errors (status 0) to `AUTH_FAILED`, so an unreachable host makes
  the client walk all 15 paths × 3 profiles before failing.
- `sn` is just the MAC without colons, not a real MAG serial. `deviceId2`/`signature` use a
  locally generated random even if the portal returns its own.
- Archive flag: string `"0"` is truthy in JS, so a channel with `tv_archive: "0"` and no
  duration gets `tv_archive: 1, tv_archive_duration: 7`.
- Live channel `num` can be a string (`"101"`); numeric channel jump compares with `===`
  against a number, so it never matches for Stalker.
- Stalker catch-up from the Replay page is unreachable in iboplayer (home blocks Replay for
  Stalker) — confirm with product whether the mobile app should expose it.
- Season list reads only page 1 of the seasons query.
- `timezone=UTC` is hardcoded in the cookie; portals return EPG times in their own zone
  (see `epg-and-catchup.md`).
