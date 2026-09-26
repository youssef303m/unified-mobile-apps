# Auxiliary services

Everything the IBOPlayer TV app calls besides the IBO panel API ([ibo-api-reference.md](ibo-api-reference.md)) and the IPTV providers. Constants are in [config.json](config.json).

Contents: [Analytics](#analytics) · [Stararcs smart proxy](#stararcs) · [TMDB](#tmdb) · [IBO image cache](#image-cache) · [IBO subtitles](#subtitles) · [Weather](#weather) · [QR codes](#qr-codes) · [Language packs](#language-packs) · [Store backend](#store-backend) · [Notices, terms, exit](#notices-terms-exit)

---

## Analytics {#analytics}

Batched usage events to IBO's analytics backend.

**Endpoint.**
```
POST https://iboanalytics-backend.biduplive.com/api/events
Content-Type: application/json
x-api-key: IohXchmaQySbxoFJkceJWIrCbvnFQSEJU/bcRHInGis=
```
Timeout 15 s.

**Body.**
```json
{
  "device": {
    "platform": "samsung",
    "modelName": "QE55Q60AAU",
    "version": "T-KSU2EAKUC-1234.5",
    "sdkVersion": "6.0",
    "screenWidth": 1920,
    "screenHeight": 1080,
    "uhd": true
  },
  "mac_address": "a1:b2:c3:d4:e5:f6",
  "app_version": "1.1.6",
  "app_name": "iboplayer",
  "sessions": [
    {
      "session_id": "s_3f7c1a0e9b...64 hex chars",
      "start_time": 1758873600,
      "ip_address": "203.0.113.42",
      "userCountry": "Egypt",
      "userCity": "Cairo",
      "events": [
        { "tracker": "live_opened", "timestamp": 1758873625 },
        { "tracker": "movies_opened", "timestamp": 1758873700 }
      ]
    }
  ]
}
```

| Field | Source |
|---|---|
| `device.*` | Platform device info (model, firmware, OS/SDK version, screen size, `uhd` = 4K panel or width ≥ 3840). Empty strings when unknown. Android: `platform` = the agreed app_type, `modelName` = `Build.MODEL`, `version` = OS version, `sdkVersion` = API level, screen in pixels. |
| `mac_address` | device MAC (or `""`) |
| `app_version` | app version string |
| `app_name` | `"iboplayer"` (`analyticsAppName`) |
| `sessions[].session_id` | `"s_" + SHA256(startTimeSeconds + "_" + mac)` hex, computed once per app launch. |
| `start_time`, `timestamp` | Unix **seconds**. |
| `ip_address` | from `device_info.ip_address`; `userCountry`, `userCity` from the weather lookup. Filled the first time they are known and never overwritten. `""` until then. |
| `events[].tracker` | Event name. IBOPlayer sends `live_opened`, `movies_opened`, `series_opened` (home tiles). |

**Batching (reproduce).**
- Events are appended to a persisted buffer of sessions (`analytics_sessions`); the active session is `analytics_active` = `{sessionId, startTime}`.
- Upload when the buffer holds ≥ **5** events after a `track`; after `device_info` if ≥ **10** events are buffered, or if the oldest event is ≥ **24 h** old; and when the app goes to background.
- At most **10** sessions are kept; older ones are dropped.
- Only one upload at a time. On any 2xx, remove exactly the events that were sent (events added meanwhile stay). On error, keep everything for the next trigger.
- Response: if `data.eventsRejected` is present, `data.reasons` is logged; rejected events are not retried.

**TV quirk.** The session starts before the MAC is known, so on TV `session_id` is effectively `SHA256(startTime + "_")`. The mobile app can compute it after the device id is known; the backend treats it as an opaque id (upsert by `session_id`).

---

## Stararcs smart proxy {#stararcs}

Stararcs is a third-party proxy/VPN service integrated as an optional paid feature. When enabled, **IPTV provider requests and stream URLs** (not IBO backend calls) are routed through a Stararcs server. It has a free "Guest" quota.

### Base URL and mirrors

`stararcsRequest(path)`:
1. Candidate bases: last base that worked (stored `stararcs_base_url`) then `https://backend.stararcs.com` (deduplicated).
2. Send; on **no HTTP response** (status 0: DNS, offline, timeout 8 s, blocked) try the next base.
3. When the known bases are exhausted, fetch the mirror list `GET https://cdn.jsdelivr.net/gh/mr-akme/app-config@HEAD/stararcs/domain.json?<random>` (8 s) → `{ "domain_list": ["https://...", ...] }`, normalized (trim, strip trailing `/`, must start with http(s)://, deduplicated). Stored as `stararcs_domain_list`; if the CDN fails, the stored list is used. Try each untried mirror.
4. Any real HTTP status (except 401) ends the walk: that is the server's answer.
5. **HTTP 401** (first time): get a fresh Stararcs token via IBO V4 `device/add`, then retry the same base once.
6. The base that answers is saved as `stararcs_base_url`.
7. Header `X-Secret-Token: <stararcs token>` is added when a token is stored (token comes from IBO `device/add`; see ibo-api-reference.md #8).

All Stararcs bodies are form-encoded (`application/x-www-form-urlencoded`).

### `POST /api/v3/tv/general` — subscription status and servers

When: opening the Stararcs page (after making sure a token exists), "Check subscription"/"Try again" (5 s cooldown), at startup when "keep connection" is on (blocking, max 15 s) or when the proxy is enabled (background).

Request:
```
POST https://backend.stararcs.com/api/v3/tv/general
X-Secret-Token: st_4f1d2c9e8b7a...
Custom-Proxy-Mode: 1

DeviceMac=a1%3Ab2%3Ac3%3Ad4%3Ae5%3Af6&DeviceAppName=iboplayer&DeviceUserAgent=samsung
```
(`DeviceUserAgent` is the platform name. `Custom-Proxy-Mode: 1` stops the app from routing this call through the proxy itself; it is also sent to the server.)

Response:
```json
{
  "Success": true,
  "Response": {
    "Status": "Success",
    "Url": "https://stararcs.com/subscribe?d=abc123",
    "Servers": [
      {
        "RegionName": "Europe",
        "Countries": [
          { "CountryName": "Germany", "CountryImage": "https://cdn.stararcs.com/flags/de.png", "Servers": ["198.51.100.10", "198.51.100.11"] }
        ]
      }
    ],
    "Usage": { "Used": 3.25, "Total": 50 },
    "Subscription": { "plan": { "PlanName": "Monthly" } },
    "Duration": { "DurationDateFrom": "2026-09-01", "DurationDateTo": "2026-10-01", "DurationStatus": "Active" },
    "GuestDevice": { "DeviceTraffic": 1.2, "DeviceQuota": 10 }
  }
}
```

| `Response.Status` | Meaning | App behaviour |
|---|---|---|
| `Success` | Paid subscriber | Show "Subscribed" badge, plan (`Subscription.plan.PlanName`), period `YYYY/MM - YYYY/MM - <DurationStatus>`, quota bar (`Usage`: "X.XX GB remaining of T GB"), region/country pickers, proxy on/off toggle, "keep connection" toggle, Logout. |
| `Guest` | Free quota | "Guest User" badge, quota from `Usage` (or `GuestDevice.DeviceTraffic` / `DeviceQuota`, default quota 10), pickers and toggle; when the proxy is off, a subscribe QR of `Url`. No Logout. |
| `unknown_app` (any case) | App name not registered at Stararcs | Proxy disabled; error "This app is not registered with Stararcs." |
| `Expired` / `QuotaLimit` / `SubFail` / other | Not usable | Proxy disabled (saved off), streams replayed without proxy, "not active" screen with a subscribe QR of `Url`. Toasts: "Your subscription has expired." / "You've used all your quota." / "We couldn't find an active subscription." / "Something went wrong". |
| missing `Response.Status` | Bad reply | Error "Stararcs returned an unexpected response." (or unregistered if the body mentions `unknown_app`). |

HTTP errors: 422 or body containing `unknown_app` → unregistered; status 0 after all mirrors → "Couldn't reach any Stararcs server." (lists the tried domains; also changes the boot "Server URLs failed" title); other → "Stararcs returned an error." If a previous call already returned Success/Guest with servers, an error keeps that state.

### Building the proxy URL

With the proxy toggled on and `Success`/`Guest`:
```
ip = Servers[region].Countries[country].Servers[server]     // indexes saved in settings, default 0
PROXY_URL = "http://" + ip + ":8080/?mimo_proxy_token_765=" + MIMO_PROXY_TOKEN + "&mimo_proxy_target_765="
GET "http://" + ip + ":765"      // one fire-and-forget "discovery" request, response ignored
```
Every IPTV request and stream URL is then `PROXY_URL + originalUrl` (the original URL is appended raw, not URL-encoded). The UI only lets the user pick region and country; the server index stays 0. Before the first provider request after enabling, the app waits 1 s ("warm-up").

`MIMO_PROXY_TOKEN` = `b3ea7102-9d44-43ff-b287-3c2c0d87c7f4_wETVZGLCEHWG57YHVwzSOHyLMFIActoc`.

If playback fails through the proxy the player retries without it (player docs).

### `POST /api/v3/tv/country/change`

When: every time the region/country selection or the toggle is saved (if servers are known).
```
ServerIP=198.51.100.10&DeviceMac=a1%3Ab2%3Ac3%3Ad4%3Ae5%3Af6
```
`ServerIP` = first server of the selected country. Response only logged.

### `POST /api/v3/tv/device/unlink` — Logout

When: Logout (subscribers only) → confirmation modal (default Cancel).
```
POST .../api/v3/tv/device/unlink        (15 s timeout)
Custom-Proxy-Mode: 1

DeviceMac=a1%3Ab2%3Ac3%3Ad4%3Ae5%3Af6
```
Response `{ "Success": true }` (or `success`) → delete the Stararcs token, turn the proxy off, toast "This device has been unlinked from Stararcs.", then re-register (IBO `device/add`) and call `general` again. `Success` false → toast with `Message`; `Code: "ACCESS_DENIED"` → "Stararcs refused the request (access denied)."

### Persistence and "keep connection"

Keys: `smart_proxy_connection_state` (`"true"`/`"false"`), `smart_proxy_region`, `smart_proxy_country`, `smart_proxy_server`, `keep_connection` (`on`/`off`), `stararcs_secret_token`, `stararcs_base_url`, `stararcs_domain_list`, `isRefresh`.
- `keep_connection` off: on every cold start the four `smart_proxy_*` keys are deleted (proxy off). The in-app "Reload" sets `isRefresh="true"` first, which preserves them for that one restart.
- `keep_connection` on: settings survive; startup calls `general` before loading the playlist.

### TV-only Stararcs use

`POST /api/tv/server/asset` with `X-Secret-Token: 0sqM4J...Eqw==` (the boot loader's asset proxy). Not for mobile.

---

## TMDB {#tmdb}

API key `a3c79068cd6961a3526ba1b516c50c39` (may be replaced at runtime by `device_info.tmdb_api_key`). Base `https://api.themoviedb.org/3`, images `https://image.tmdb.org/t/p/`.

| Call | Use |
|---|---|
| `GET /movie/{tmdbId}/images?api_key=K` | Movie backdrop (`backdrops[0].file_path`, size `w1280`) and title logo (`logos[0].file_path`, `w500`). |
| `GET /tv/{tmdbId}/images?api_key=K` | Same for series. |
| `GET /movie/{tmdbId}/credits?api_key=K` | Cast row: `cast[].name`, `order`, `profile_path` (`w500`). |
| `GET /search/movie?api_key=K&query=<name>` / `/search/tv?...` | Only to find a TMDB id for subtitle search when the provider gave none. The query is the title with "XX - " prefix and "(year)"/"(country)" suffixes removed, lowercased, **not URL-encoded** by the TV (mobile should encode). Match rules: single result; else same `release_date` as the provider's `releasedate`; for series, overview equality. |

The TMDB id comes from the provider's VOD/series info (`tmdb_id` / `tmdb`). TMDB lookups are skipped when the user disabled TMDB in settings (`tmdb_choice`). Image URL format: `https://image.tmdb.org/t/p/w1280/<file_path>`.

---

## IBO image cache {#image-cache}

IBO's mirror of TMDB image lists. Used **only for Xtream (`xc`) playlists**; other playlist types call TMDB directly.

Read:
```
GET https://tmdb.iboplayer.com/api/{movies|series}/images/show/{tmdbId}
Authorization: Bearer sUdvdQKtYR54mx1bJEI7huTJxGI4H3bWIZ9ejVYApj6xCbMJrGXRptM8KEyreCOB
```
Response: `{ "data": { "tmdbId": 603, "backdrops": [...], "logos": [...], "posters": [...] } }` (same item shape as TMDB's images endpoint). `data` is used like a TMDB images reply.

On any error: call TMDB `/movie|tv/{id}/images`, use it, then write it back:
```
POST https://tmdb.iboplayer.com/api/{movies|series}/images/store
Authorization: Bearer <same token>
Content-Type: application/x-www-form-urlencoded

tmdbId=603&backdrops[0][file_path]=/abc.jpg&backdrops[0][width]=1920&...&logos[...]...&posters[...]...
```
(jQuery form-encodes the nested arrays with bracket notation.) `tmdbId` = `response.tmdbId || response.id`. A reply that already carries `tmdbId` came from the cache and is not stored again. Result only logged.

Note: the write endpoint lets anyone with the (public) token write artwork every user sees; the backend owner plans to remove it (server should fetch from TMDB itself). The mobile app can skip the store call if the backend owner agrees; with a JSON client it must reproduce the bracket form encoding if kept.

---

## IBO subtitles (ibosub.com) {#subtitles}

Used by the player on non-Samsung platforms. Both calls are form-encoded POSTs, no auth, JSON responses.

Search:
```
POST https://ibosub.com/api/get-subtitles-update
```
Body, movie: `tmdb_id=<id>`. Body, episode with a series TMDB id: `movie_type=episode&season_number=<n>&episode_number=<n>&tmdb_id=<series id>` (+ `episode_tmdb_id=<id>` if known). Episode with only an episode id: `movie_type=episode&episode_tmdb_id=<id>`.

Response: `{ "status": "success", "subtitles": [ { "file_id": 123, ...language fields... } ], "srt_map": { "123": "<srt text>" }, "movie_list_id": 456 }`. Empty `subtitles` or other status → "no subtitles".

Content:
```
POST https://ibosub.com/api/get-single-subtitle-content
movie_list_id=456&file_id=123
```
Response: `{ "status": "success", "content": "<srt text>" }`. Error toast: "Something error caused while downloading subtitles for current language, please try again later".

(The language fields of a subtitle entry are rendered by the player; see the player docs.)

---

## Weather {#weather}

```
GET https://api.weatherapi.com/v1/forecast.json?key=0c1f9db9b99649f3a2b124503241310&q=<ip_address or "auto:ip">&days=14
```
- `q` = `device_info.ip_address`, or `auto:ip` when unknown.
- Called after `device_info` succeeds, unless a cached forecast (`weather-forecast`) is less than 13 days old.
- Cached as `{ "date": location.localtime, "country": location.country, "city": location.name, "forecast": forecast.forecastday }`.
- Display: pick today's `forecastday` by `date_epoch` (UTC midnight), then the current hour by `time_epoch`; show `floor(temp_c) + "°"`, icon `"https:" + condition.icon`, and `"<city>, <country>."`.
- `country` and `city` also feed analytics (`userCountry`, `userCity`).
- Failures are silent.

A phone app would more naturally use device location; keeping the IP lookup keeps analytics comparable.

---

## QR codes {#qr-codes}

All QR codes are rendered client-side (qrcodejs, error correction level M, black on white). The text is exactly the URL (the `qr_via_website` rewrite feature is off for IBOPlayer).

| QR | Content | Where |
|---|---|---|
| Add playlist from phone | `https://iboplayer.com/qr-playlist?identifier=<AES>&type=<type>` | Playlists page (`type=xc`), "Add playlist" page (`type` = the selected tab; IBOPlayer only has `xc`), Stalker portal page (`type=stalker`). |
| Web device verification | `https://iboplayer.com/device/verify?d=<toUrlSafe(encryptRequest({mac_address, app_type, u_id, version, mode}))>` | Captcha modal. |
| Stararcs subscribe | `Response.Url` from Stararcs `general` | Stararcs page when not subscribed / guest with proxy off. |

`qrPlaylistFormat: "identifier"`:
```
identifier = CryptoJS.AES.encrypt(JSON.stringify(mac_address), "3R%6R2FJ*b5)Vmt84$^eWf0r@r?szdw*fwf*ewd&VXmne$%").toString()
url = "https://iboplayer.com/qr-playlist?identifier=" + identifier + "&type=" + type
```
The plaintext includes the JSON quotes; the Base64 is inserted without URL-encoding. Extra fields (e.g. the portal page passes `stalker_mac`, `mac_mode`) are ignored in this format. The website decrypts it, lets the user enter a playlist, and saves it to the device; the TV sees it at the next `device_info`.

On mobile, a QR "for your phone" shown on the phone is pointless. Suggested: a "Manage playlists on the website" button that opens the same URL in the browser, and/or the native add-playlist form (which uses V4 `manage/add_playlist`). After returning, re-run `device_info`.

---

## Language packs {#language-packs}

IBOPlayer uses **bundled** locale files only (18 languages: en, ar, fr, de, es, tr, it, pt, nl, ru, pl, sv, da, no, fi, ur, hi, fa). They are loaded from the app's own assets (`<HOST>app_src_min/locales/<code>.json`), falling back to English. The initial language is the stored `language` setting, else the device language prefix.

The panel can send language packs in `device_info.languages` as `[{code, name, words: {key: text}}]`, but only apps configured with `i18nSource: "panel"` use them (the packs then define the language list and their non-empty words override the bundled ones). IBOPlayer ignores them. No separate language-pack endpoint exists.

The locale files themselves are covered by the product docs.

---

## Store backend (backend.ibosol.com) {#store-backend}

- `GET https://backend.ibosol.com/api/application-settings/IBOPLAYER` with `X-Version: 1.0` → `{ data: { is_remote: bool, fallback_time: seconds } }`. TV boot loader only (remote vs packaged code). **Not for mobile.** Could be reused later as a remote-config/feature-flag endpoint if the backend owner wants.
- `POST https://backend.ibosol.com/api/sync-code` (`code`, `mac_address`, `Authorization: Bearer <storeToken>`) redeems "code playlists". The `code_playlists` feature is **off** for IBOPlayer and IBOPlayer has no `storeToken`. Not needed.

---

## Notices, terms, exit {#notices-terms-exit}

- **Notices/notifications.** `device_info.notification` is stored but never displayed by IBOPlayer. The home-screen "notification" is local: it appears when the current Xtream playlist's provider expiry (`user_info.exp_date`) is within 0–5 days ("Your playlist will expire in N days").
- **Terms.** A static local dialog ("Welcome to IBOPLAYER ... legal use only ...") shown once; acceptance stored as `termsApproved = "true"`. No backend call, no version.
- **Exit URL** `iboplayer://exit`: only for the VegaOS WebView wrapper (navigating to it tells the wrapper to close the app). Samsung calls the Tizen exit API; others `window.close()`. A native app exits natively. **Do not port.**
- **Captcha, "server failed", "stuck" screens** are covered in overview.md and device-and-auth.md.

---

## Notes / uncertainties

1. Stararcs response shapes are reconstructed from the fields read; `Success` at the top level of `general` is not checked by the app.
2. The Stararcs proxy and discovery URLs are plain http with the token in the query string (kept by decision on TV; unknown whether the servers support https). Android requires `usesCleartextTraffic` / a network security config to allow it.
3. `Custom-Proxy-Mode: 1` is an internal flag that also reaches Stararcs and the IBO `edit_playlist` endpoint as a real header. Its server-side meaning (if any) is unknown.
4. The image cache success path assumes `data` is a valid images object; a 200 with `data: null` would throw on TV.
5. Subtitle entry language fields are not documented here (player scope).
6. The weather API key is a shared, embedded key; quota limits unknown.
