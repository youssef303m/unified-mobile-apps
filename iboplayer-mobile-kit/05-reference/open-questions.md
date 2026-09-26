# Open questions

Decisions the kit could not make from the TV app's code. Each has an owner and a **default**. The
building agent implements the default, marks the spot in code with `// Q-<id>`, and records it in
`docs/decisions.md`. When the owner answers, update this file and the code.

Owners:
- **Backend:** whoever runs the IBO panel and servers.
- **Product:** the app owner.

## Backend

| Id | Question | Default until answered |
|---|---|---|
| Q-app-type | Every V4 URL contains `<app_type>` (samsung, lg, … on TV). Which value does an Android phone send? Does the backend need to allow it first? | `android`. **Blocking for going live:** nothing works against production until the backend accepts it. Development uses the fixtures |
| Q-device-id | The TV identifies devices by MAC address. A phone cannot read its MAC. Does the backend accept the proposed id (a locally administered MAC-format value derived from SHA-256 of ANDROID_ID, 02-backend/device-and-auth.md)? Are MACs compared case-insensitively? | the proposed derivation, uppercase, stored in secure storage so it survives app updates. It changes after a factory reset or re-install on some Android versions; this is accepted |
| Q-shared-account | Should a phone be able to share an account with the user's TV (the same MAC and playlists)? No current endpoint supports "log in as another device" | no: the phone is its own device with its own playlists and activation |
| Q-utf8 | The TV encodes request payloads with `btoa`, which fails on non-Latin-1 text (such as Arabic playlist names). The mobile app encodes UTF-8 bytes. Does the server decode UTF-8 correctly? | UTF-8 (a strict superset for ASCII payloads). Test with the backend before release |
| Q-response-shapes | The response examples in 02-backend/ are rebuilt from the fields the TV reads. The real replies may have more fields, or optional ones | parse leniently: validate only the fields used, and ignore the rest |
| Q-is-trial | `is_trial` values: only 2 and 3 have a known meaning ("Active"). What do the others mean? | anything other than 2 or 3 displays "Trial", as on TV |
| Q-panel-fallback | Under the "server" domain policy, the static `panelUrls` in config.json are never contacted on TV. May the phone use them as a last resort after `fallbackDomains`? | no; follow the TV order exactly (02-backend/overview.md) |
| Q-domain-cache | The TV saves the last agent reply (the domain list) but never reads it back. Should the phone fall back to the cached list before `fallbackDomains`? | yes: cached list, then fallbackDomains. This is a harmless improvement |
| Q-legacy-endpoints | `changeParentPin` and `edit_playlist` are unauthenticated legacy endpoints that identify the device by MAC only (and `edit_playlist` sends `Custom-Proxy-Mode: 1`). Keep them, or will V4 versions exist? | keep them, exactly as documented |
| Q-image-store | Should the phone skip the image cache's public-token `images/store` write? | skip it (read-only use of the image cache) |
| Q-captcha-phone | Does the website verify flow (`/device/verify?d=…`) work when opened on the same phone? | offer both: the in-app captcha field, and "Verify on website" opening the browser, then "I've verified — Continue" |
| Q-stararcs-http | The Stararcs proxy URL is plain HTTP with a token in the query string. | allowed: cleartext traffic is already enabled for IPTV. Never log the URL |
| Q-stream-headers | Do any Xtream/M3U/Stalker servers require a specific User-Agent or cookie **on the stream request**? The TV WebView sends only browser defaults. | Xtream/M3U: the player's default headers. Stalker: send the portal's MAG `User-Agent` and `Cookie` headers with stream requests too (a native app can, unlike the TV WebView) |

## Product

