# Decisions

Library choices, deviations from the kit, and gaps or contradictions found in it. Newest last.
Open questions from `05-reference/open-questions.md` are tracked in `open-questions.md`.

## M0 · Project skeleton

### D-001 · Expo SDK 57

The latest stable release at the start (2026-09-26): Expo SDK 57, React Native 0.86.3, React 19.2.3,
TypeScript 6.0. Every dependency is pinned to an exact version in `package.json`, as
04-build/tech-stack.md requires.

### D-002 · Routes in root `app/`, not `src/app/`

The Expo template's notes put routes in `src/app/`. The kit's folder layout
(04-build/architecture.md) has `app/` at the root next to `src/`. The kit wins. expo-router picks
`app/` because `src/app/` does not exist.

### D-003 · The New Architecture is mandatory

Tech-stack.md says to use the New Architecture only if every native library supports it, and to
turn it off otherwise. SDK 57 has no opt-out any more (`newArchEnabled` is gone from the config
types, and the generated `gradle.properties` has `newArchEnabled=true`). So each native library
added later must support the New Architecture. Check this for `react-native-video` (M5) and
`@kesha-antonov/react-native-background-downloader` (M7) before installing them. If one doesn't,
the fix is a replacement library, recorded here.

### D-004 · Fonts from the `@expo-google-fonts/*` packages

`@expo-google-fonts/inter`, `noto-sans-arabic` and `noto-sans-devanagari` are not in the library
table. They are Expo-maintained packages holding the same OFL font files the design system names,
loaded with `expo-font` as the table says. The alternative was committing TTF files by hand.
Only weights 400, 500, 600, 700 and 800 are imported, through per-weight subpaths, so the other
weights stay out of the bundle. The fonts load at runtime while the native splash is shown. If
they fail, the system font (Roboto) is used, which design-system.md §2 allows.

### D-005 · RTL reload with `reloadAppAsync` from `expo`

translations.md suggests `expo-updates` `reloadAsync` or `DevSettings.reload`. `expo` core exports
`reloadAppAsync`, which works in development and release builds without `expo-updates`. The
`expo-updates` decision (tech-stack.md, "decide") stays open.
The direction logic calls `I18nManager.allowRTL(rtl)` and `forceRTL(rtl)`. `allowRTL(false)` is
needed so a phone whose system language is Arabic still gets a left-to-right layout when the
app language is English. A reload is attempted at most once per language (key
`mobile_direction_reload`), so a direction the platform refuses cannot cause a reload loop.

### D-006 · MMKV installed in M0 instead of M2

The chosen language has to survive the reload that an RTL switch needs, so it must be persisted
in M0. `react-native-mmkv` 4.x is built on Nitro, so `react-native-nitro-modules` is added as a
direct dependency: it is MMKV's required peer, and autolinking needs it at the top level. The
instance is encrypted with AES-256, using a random 32-character key kept in `expo-secure-store`.
Only the language keys exist so far; the full key set comes in M2.

### D-007 · Random bytes from `expo-crypto`

The MMKV key uses `expo-crypto` `getRandomBytes` (already in the table for the device id) rather
than adding `react-native-get-random-values`.

### D-008 · Android backup disabled (`allowBackup: false`)

Not in the kit. Android backup would restore the encrypted MMKV file to a new device without its
key (secure-store data is excluded from backups), leaving the store unreadable. MMKV also holds
playlist credentials, which AGENTS.md says to treat as secrets. With backup off, a reinstall
starts clean, which matches Q-device-id (a new device id after reinstall is accepted).

### D-009 · Placeholder tabs use `expo-router/js-tabs`

The root `Tabs` export is deprecated in expo-router 57 in favour of `expo-router/js-tabs`. The M0
tab bar is a placeholder styled with tokens. Lucide has no filled icon variants, so the active
tab fills the outline icon with its colour. The design-system `TabBar` component replaces it in
M4.

### D-010 · Language storage key `gz3rYzUIC7_language` (kit gap)

settings.md §2.2 gives the key as `P language`, meaning `{P}language`. The persisted-keys table in
data-models.md §12 does not list it. The settings.md key is used.

### D-011 · Device language: primary locale only

The first-launch language is the first part of the device's primary locale if it is one of the
18, else English. That is the TV behaviour in settings.md §2.2. The phone's other preferred
languages are not searched.

### D-012 · Lint rule for colour literals

