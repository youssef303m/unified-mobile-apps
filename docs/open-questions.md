# Open questions

The questions from `iboplayer-mobile-kit/05-reference/open-questions.md`, with the default
implemented until the owner answers, and where the code marks it (`// Q-<id>`). New questions
found while building are added at the end, with the default chosen.

Status: **default** = the kit's default is implemented; **partly** = implemented as far as the
current milestone goes; **pending** = not reached yet in the roadmap; **answered** = the owner
decided (the kit and the code are updated).

## From the kit

| Id                 | Default (short)                                                        | Status                                                           | Marked in                                                       |
| ------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| Q-app-type         | `android`                                                              | **answered 2026-09-26**: the backend accepts `android`           | `src/api/ibo/panel.ts`                                          |
| Q-device-id        | MAC-format id from SHA-256 of ANDROID_ID, uppercase, in secure storage | default; case **answered 2026-09-26**: the backend ignores case  | `src/api/ibo/identity.ts`, `src/platform/deviceIdentity.ts`     |
| Q-shared-account   | no                                                                     | pending (M3)                                                     |                                                                 |
| Q-utf8             | encode payloads as UTF-8                                               | default                                                          | `src/api/crypto.ts`                                             |
| Q-response-shapes  | parse leniently, validate only used fields                             | default                                                          | `src/api/parse.ts`                                              |
| Q-is-trial         | anything other than 2 or 3 shows "Trial"                               | pending (M3)                                                     |                                                                 |
| Q-panel-fallback   | no; follow the TV order                                                | default                                                          | `src/api/ibo/servers.ts`                                        |
| Q-domain-cache     | yes: cached list, then fallbackDomains                                 | default                                                          | `src/api/ibo/servers.ts`                                        |
| Q-legacy-endpoints | keep them as documented                                                | default                                                          | `src/api/ibo/client.ts`                                         |
| Q-image-store      | skip the `images/store` write                                          | default                                                          | `src/api/imageCache.ts`                                         |
| Q-captcha-phone    | offer the in-app captcha and "Verify on website"                       | partly: the web verify URL (M1); the screen is M3                | `src/api/ibo/links.ts`                                          |
| Q-stararcs-http    | allowed; never log the URL                                             | pending (M6, if in scope)                                        |                                                                 |
| Q-stream-headers   | Xtream/M3U default headers; Stalker sends MAG User-Agent and Cookie    | partly: headers built and sent on portal calls; player use in M5 | `src/api/stalker/client.ts`                                     |
| Q-package-id       | `com.iboplayer.mobile` (placeholder, confirm before first upload)      | default                                                          | `app.config.ts`                                                 |
| Q-home-prefetch    | prefetch movies and series after Home appears                          | pending (M4)                                                     |                                                                 |
| Q-search-lod       | always show Search; search what is synced                              | pending (M4)                                                     |                                                                 |
| Q-replay-stalker   | keep it blocked                                                        | pending (M2/M5)                                                  |                                                                 |
| Q-m3u-in-app       | no M3U entry in the app                                                | pending (M3)                                                     |                                                                 |
| Q-downloads        | keep until deleted; block playback while the account is expired        | pending (M7)                                                     |                                                                 |
| Q-dropped-settings | drop Channel Theme, grid theme, App Theme, Font Size                   | pending (M6)                                                     |                                                                 |
| Q-confirmations    | confirm Clear Cache, Clear Watch Lists, Remove Portal                  | pending (M6)                                                     |                                                                 |
| Q-behaviour-fixes  | fix the 12 TV inconsistencies on mobile                                | partly: #5, #6, #9, #11 (decisions D-031)                        | `src/utils/epgTime.ts`, `src/api/xtream/*`, `src/api/stalker/*` |
| Q-analytics        | yes, same events, platform `android`                                   | default (client; wiring in M3)                                   | `src/api/analytics.ts`                                          |
| Q-crash-reporting  | a disabled hook, no SDK until a DSN exists                             | pending (M8)                                                     |                                                                 |
| Q-vector-logo      | use the provided PNGs                                                  | default                                                          | `app.config.ts` (icon, splash)                                  |
| Q-privacy          | ask before the store listing                                           | pending (M8)                                                     |                                                                 |

## New questions

| Id                    | Question                                                                                    | Default chosen                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Q-backup              | Should Android cloud backup be allowed? It would restore encrypted storage without its key. | no (`allowBackup: false`, decisions D-008)                                           |
| Q-expo-updates        | Use EAS Update for JS-only fixes? (tech-stack.md "decide")                                  | not installed; the RTL reload doesn't need it (D-005)                                |
| Q-device-id-case      | The device id: uppercase or lowercase?                                                      | **answered 2026-09-26**: case does not matter to the backend; uppercase kept (D-024) |
| Q-custom-proxy-header | Does the backend need `Custom-Proxy-Mode: 1` on `edit_playlist`?                            | kept, as documented (D-030)                                                          |