| Id | Question | Default until answered |
|---|---|---|
| Q-package-id | The Android application id is permanent after the first Play Store upload | `com.iboplayer.mobile` (placeholder; confirm before the first upload) |
| Q-home-prefetch | Load on Demand (on by default, R-050) loads nothing at start-up, but the streaming-style Home needs movies and series | prefetch movie and series lists in the background after Home appears (new-features.md N-01) |
| Q-search-lod | On TV, global search is hidden while Load on Demand is on and for Stalker (R-051), because the data isn't loaded | show Search always. Search what is synced (SQLite FTS) and trigger the background prefetch. For Stalker, use the portal's search for movies and series, and hide Live search with an explanation |
| Q-replay-stalker | Stalker catch-up is partly implemented on TV but unreachable (Replay is blocked for Stalker) | keep it blocked (parity) |
| Q-m3u-in-app | IBOPlayer has M3U input and playlist editing turned off. Playlists are added on the website (Xtream can be typed in the app, per the flows) | keep the TV flags: no M3U entry in the app |
| Q-downloads | Downloads are new. May downloaded items stay playable after the playlist expires or is removed? Is there a maximum age? Any per-provider opt-out? | keep downloads until the user deletes them, but block playback while the **account** (not the playlist) is expired. When a playlist is removed, offer to delete its downloads |
| Q-dropped-settings | TV settings with no phone meaning: Channel Theme, the Movies/Series grid theme, App Theme, Font Size (settings.md) | drop Channel Theme and the grid theme; drop App Theme (dark only, v1); drop Font Size (the system font scale replaces it) |
| Q-confirmations | Clear Cache, Clear Watch Lists and Remove Portal have no confirmation on TV | add a confirmation dialog for all three |
| Q-behaviour-fixes | Inconsistencies found in the TV app (list below). Copy exactly, or fix? | **fix** them on mobile, where the fix is invisible to the backend, and list each in `docs/decisions.md` |
| Q-analytics | Should the phone send analytics (02-backend/services.md) under the same app name? | yes, the same events, with `analyticsAppName` from config.json and the platform `android` |
| Q-crash-reporting | Crash reporting needs an account (for example Sentry) | a disabled hook; no SDK until the owner provides a DSN |
| Q-vector-logo | Only a 512px raster logo exists. Is there an SVG or AI source? | use the provided PNGs (assets/README.md); draw only the notification-icon silhouette |
| Q-privacy | The privacy policy URL and content-rating answers for the Play Store | ask before the store listing (04-build/release.md) |

### TV inconsistencies covered by Q-behaviour-fixes

The research found these in the TV app. The default is to fix them on mobile:

1. Minimum search length differs (1, 2 or 3 characters) by screen → use 2 everywhere.
2. Recently viewed channels: replaying a channel moves it to the front on Stalker only → move it
   to the front for every source. Enforce the 15-item cap consistently.
3. Series resume points and watch progress are keyed by season/episode **position**, not id →
   key them by episode id. When importing TV-shaped data, map positions to ids.
4. The series details favourite button skips the adult check that movies have → apply the adult
   check to both (R-062).
5. The Xtream catch-up list stores `description` but reads `desc`, so descriptions never show →
   show them.
6. A Stalker `tv_archive: "0"` counts as "has archive" → treat `"0"` as no archive.
7. The chosen Stalker STB profile is saved but not reloaded after a restart → reload it.
8. A failed Xtream login is silently retried as M3U, which turns an auth error into a confusing
   M3U error → keep the fallback, but show the original Xtream error if both fail.
9. Time parsing: the Xtream server offset is also applied to unix timestamps; Stalker wall-clock
   times are read as device-local; `new Date("YYYY-MM-DD HH:mm:ss")` is unreliable → parse
   explicitly (02-backend/epg-and-catchup.md). Apply the offset only to wall-clock strings.
10. The reconnect loop replays the same URL, so an expired Stalker link never recovers → fetch a
    fresh `create_link` before each retry.
11. The Xtream username and password are not URL-encoded in stream and API URLs → encode them
    (`encodeURIComponent`). This is invisible for plain credentials and fixes ones with special
    characters.
12. The live full-screen EPG, Previous, Next and Audio buttons just leave full screen on TV → make
    them do what their labels say.

Things the TV does that the phone must **not** copy (already stated in the relevant files):
- The shared fallback MAC `52:54:00:12:34:57`.
- The unprefixed `local_data` write.
- The analytics session id computed before the MAC is known.
- The TV boot loader (`host.js`).