To enforce "design tokens only", ESLint rejects hex and `rgb()`/`rgba()` literals in `app/` and
`src/`, except in `src/theme/`. `app.config.ts` holds the two native-config colours (the black
splash/root background and the white adaptive-icon background from assets/README.md), because
the config loader cannot import app TypeScript modules.

### D-013 · Extra packages: `expo-system-ui`, `react-dom`, `@types/node`, `test-renderer`

- `expo-system-ui`: Expo's module that applies `backgroundColor` from the app config to the root
  view, so no white flash appears behind the black UI.
- `react-dom`: a peer dependency of expo-router, pinned to the same version as `react` to avoid
  an npm peer conflict.
- `@types/node`: TypeScript 6 no longer includes `@types/*` automatically, so `tsconfig.json`
  lists `types: ["jest", "node"]` explicitly.
- `test-renderer`: the peer dependency of React Native Testing Library 14.

### D-014 · Test setup notes

- React Native Testing Library 14's `render` is async. expo-router's `renderRouter` attaches its
  helpers to the returned promise, so keep the reference and `await` it separately.
- Under Jest, MMKV uses its in-memory mock, but it imports Nitro at load time. `jest.setup.ts`
  stubs `react-native-nitro-modules` and `expo-secure-store`.
- Jest resolves `lucide-react-native` to its CommonJS build; its ESM build is `.mjs`.

### D-015 · Dev-only language switch

The Home placeholder shows an English/Arabic switch in development builds (`__DEV__`) so RTL can
be checked before Settings → Language exists (M6). It goes away with the placeholder.

### D-016 · Deferred from M0

- The notification icon (assets/README.md "missing, to create") is only used by download
  notifications. It will be drawn in M7.
- The predictive back gesture stays disabled (the template default) until the back behaviour of
  screens.md (tab root → Home, double back to exit) is built in M3/M4.
- The in-app splash status line and Retry button (screens.md) belong to the boot flow (M3). M0
  uses the native splash only.
- `@tanstack/react-query`, `zustand` and `@gorhom/bottom-sheet` providers are added to
  `app/_layout.tsx` when their libraries are installed, in the milestone that first uses them.

### D-017 · Scrims need a gradient library (kit gap, decide in M4)

design-system.md defines `scrim.top` and `scrim.bottom` as linear gradients, but the library
table has no gradient library. Options for M4: `expo-linear-gradient`, or React Native's
built-in `experimental_backgroundImage` if it is stable in RN 0.86. The tokens are already in
`src/theme/colors.ts`.

### D-018 · CI

GitHub Actions runs `npm ci`, type check, lint and tests on every push and pull request. On tags,
it starts an EAS preview build, which needs an `EXPO_TOKEN` repository secret from the owner's
Expo account. `eas.json` has the three profiles from release.md; production uses
`autoIncrement` with the remote version source.

### D-019 · Development builds with EAS Build (cloud) and a real phone

The owner chose not to install Android Studio, the Android SDK or an emulator (about 20 GB).
The development-client APK is built on EAS Build (`eas build --profile development --platform
android`) and installed on the owner's Android phone; JavaScript changes then load from
`npx expo start --dev-client` with hot reload. A rebuild is needed only when a native library or
native config changes. `android/` stays generated on the build server, never committed.
Consequences:

- M0's acceptance check "`npx expo run:android` shows…" is verified with the EAS development
  build on the phone instead.
- The Maestro E2E flows (from M3) still need JDK 17 and the Android SDK Platform-Tools (`adb`),
  about 0.3 GB, installed before M3. They run against the phone over USB, not an emulator.

### D-020 · English and Arabic only, for now (owner's decision)

The owner asked to keep only English and Arabic to keep the app simple while it is built. The
other 16 locale files were removed from `src/i18n/locales/` (they remain unchanged in
`iboplayer-mobile-kit/05-reference/locales/`), and so was the Noto Sans Devanagari font, which
only Hindi used. This deviates from the kit (18 languages, translations.md). A phone whose
language is not English or Arabic starts in English. To add a language back: copy its file from
the kit, add it to `src/i18n/languages.ts` and `resources.ts`, and for fa/ur add it to the RTL
list and the Arabic script in `src/theme/typography.ts` (hi needs the Devanagari font again).

## M1 · Fixtures and API clients

### D-021 · Libraries added in M1

