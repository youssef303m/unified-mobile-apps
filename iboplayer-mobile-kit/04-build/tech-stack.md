# Tech stack

Decisions are final unless a row says "decide". Where a version is not given, use the **latest
stable release when you start** and pin it exactly in `package.json`. Before using any library
API, check it exists in the installed version (read its types or docs). Do not write code from
memory of an older API.

## Platform

| Item | Choice | Why |
|---|---|---|
| Framework | **React Native with Expo** (SDK = latest stable), TypeScript `strict` | managed native config, EAS builds, OTA updates for JS-only fixes |
| Workflow | Expo **development build** (`expo-dev-client`) plus **Continuous Native Generation** (`npx expo prebuild`; `android/` is generated, not committed) | `react-native-video`, the background downloader and MMKV need native code, which Expo Go cannot run |
| Target | Android phones, portrait first (the player and live full-screen go landscape). `minSdkVersion` 24 (Android 7.0); `targetSdkVersion` = what the Play Store currently requires | covers the IPTV audience's older phones |
| Tablets | the layout must not break on 600dp+ widths (more posters per row), but no tablet-specific design in v1 | |
| Android TV / iOS | out of scope for v1. Do not block them: no Android-only APIs outside `src/platform/` | |
| Package id | `com.iboplayer.mobile` **(placeholder: decide with the owner before the first store upload; it can never change after)** | |

## Libraries

| Concern | Library | Notes |
|---|---|---|
| Navigation | `expo-router` (file-based, on React Navigation) | typed routes, deep links (`iboplayer://movie/123`) |
| Video | **`react-native-video`** (v6 or later, Media3/ExoPlayer on Android) | HLS, MPEG-TS over HTTP, MP4 and MKV; side-loaded text tracks; audio and text track selection; custom headers (Stalker needs a User-Agent and cookie); `bufferConfig`; Picture-in-Picture; background audio. See 01-product/player.md |
| Server data | `@tanstack/react-query` | caching, retries and stale times per content type; offline persistence of small queries |
| App state | `zustand` | session (device, active playlist, account), player queue, UI prefs |
| Key-value storage | `react-native-mmkv` | replaces the TV app's `localStorage` (same keys, see 02-backend/data-models.md). Encrypt the instance (`encryptionKey`, from `expo-secure-store`) because it holds playlist credentials |
| Catalogue storage | `expo-sqlite` | live channels can run to 50,000+ rows, and VOD lists are also large. Store the category/channel/movie/series lists in tables with an FTS5 index for search. Never hold a whole catalogue in React state |
| Lists | `@shopify/flash-list` | every vertical or horizontal list with more than about 20 items |
| Images | `expo-image` | disk and memory cache, placeholders, `http://` URLs |
| HTTP | `fetch` wrapped in `src/api/http.ts` (timeouts via `AbortController`, retry policy, logging) | the IBO backend and the Xtream/Stalker servers are plain HTTP(S) JSON. No axios needed |
| Crypto | `crypto-js` | the same library and algorithms as the TV app (see 02-backend/device-and-auth.md). Use `react-native-get-random-values` if random bytes are needed |
| Device id | `expo-application` (`getAndroidId()`) plus `expo-crypto` | see the device-identity section of 02-backend/device-and-auth.md |
| Secure storage | `expo-secure-store` | the MMKV encryption key and the parental PIN hash |
| Downloads | `@kesha-antonov/react-native-background-downloader` | resumable, survives the app going to the background, shows notification progress. Direct-file VOD and episodes only in v1; see 01-product/player.md §8 |
| File system | `expo-file-system` | download folder, free-space checks, deleting files |
| Network state | `@react-native-community/netinfo` | offline mode, and a Wi-Fi-only download setting |
| Bottom sheets | `@gorhom/bottom-sheet` plus `react-native-reanimated` plus `react-native-gesture-handler` | |
| Icons | `lucide-react-native` + `react-native-svg` | |
| Fonts | `expo-font` with Inter, Noto Sans Arabic and Noto Sans Devanagari (OFL) | see 03-design/design-system.md §2 |
| i18n | `i18next` + `react-i18next` + `expo-localization` | the 18 locale files in 05-reference/locales/; RTL for ar, fa and ur via `I18nManager`. See 05-reference/translations.md |
| QR codes | `react-native-qrcode-svg` | the device-activation QR (what it encodes: 02-backend/services.md) |
| Orientation | `expo-screen-orientation` | the player and full-screen live are landscape, everything else portrait |
| Keep awake | `expo-keep-awake` | during playback |
| Brightness | `expo-brightness` | the player's swipe-to-adjust brightness gesture |
| Volume | `react-native-volume-manager` | the player's swipe-to-adjust volume gesture |
| Casting (v2) | `react-native-google-cast` | out of scope for v1 |
| Splash and icon | `expo-splash-screen`, `app.config.ts` `android.adaptiveIcon` | assets in `assets/brand/` (see assets/README.md) |
| Crash reporting | `sentry-expo` / `@sentry/react-native` **(decide: needs an owner account; otherwise leave the hook in place, disabled)** | |
| Updates | `expo-updates` (EAS Update) **(decide)** | JS-only fixes without a store release |

Do not add a library outside this table without writing the reason in `docs/decisions.md` in the
new project. Prefer the platform or a library already listed.

## Tooling

- **Package manager:** npm (a lockfile is committed).
- **Lint and format:** ESLint (`eslint-config-expo`) + Prettier + `@typescript-eslint` strict rules;
  `no-explicit-any` is an error.
- **Tests:**
  - Jest (`jest-expo`) + React Native Testing Library for units and components.
  - **MSW** (Mock Service Worker) for HTTP fixtures, built from the example responses in 02-backend/.
  - **Maestro** for end-to-end flows on an emulator (flows in `e2e/`). See 04-build/testing.md.
- **CI:** GitHub Actions. Run `npm ci`, `npx tsc --noEmit`, `npm run lint` and `npm test` on every
  push, and an EAS preview build on tags. The CI must pass on a clean checkout.
- **Builds:** EAS Build, with profiles `development` (dev client), `preview` (an internal APK) and
  `production` (an AAB for the Play Store).

## Android configuration that the IPTV use case needs

- **Cleartext HTTP:** most IPTV servers and artwork hosts are `http://`. Allow cleartext traffic
  (`android.usesCleartextTraffic: true` through `expo-build-properties`). Do not try to force HTTPS
  on playlist or stream URLs.
- **Permissions:**
  - `INTERNET` and `ACCESS_NETWORK_STATE`.
  - `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_DATA_SYNC`, for downloads.
  - `POST_NOTIFICATIONS`, for download progress on Android 13+; ask the first time the user
    starts a download.
  - `WAKE_LOCK`.
  - No storage permission: downloads go to app-specific storage.
- **Picture-in-Picture:** `android.supportsPictureInPicture: true` on the main activity.
- **Large catalogues:** keep them off the JS thread where possible. Parse big JSON and M3U
  responses in chunks, write them to SQLite in transactions, and show progress.
- **Hermes:** on (the default). Use the new architecture (the Expo default) only if every native
  library above supports it at start time; otherwise turn it off and record that in `docs/decisions.md`.