- `crypto-js` (in the table): obfuscation Base64/UTF-8, SHA-1/SHA-256, the QR AES. It also does
  the UTF-8 Base64, so the `buffer` package from the device-and-auth.md sketch is not needed.
- `msw` (in the tooling table): HTTP fixtures in tests.
- `expo-application` (in the table): ANDROID_ID for the device id. It is a native module that is
  **not in the current development build**. Nothing imports it yet
  (`src/platform/deviceIdentity.ts` is first used in M3), so the phone build keeps working.
  Rebuild the development client at the start of M3.
- `babel-preset-expo` as an explicit dev dependency (the SDK-matched version it already had,
  nested under `expo`), for the Node test project.
- `react-native-get-random-values` is not added: `expo-crypto` provides the random source (D-026).

### D-022 · Two Jest projects

`jest.config.js` has an **app** project (jest-expo, React Native code) and an **api** project
(plain Node, `src/api`), where MSW intercepts `fetch` without React Native polyfills. The API
layer has no React Native imports, which keeps it testable in Node. MSW 2 depends on ESM-only
packages (`rettime`, `until-async`, `@open-draft/*`), which the api project transforms
explicitly.

### D-023 · Timeouts where the TV has none

The TV sets no timeout on the Xtream catalogue calls, the M3U download, `changeParentPin` and
`edit_playlist`. A phone request that never ends would hang the UI, so catalogue and M3U
downloads get 120 s (`LARGE_DOWNLOAD_TIMEOUT_MS`) and the two legacy calls get 30 s. Every other
timeout is the documented one (15 s for V4, the agent, the Xtream login and Stalker).

### D-024 · Device id case (kit contradiction)

05-reference/open-questions.md Q-device-id says the default is **uppercase**. device-and-auth.md
§2.1 step 4 says the proposed format is **lowercase**, and its Note 3 recommends always sending
lowercase, because `legacyUid` lowercases the MAC (which suggests the backend normalises to
lowercase). As instructed, the open-question default (uppercase) is implemented, in one place
(`formatMac` in `src/api/ibo/identity.ts`). **The owner should confirm the case with the backend
before release**: if the backend compares MACs case-sensitively, TV devices (lowercase) and the
phone would use different formats, and the user types the id on the website.

**Answered 2026-09-26 by the owner:** the backend compares device ids case-insensitively, so
uppercase stays. The owner also confirmed the backend accepts `android` as the app type
(Q-app-type).

### D-025 · M3U parser fixes (m3u.md "Recommended for mobile")

Kept exactly: the live/vod/series URL tests (including the `vod` substring rule), the two parser
modes chosen by `tvg-` anywhere in the file, `stream_id` = tvg-id or name, the "All" →
"Uncategorized" rename, and "Season NN" grouping (a space is needed before `SNN`).

Fixed: quotes are kept in names and URLs, CRLF is handled, and values are trimmed.
`key="value"` attributes (also single-quoted or unquoted ones) are parsed properly, so commas
and `=` inside values survive. The display name is everything after the attribute section.
Directive lines (`#EXTVLCOPT`, …) between `#EXTINF` and the URL no longer drop the entry. When a
file has both an empty `group-title` and entries with none, the two "Uncategorized" categories
are merged. A leading BOM or whitespace before `#EXTM3U` is accepted.

The parser is incremental (`push()` chunks), and `parseM3uText` yields to the event loop between
slices. The 20,000-entry fixture parses in about 0.14 s under Jest.

### D-026 · Custom entry file and the crypto polyfill

`package.json` `main` is `index.ts`, which imports `src/platform/polyfills.ts` and then
`expo-router/entry`. Hermes has no `crypto.getRandomValues`, and crypto-js looks it up once when
it loads (for the QR AES salt), so the polyfill (from `expo-crypto`, already in the development
build) must run before anything else.

### D-027 · Error model details

- Beyond the five architecture types: `AllServersFailedError` (a `NetworkError`, for the "Server
  URLs failed" screen), `CancelledError` (a caller abort, never shown as a failure), and an
  `AuthError.reason` (`token`, `provider_expired`, `provider_banned`, …) so screens can show the
  matching TV message.
- `http.send` returns HTTP error statuses as responses and throws only for transport problems,
  because several protocols treat error bodies as answers (IBO V4 JSON errors, the Stalker 405,
  Stararcs 422). `expectOk` maps 401/403 to `AuthError` and other error statuses to
  `ServerError`, which carries the status.
- IBO endpoints return typed result unions (`captcha`, `uid_captcha`, `not_found`, …) rather than
  throwing for documented challenge states.

### D-028 · Fixtures and the "use fixtures" mode

- Each fixture server is a pure function from a request to a response
  (`src/api/__fixtures__/`). The same functions serve MSW in tests and the in-app transport
  (`src/api/fixtureTransport.ts`), so the app and the tests exercise identical data.
- Fake hosts use the reserved `.test` TLD, and the credentials are fake. The fixture panel
  decrypts the app's payloads and checks tokens, so the tests verify the real wire format.
- In tests, a request with no fixture fails the test (`jest.server.ts`), so no test can reach a
  real server.
- In the app, the mode is **on by default** in development and preview builds, so development
  never calls real servers. A dev-only switch on the Home placeholder turns it off. The mode is
  compiled out of production (`FIXTURES_ALLOWED` is constant there, so the fixture servers are
  not bundled). The preview profile sets `EXPO_PUBLIC_ENABLE_FIXTURES=1`.
- Public test streams (a Mux HLS stream and an ExoPlayer demo MP4) are in `hosts.ts`. The M3U
  fixture's first live channel plays the HLS one; mapping Xtream fixture stream URLs to them is
  M5 work.

### D-029 · What M1 does not include, and where it goes

- The session and service logic that chains the endpoints: the verification flow,
  account-state routing, demo playlist removal and the offline start (M3); the Xtream → M3U
  fallback (Q-behaviour-fixes #8), load modes, Stalker 5-page batching and the stored
  recent/favourite objects (M2); a fresh `create_link` before each reconnect (#10, M5).
- Clients for Stararcs (M6, if in scope), subtitles (M5) and weather (optional). The roadmap
  lists only TMDB, the image cache and analytics for M1.
- EPG guide lazy loading with 4 concurrent requests is guide UI work (M5). The parsing and
  normalisation helpers already exist in `src/utils/epgTime.ts`.

### D-030 · Kit gaps and ambiguities found in M1

- **Stalker catch-up cascade** (stalker.md §4.9): attempts with an empty `series` are
  "skipped", yet the first attempt (`reference_media_mpg`) has an empty `series` by definition.
  It is kept (only when the programme has a raw id); every other empty-series attempt is skipped.
- **Stalker catch-up titles**: the TV base64-encodes them only to reuse its Xtream screen. The
  phone keeps them as plain text.
- **Stalker expired token**: the architecture says a token error gets one re-handshake and a
  retry. Content calls do this on 401/403 (`StalkerClient.call`); the keepalive reconnects as on
  TV.
- **`Custom-Proxy-Mode: 1`** on `edit_playlist` is kept, because Q-legacy-endpoints says to keep
  these endpoints exactly as documented. ibo-api-reference.md suggests dropping it if the backend
  doesn't need it; that is for the owner to confirm.

### D-031 · Q-behaviour-fixes applied in M1

#5 (the Xtream catch-up description is kept and shown), #6 (Stalker `tv_archive: "0"` means no
archive), #9 (explicit time parsing; the server offset applies only to wall-clock strings) and
#11 (Xtream credentials URL-encoded in API, stream and catch-up URLs). #2, #3, #4, #7, #8, #10
and #12 belong to the service and UI layers (M2–M5).

## M2 · Content layer and storage

### D-032 · Libraries added in M2

- `expo-sqlite` (in the table): the catalogue database. Its Android build has FTS5 on by default
  (`expo.sqlite.enableFTS`). It is a native module that is **not in the current development
  build**. Nothing in the app imports it yet (`src/db/expoDb.ts` is first used in M3), so the phone
  build keeps working. It joins `expo-application` in the rebuild at the start of M3.
- `better-sqlite3` (dev only, never bundled): a real SQLite with FTS5 for the Node tests. Node
  22's built-in `node:sqlite` has no FTS5, so it cannot stand in for the phone's database.

### D-033 · The Node test project covers the whole core

The Jest "api" project became "core" (`src/api`, `src/content`, `src/db`). The content layer and
the database queries run against real SQLite and the MSW fixtures. The content layer has no
React Native imports: it reaches storage through the injected `KeyValueStore` and the `Db`
interface (expo-sqlite in the app, better-sqlite3 in tests).

### D-034 · The ContentSource shape

The architecture sketches `items(kind, categoryId, page)` on every source. Xtream and M3U only
ever download whole lists, so they expose `catalogue(kind)` instead, which `sync.ts` writes to
SQLite; screens then read pages from SQLite. Stalker, which is paged, exposes `page(...)`;
`CatalogueSession.loadPages` caches each page in SQLite. Every provider item is one
`CatalogueItem` type (kind-specific extras in `data`), which keeps rows, search, favourites and
the player source-agnostic.

### D-035 · Offline with an expired licence (kit contradiction)

R-005 says that when starting from the cache (backend unreachable), an expired-looking licence
"is treated as valid (the app never locks the user out because the server is down)".
device-and-auth.md §5 describes the TV differently: offline, only the displayed date changes
(to 2438-01-02) and an expired device stays blocked. AGENTS.md says business rules are
requirements, so **R-005 is implemented**: offline, an expired-looking licence routes to the
trial/active state and shows 2438-01-02. **The owner should confirm this** (Q-offline-expired).

### D-036 · Playlist key renames match the id exactly

R-030: when a `non_saved_…` playlist gets a server id, the TV renames keys by substring
replacement, which can touch unrelated keys (data-models.md Notes). The phone renames only keys
where the old id sits right after the prefix and is followed by `live`, `vod`, `series` or `_`.

### D-037 · A full favourites list refuses new items

R-070 gives the limits (500 live, 200 movies, 200 series) but not what happens at the limit. The
phone refuses the add (`"full"`) rather than silently dropping an older favourite
(Q-favourites-full).

### D-038 · Watch progress storage

- Seconds, as on every TV platform except Samsung.
- Q-behaviour-fixes #3: series progress is keyed by episode id, so the stored shape differs from
  the TV's: `{ stream_id: seriesId, episodes: { [episodeId]: { time, duration, season, episode,
updated_at } }, recent: { id, s, ep }, updated_at }`. M3U episode ids are made unique per series
  (`"Season 01:01"`); Stalker's are already `"<seasonId>:<n>"`.
- Movie entries get an extra `updated_at`, so Continue Watching is newest first. It is capped
  at 15 for both movies and series (the business-rules Notes recommendation), instead of the TV's
  two inconsistent behaviours.

### D-039 · Toast duration

R-131 says toasts last 2 s on TV; design-system.md §5 specifies 4 s for the phone's toast. The
phone follows the mobile design system (4 s, `TOAST_MS`); the TV value is kept as `TV_TOAST_MS`.

### D-040 · Search and sorting details

- Search uses FTS5 (architecture.md) with each word as a prefix term, so "spo" finds "Sports", but
  a word is not matched from its middle (the TV's substring test finds "ports" inside "Sports").
  Diacritics are ignored. The minimum length is 2 everywhere (Q-behaviour-fixes #1). User input
  is always quoted, so it can never be FTS syntax.
- Search excludes adult categories (R-064) and hidden categories (R-098), and only returns items
  in a known category (data-models.md §10).
- A-Z / Z-A pages sorted in SQLite use `COLLATE NOCASE` (ASCII case folding). The in-memory
  `sortItems` uses `localeCompare`, as on TV.
- Stalker pages are cached in arrival order; a sort re-orders everything loaded so far, instead of
  the TV's per-batch client sort.

### D-041 · Catalogues are cached across sessions

The TV re-downloads every list each session. The phone keeps the last copy in SQLite (N-01: Home
renders from the cache in under 1 s). R-050 is unchanged: a section is still re-synced the first
time it is opened in a session, and pull to refresh (N-09, R-052) re-syncs the loaded sections.

### D-042 · Portal MAC on the phone

R-038 builds the virtual Stalker MAC from the device's hardware MAC when there is one.
stalker.md §1 says a phone has none and must use the random persisted `00:1A:79:XX:XX:XX` path.
`virtualStalkerMac` supports both; the app passes no hardware MAC.

### D-043 · Live Initialization "Default" row

settings.md §2.13 says Default opens "the 3rd category (index 2, usually the first real category
after Search All and Recently Viewed)", but data-models.md puts Favourites at index 2. The rule
is implemented literally: the row at index 2 of the visible rows if it has channels, otherwise
the first non-empty row.

### D-044 · Small robustness choices

- An Xtream movie or episode without `container_extension` plays as `.mp4` (the TV builds
  `.undefined`, which never plays).
- `StalkerSource` checks the profile on connect (R-026) and throws `AuthError` with
  `portal_expired` or `portal_unavailable`, so screens can show the matching TV message.
