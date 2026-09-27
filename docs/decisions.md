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
(to 2438-01-02) and an expired device stays blocked.

**Owner's answer (2026-09-26, Q-offline-expired):** offline, the app runs on the data of the last
successful connection, and if its expiry date has passed the user is **not** let in. So
`accountState` applies R-006 whether online or offline, and the 2438-01-02 display date is not
used. This overrides the "treated as valid" part of R-005.

### D-036 · Playlist key renames match the id exactly

R-030: when a `non_saved_…` playlist gets a server id, the TV renames keys by substring
replacement, which can touch unrelated keys (data-models.md Notes). The phone renames only keys
where the old id sits right after the prefix and is followed by `live`, `vod`, `series` or `_`.

### D-037 · A full favourites list refuses new items

R-070 gives the limits (500 live, 200 movies, 200 series) but not what happens at the limit. The
phone refuses the add (`"full"`) rather than silently dropping an older favourite
(Q-favourites-full, confirmed by the owner on 2026-09-26).

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

### D-045 · `.npmrc`: `ignore-scripts=true`

A clean `npm ci` failed on Windows without Visual Studio: `better-sqlite3` (dev only) ships
prebuilt binaries and sets `"gypfile": false`, but `npm ci` builds packages from the lockfile
entry, which does not record that flag, so it runs `node-gyp rebuild`. The only packages with
install scripts are `msw` (copies a browser worker, not used in Node tests), `unrs-resolver` (a
binding check) and `fsevents` (macOS only), so the project skips install scripts. **When adding a
library, check whether it needs an install/postinstall script**; if one does, run it explicitly
(`npm rebuild <pkg> --ignore-scripts=false`) or revisit this decision.

## M3 · Boot, activation and playlists

### D-046 · Copying without a rebuild

The Activation card copies the device id and key (screens.md). `expo-clipboard` is a native
module, and the development build was just rebuilt, so `src/platform/clipboard.ts` uses React
Native's own `Clipboard` (deprecated, still in RN 0.86 and in the build). It moves to
`expo-clipboard` at the next native rebuild that is needed anyway (M5 adds `react-native-video`).

### D-047 · Non-ASCII text in encrypted requests

The backend source (ApiController `decryptRequest`) decodes the request Base64 as **ASCII**, not
UTF-8, so the UTF-8 bytes of an Arabic or accented playlist name arrive garbled and the request
fails (device-and-auth.md Notes 1 asked for this check). `encryptRequest` now writes every
non-ASCII character of the JSON as a `\uXXXX` escape: the payload is pure ASCII and the server's
`JSON.parse` restores the text. ASCII payloads are byte-identical to the TV's.

### D-048 · `uid_mismatch_captcha` is not an expired session

The backend sends the ownership check from `device_info` (and `device_login`) with
`error_code: 401`. device-and-auth.md §4.3 counts error_code 401 as an auth failure, which would
drop the token and log in again forever; §4.2 says this status shows the uid captcha. The status
check wins: `isAuthFailure` ignores `uid_mismatch_captcha`. The fixture now sends the code too.

### D-049 · Other backend shapes found in its source

- A device without playlists gets `urls: ["<demo url>"]`, a bare string; it is read as the
  `demo` entry (id `demo`, type `general`).
- Some `manage/*` errors use a `result` key; the message is read from `msg`, `message` or
  `result`.
- The fixtures follow the server: `is_trial` 0 for a trial (1 means deactivated on the server),
  the demo as a string. The server always sends `mac_registered: true` (Q-mac-registered).

### D-050 · Network mode: fixtures, the owner's dev backend, production

The "use fixtures" switch (M1) becomes a three-way network mode in development and preview
builds: **fixtures** (default), **dev backend** (the owner's `iboplayer-backend.youssef-dev.online`,
used as the only panel; the agent servers are skipped because the dev backend has none) and
**production**. Production builds always use production. Switching forgets the session data
(a token from one backend is invalid on another) and restarts. The old "use fixtures: off" value
migrates to production.

### D-051 · Routes

- The splash is the start route (`app/index.tsx`), so Home moved to `app/(tabs)/home.tsx`
  (`/home`).
- The boot screens live in `app/(boot)/` (terms, verify, welcome, expired, server-failed); the
  playlist loader is `app/loading.tsx` (also used for switches, then the stack resets to Home).
- `src/navigation/AppStack.tsx` guards the routes with `Stack.Protected`: Account, Playlists and
  Portals need a known, unexpired account; the tabs also need a loaded playlist (R-006, flow 10).
  A blocked route falls back to the splash, which boots again.

### D-052 · Dev link for the e2e flows

Maestro cannot reach the in-memory fixture scenario, so development and preview builds accept
`iboplayer://dev?network=…&reset=1&account=…&demo=…` (`app/dev.tsx`). It switches the network
mode, forgets the app data (the device id stays) and sets the fixture scenario, which is kept in
storage so restarts in a flow see the same account. Production builds ignore the link.

### D-053 · M3 builds early versions of some design-system components

Button, TextField, Card, ListRow, Screen, Toast, CopyRow, Banner, LoadingView and the Activation
card are built now, from the tokens, because the M3 screens need them. M4 finishes the full
component set with every state and the component gallery.

### D-054 · Small M3 choices

- Home is still a placeholder: a playlist chip (opens Playlists), the account avatar, and the
  first live categories of the active playlist, loaded after Home appears (user-flows.md §4's
  recommendation). It shows that a switch re-synced the catalogue (flow 7).
- Deleting uses the overflow menu with a confirmation; swipe-to-delete comes with the list
  components in M4. The playlist expiry popup (R-114) and the Home double-back exit (R-130) are
  M4/M6 (the roadmap puts Home and the expiry notices there).
- The Playlists "Reload" is pull-to-refresh and restarts the boot (device info, then the
  playlist), as the TV's Reload restarts the app.
- A load cancelled from the loader (Back, or "Change Playlist" after 120 s) returns once the
  running request stops; Xtream and M3U requests stop at once, a Stalker handshake can take up to
  its 15 s timeout.
- The "I've verified — Continue" button appears after "Verify on website" was opened. The backend
  source has no separate web-verification path: login without codes succeeds once the website has
  marked the device verified.
- `expo-asset` is installed at the top level: `expo-sqlite` imports it, and it was only nested
  under `expo`. It is already in the development build (the `expo` package links it).

### D-055 · expo-sqlite: no finalize-all before closing a connection

Found on the phone by Maestro flow 1: the first catalogue write crashed the app natively (Scudo
"invalid chunk state", in `sqlite3_finalize`). Each `withExclusiveTransactionAsync` opens its
own connection and closes it at the end; before closing, expo-sqlite finalizes every statement of
that connection (`finalizeUnusedStatementsBeforeClosing`, default true), including the FTS5
module's internal statements, which FTS5 then frees again when the connection closes. Reproduced
on the device (the migration inside an exclusive transaction crashes on close; the same script
outside it, or a transaction without FTS5, does not) and fixed by opening the database with
`finalizeUnusedStatementsBeforeClosing: false`. Every statement the app runs goes through
`runAsync` / `getAllAsync` / `getFirstAsync`, which finalize it themselves. Node tests use
better-sqlite3, so only a device run catches this kind of bug.

### D-056 · The Welcome screen for a new device on its trial

R-007 shows the trial Welcome screen when `mac_registered` is false, but the backend registers a
device at once (`mac_registered` is always true) and marks a new device with `is_trial: 0` for its
7-day trial. **Owner's answer (2026-09-26, Q-mac-registered):** show the Welcome screen to a new
device on its trial. The account state is "trial" when the device is not registered **or**
`is_trial` is 0; a paid licence (1, 2 or 3) goes straight in. The fixtures now send the trial as
the backend does (`mac_registered: true`, `is_trial: 0`).

## M4 · Browse

### D-057 · Scrims with React Native's built-in gradients (closes D-017)

The hero and details scrims use `experimental_backgroundImage` with a CSS `linear-gradient`
(React Native 0.86, New Architecture). It needs no library and no new development build. The
gradient strings live in `src/theme/colors.ts` (`gradients`), next to the `scrims` tokens.

### D-058 · Phone-only keys for the new Home rows and Search

N-01 wants "one row per category the user has opened most", and screens.md wants recent
searches; the TV has neither. Two per-playlist keys hold them, in the TV naming style:
`{P}{pid}_mobile_category_opens` (open counts per kind; adult categories are never counted) and
`{P}{pid}_mobile_recent_searches` (the last 10 queries, newest first). Home shows the 3 most
opened movie or series categories.

### D-059 · The IBO image cache is skipped in the dev-backend mode

TMDB artwork on the details pages goes through the IBO image cache for Xtream playlists
(services.md). The cache is an IBO server, so it is used only in production and in fixture mode
(where the fixtures answer it). In the dev-backend mode the app calls TMDB directly. The rule
"never call the real IBO servers during development" holds in every mode.

### D-060 · A favourite changes at once on the details page

R-078 applies the TV's details-page favourite when the page is left. user-flows.md §7 Mobile
says the phone applies it immediately, with the same restrictions. The phone follows
user-flows.md. The toasts are the TV's (`<name> added to Favorites.`, `Parental Safety`). R-078's
rule function stays tested for parity.

### D-061 · Development builds cannot reach the production backend (owner's rule)

**Owner's rule (2026-09-26):** never test on the production backend, so the real database gets
no fake devices or playlists. Development and preview builds now offer only "Fixtures" and "Dev
backend". A stored "production" (from before this rule), an unknown value or the old
"use fixtures" switch all mean the fixtures. The dev link ignores `network=production`.
Production builds still always use production. If an owner-approved preview build ever needs the
real backend, this rule has to be lifted on purpose.

### D-062 · Libraries added in M4

All three are JavaScript only, so no new development build is needed:

- `@shopify/flash-list` 2.0.2: the version Expo SDK 57 lists.
- `@gorhom/bottom-sheet` 5.2.14: its peers are Reanimated ≥ 4 and Gesture Handler ≥ 2.16, both
  already installed.
- `@tanstack/react-query` 5.104.0.

Nothing needs an install script (D-045). Browse queries read SQLite and MMKV, so they never go
stale on their own; they are refreshed by invalidation when a section syncs or a list changes
(`src/hooks/queryClient.ts`).

Test setup notes:

- FlashList's `jestSetup.js` points `FlashList` at an export v2 no longer has, so only its
  measurement mock is copied into `jest.setup.ts`.
- `@testing-library/react-native` 14 made `fireEvent` asynchronous, so it is awaited.
- The expo-router test helper replaces the Reanimated mock with one that has no
  `useReducedMotion`. The components use a small `useReduceMotion` hook on `AccessibilityInfo`
  instead, which is also what design-system.md §7 names.

### D-063 · M4 scope choices

- **Playback comes in M5.**
  - Play, Resume and episode taps show "Playback arrives in the next update." for now
    (`src/utils/content.ts`, one place to replace).
  - The Live tab's sticky preview shows the selected channel's logo and programme on now.
  - The Guide, Replay and Sports entries, and the `EpgTimeline` component, come with the EPG
    guide in M5.
- **Rows and lists:**
  - "See all" and the category picker open a category screen with the poster grid (3 columns, 4
    from 480 dp, 6 on tablets), rather than a grid inside the tab.
  - Continue Watching stays separate for movies and series (user-flows.md §12), as two Home rows.
  - Long press opens quick actions. "Remove from Continue Watching" (user-flows.md §12, optional)
    is included.
- **Custom categories:** their rows appear when the feature is on. The "Add to…" chooser comes
  with Settings → Custom Categories in M6, since categories can only be created there.
- **Later milestones:** the expiry banner and popup (R-114) are M6; the Downloads segment of My
  List is a placeholder until M7.
- **Stalker:** category lists keep the portal's order for the chosen sort; the per-batch
  client-side sort of stalker.md §4.10 is not applied, since the portal already sorts.
- **Trailer** opens the YouTube link outside the app; the player (M5) may embed it.
- **Search:** opening Search starts the downloads of the sections it covers (Q-search-lod), and a
  note says the results may be incomplete while they run.
- **Fixture "Fixture Big":** a playlist with 20,000 channels and a 5,000-movie category, turned
  on by the dev link `big=1`. It exists for the M4 scrolling check.

### D-064 · Bugs the phone run found, and the fixes

Maestro flows 5 and 6 on the owner's phone found five bugs the Node and component tests could
not see:

- **Bottom sheets never opened when they sized to their content** (PIN, sort, quick actions),
  for two reasons:
  - `@gorhom/bottom-sheet` measures `BottomSheetView`, and padding on that view kept the sheet
    at height zero. The padding now sits on an inner view.
  - `dismiss()` on a sheet that was never presented left it in the library's queue. The next
    sheet presented was then "restored" instead of opened.

  `Sheet` now dismisses only a sheet it presented. It presents again for a new PIN request
  (`presentKey`), and Android Back closes an open sheet first, so a PIN request can't be left
  pending.

- **The category chips grew to fill the screen height.** A horizontal `ScrollView` in a column
  needs `flexGrow: 0`.
- **Chip taps with the keyboard open only closed the keyboard** (the Search segments). The chips
  now keep taps (`keyboardShouldPersistTaps`).
- **Search messages were hidden under the keyboard.** They now sit at the top of the screen.
- **New recent searches did not show until Search was opened again.** They are now read again
  whenever the field is empty.

Two smaller fixes:

- Hidden empty rows (Recently Viewed, Favourites) no longer leave a gap at the top of Movies and
  Series.
- The dev link takes `lang=en|ar`. The flows set English, because they check English text; the
  phone had been left in Arabic.

In development builds, Expo's floating Tools button covers the Account avatar. Flow 5 opens
Account through its link (`iboplayer://account`); release builds have no such button.

**The scrolling check** (a 5,000-movie category, a development build on the owner's DNP NX9):
flinging 25 times down and 10 times up reached movie 4,090, with pages loading as it went.
Android's frame statistics for the scrolling alone were 1,021 frames, 7.35% janky, and frame
times of 8 ms at the median, 18 ms at the 90th percentile and 29 ms at the 99th.

A development build runs JavaScript in debug mode, so a release (preview) build will be
smoother. That build is the real check of "no dropped frames visible", and it belongs with the
preview build.

## M5 · Playback

### D-065 · Libraries added in M5 (a new development build)

These have native code, so M5 needs a new EAS development build. The M4 build cannot run the M5
JavaScript: it has no video module.

- `react-native-video` 6.19.3 (Media3/ExoPlayer 1.8.0), with its config plugin:
  - Picture-in-Picture on the main activity;
  - notification controls: the media playback service and its permissions;
  - HLS and DASH only (no Smooth Streaming or RTSP).
- `expo-screen-orientation`, `expo-keep-awake`, `expo-brightness` and `expo-navigation-bar`
  57.0.2: the versions Expo SDK 57 lists.
- `react-native-volume-manager` 2.2.0, for the volume swipe. It is a legacy native module, which
  runs through React Native's interop layer. expo-doctor passes (21/21).

None of them needs an install script (D-045). A local prebuild showed:

- the activity keeps `smallestScreenSize` in its `configChanges`, so entering PiP does not
  recreate it;
- the service and the permissions are in the manifest;
- the ExoPlayer module properties are set.

### D-066 · The Media3 TS extractor flags are set by a prebuild patch

player.md §2.6 asks for `FLAG_ALLOW_NON_IDR_KEYFRAMES | FLAG_DETECT_ACCESS_UNITS`, so raw MPEG-TS
live streams (the default for live) start quickly. react-native-video 6.19.3 builds its
progressive sources with the default extractors and has no option for this.

`plugins/withTsExtractorFlags.js` therefore patches `ReactExoplayerView.java` at prebuild:

- it passes a `DefaultExtractorsFactory` with the flags to the two network
  `ProgressiveMediaSource.Factory` calls;
- the extractor classes are already on the library's classpath;
- it fails the build with a clear message if the code it expects has changed.

### D-067 · Player controls follow the TV where the design system differs

- **Auto-hide:** the controls hide after 10 s (VOD) and the live bar after 7.5 s. These are the
  TV's timeouts, which player.md §3.3 keeps. design-system.md §7 says 4 s.
- **Skip buttons:** the centre buttons skip ±30 s (parity, and N-04: "the ±30s skip buttons
  remain in the control bar"). Double-tap skips ±10 s. screens.md drew −10/+10 in the centre.
- **Aspect ratio after a channel change:** the live player resets it to Fit, not the TV's
  Stretch. Stretch distorts 16:9 video on a 19.5:9 phone screen.
- **Not included:** the exit confirmation and live channel-number entry (player.md §3.3 drops
  both), and "Other in category" (optional there).
- **Subtitle colours** are swatches to tap instead of the TV's arrows that cycle through them.
  The saved values are unchanged.

### D-068 · The EPG guide follows the mobile design

- **Past programmes:** R-096 says past programmes never play from the guide.
  - screens.md and testing.md flow 4 say a past programme with an archive plays its catch-up.
    The phone does this on Xtream (R-097); Stalker Replay stays blocked.
  - A past programme without an archive shows "No archive video available for this programme".
  - `guideTapAction` keeps the TV rule, and it stays tested.
- **Days:** the guide offers today and every day in the loaded data, since screens.md has a day
  picker. The TV shows today only.
- **Time axis:** runs left to right in Arabic too.
- **Loading:** the R-096 limits hold:
  - rows load 4 at a time, 15 s each, visible rows first, then ±10 rows around them;
  - rows are cached per playlist for the session, and failed rows retry on the next visit;
  - the guide gives up after 8 empty rows.
- **Replay:** the Live tab header has a Replay button on Xtream playlists. It opens categories
  with archive channels, then the channels (`live_sort`), then days and programmes. The catch-up
  list is oldest first (parity), with the latest day selected.

### D-069 · Resume, next episode and the play queue

- **Where Play starts:**
  - Resume on a details page starts at the saved position, since the button already says where.
  - Episode rows, Previous/Next and the next episode ask with the R-075 prompt.
  - The prompt pauses the video, closes by itself after 15 s, and is offered only when the stream
    can seek.
- **Previous and Next** move within the season's episodes (parity) or that day's catch-up
  programmes.
  - A movie opened from its details page has no Previous/Next: the phone opens movies from rows,
    search and Continue Watching, not only from a category list. This is a known difference.
- **N-07 next-episode card:** it shows in the last 30 s of an episode that has a next one.
  - Autoplay stays off by default (TV parity).
  - With autoplay off, the card is a plain "Next episode" button.
  - With autoplay on, the card counts down 10 s on playback time. When an episode ends, the next
    one plays at once; if the list has run out, the player closes.
  - Cancel turns autoplay off for that episode only.
- **Recently Viewed (R-072):** a channel is recorded when it actually plays, in the mini player or
  the live player, not when it is tapped.
- **Seeking unavailable:** a player error within 3 s of a seek counts as the seek having killed
  the stream (player.md §3.1 point 5). Seeking is then turned off for that video.

### D-070 · No FFmpeg audio decoder in v1

react-native-video 6.19.3 hard-codes Media3's extension renderers off, so the FFmpeg audio
extension (player.md §2.6) cannot be added without forking the library.

- AC3, E-AC3, DTS and TrueHD audio plays only on phones with a decoder for it; many Samsung
  phones have one.
- A decoder failure shows "This format isn't supported on your device".
- No VLC fallback either. See Q-ffmpeg-audio.

### D-071 · What the player plays in fixture mode

The native player cannot reach the `.fixture.test` hosts. In fixture mode, fixture stream URLs
therefore become public test streams:

| Fixture item                | Test stream                                     |
| --------------------------- | ----------------------------------------------- |
| `.m3u8` movies and episodes | Mux's Big Buck Bunny HLS (10:34)                |
| Catch-up and Stalker series | Mux's Big Buck Bunny HLS (10:34)                |
| `.mp4` movies               | Google's Big Buck Bunny MP4                     |
| `.mkv` movies               | Google's Media3 MKV sample                      |
| Live channels               | Unified Streaming's live HLS demo stream        |
| Channel 10001               | Apple's bipbop MPEG-TS segment (progressive TS) |
| Channel 10002               | A URL that answers 403, to show the error state |

The mapping lives in `src/api/__fixtures__/playback.ts`, which is loaded only in fixture mode.
Other URLs are untouched. Playback in fixture mode needs internet.

### D-072 · ibosub, orientation and one stream at a time

- **ibosub:** ibosub.com is an IBO server, so it is skipped in the dev-backend mode ("No
  subtitles found"), as the image cache is (D-059). The fixtures answer it in fixture mode. The
  TMDB search for a subtitle's TMDB id follows R-122 (TMDB off: no search).
- **Orientation:** it follows the focused route in one place (`useRouteOrientation`):
  - the players are landscape;
  - the guide turns with the phone;
  - everything else is portrait.

  Returning from the guide can therefore never leave the wrong orientation lock behind.

- **One stream at a time:** IPTV accounts often allow a single connection.
  - The Live tab's mini player stops when the tab loses focus.
  - The live player unmounts its video while the guide or a catch-up player is on top, and
    reloads at the live edge when it comes back.

### D-073 · What the first phone run of the player found

The M5 development build on the owner's phone found these, all fixed:

- **Seeks were checked against a position of 0.** react-native-video 6.19's
  `getCurrentPosition` resolves the view through a lookup its own code marks "to do". It failed
  on the New Architecture, so every seek looked failed and was reloaded at the first target
  (three +30 s presses gave +30 s). Seeks are now checked against the position from the
  player's progress events (every 250 ms).
- **A tap on a control also toggled the controls.** A native tap gesture on the layer below still
  received touches that landed on the buttons above it. Tap and double-tap are now a plain
  `Pressable` under the controls, so a button keeps its touch. The swipes (brightness, volume)
  and pinch stay native gestures, which a tap never starts.
- **Akamai's public live test stream broke.** Its master playlist now lists variants that answer 404. The fixture live channels play Unified Streaming's live demo stream instead.

- **react-native-video drew its own "LIVE" badge** over live streams. It is hidden
  (`controlsStyles.hideLiveBadge`); the live bar already says what is playing.
- **A tap on a settings row with a switch did nothing;** only the switch itself flipped. Toggle rows
  now flip from anywhere on the row (all screens).
- **The players re-applied the system bars four times a second** (on every progress event).
  `PlayerChrome` is memoised.

Checked by hand on the phone:

- HLS: movies and episodes.
- Raw MPEG-TS: fixture channel 2. The 10 s file plays to its end, then the live player
  reconnects.
- MP4: movie 3.
- Live HLS.
- The failed state: channel 3 answers 403 → "Access denied…", then Next channel plays.
- PiP: from Home and from the PiP button, with live and VOD video continuing; back to the full
  player afterwards.
- Background audio: with the screen off, the media session stays PLAYING and the position
  advances, with a media notification (transport controls).
- Rotation: the players are landscape, and the other screens portrait.

Notes for the flows:

- Maestro waits for the screen to settle after each tap, and a playing video never settles: a
  tap took about 11 s, longer than the controls stay up. Taps inside the players use
  `waitToSettleTimeoutMs: 500`.
- `common/show-controls.yaml` waits for the controls to hide, then taps to show them, so the next
  taps get a full 10 s.
- An HLS seek takes 2–4 s to land on the phone (a segment load).
- `uiautomator dump` cannot get an idle screen while video plays and silently keeps the previous
  file: use screenshots to see the player.
- After `am force-stop`, this phone (Honor) sometimes blocks Maestro's launch; flow 10 once failed
  that way and passed when run again.

### D-074 · M6 scope: the settings and services the owner dropped

The owner dropped these from v1 on 2026-09-27. Each keeps its TV default, so the app behaves as
the TV app does with the setting untouched:

- **Font Size:** Normal. Android's system font scale still applies.
- **Toggle TMDB API:** on.
- **Toggle Home Favorites:** on (the Live favourites row shows; still hidden for Stalker).
- **Load on Demand:** enabled.
- **Custom Categories:** off; no custom rows and no "Add to…".
- **Media Player choice:** one engine (react-native-video); the fallback chain is automatic.
- **App Theme and Channel Theme:** not used; one dark look and one Live layout.
- **Stararcs proxy:** not offered. R-042, R-110, R-112 and R-113 do not apply, and Q-stararcs-http
  is moot.

`docs/parity.md` lists each as dropped with this reason.

### D-075 · Move on the phone; Sports mode and Arrange Categories dropped

The owner chose on 2026-09-27 (after the M6 list missed these three): **Move** is in v1, **Sports
mode** (R-100, R-101) and **Arrange Categories** (R-094) are not. Their rules stay in
`src/content/rules` (tested) but no screen uses them; `docs/parity.md` lists them as dropped.

How Move works on the phone (R-093):

- An order screen (`app/live-order.tsx`) with up and down buttons on each row, instead of the TV's
  Move mode or drag handles. It needs no new library, and a button press is exact where a drag
  in a long list is not.
- Entry points: the Live category sheet ("Move categories") and a channel's long-press menu
  ("Move channel", for that channel's category).
- Every step is saved at once under the TV keys (`_category_orders`, `_channel_orders`), in the
  TV's format. The phone saves the whole order (one position per row), so replaying the entries
  by position rebuilds exactly that list. Categories the provider adds later keep their place
  after the ordered ones.
- Search All stays first and nothing moves above the first row (R-093).
- Channels move only in provider categories of Xtream and M3U playlists. A Stalker category comes
  page by page from the portal, so the phone never holds its full list to order.
- A reordered category is read whole from SQLite and then ordered; other categories stay paged.

### D-076 · M6 choices

- **Settings** (Account → Settings) has the groups Playback, Content, Startup, General and
  Storage, then About (user-flows.md §14 Mobile, without the dropped items). Parental Control
  moved there from Account, and Account gained Settings, Change Language and About.
- **Choices** open a radio bottom sheet (`OptionSheet`) with the TV description. The
  development-only language switch (D-015) is gone: `LanguageSheet` replaces it.
- **Clear Cache** (R-120) also empties the saved catalogue (SQLite) and the image disk cache,
  since the phone keeps both across sessions (D-041). The device id (secure storage) stays, so the
  device verifies again with the same MAC. A development build keeps its network mode and
  fixture scenario, so it cannot fall back to production (D-061).
- **Hide Categories** lists every row but Search All (virtual rows too, as on TV). A section never
  opened shows "Categories will show here". Changes apply to the tabs and Search at once.
- **Expiry notice** (R-114): a warning banner at the top of Home ("Playlist will expire in 3
  days", with Dismiss) and the TV notice as a bottom sheet, once per launch and playlist. A
  dismissed banner stays hidden until the next launch. Only Xtream accounts expiring within 5
  days show it. Fixture link `expiresIn=<days>` sets the fixture account's expiry.
- **Unsupported audio** (Q-ffmpeg-audio): when a video has audio but the player selected none of
  its tracks and every track is Dolby (AC-3, E-AC-3, AC-4, TrueHD) or DTS, a toast says the phone
  cannot play its sound. Once per video, and once per channel on live (not on each reconnect).
  React-native-video does not report the decoder failure itself: Media3 simply plays without
  audio.
- **About** shows the app name, version and build, and the website.
- **Back on Home** (R-130) already exited on a double press since M4.

### D-077 · The phone owns its string files (owner's decision)

The kit treats the TV's locale files as a copy to keep in sync, with new keys in English only
until a translator fills them in (05-reference/translations.md). On 2026-09-27 the owner decided
the phone app structures its own files: the TV app is a reference for what is needed, not a file
format to preserve.

- `src/i18n/locales/en.json` and `ar.json` are the app's own files, complete in both languages.
  The Arabic for the phone strings, and for the 60 TV keys the TV's Arabic file lacked, are
  machine drafts: a native speaker reviews them before release (M8 checklist).
- The 194 TV keys the phone never uses were removed (Stararcs, custom categories, Arrange, TV
  themes and layouts, remote-key hints, QR scanning, TV-only messages). The kit still has them if
  a feature comes back.
- Count strings have all six Arabic plural forms (zero, one, two, few, many, other).
- `src/i18n/__tests__/locales.test.ts` fails when Arabic lacks a key or a plural form, when a
  placeholder differs, or when a key is not used in the code. Every new string gets its English
  and Arabic in the same change.
- New keys no longer need the `mobile_` prefix; the existing ones keep it (renaming them brings
  nothing).
- The one hard-coded placeholder ("My Portal", hard-coded on TV too) became
  `mobile_portal_name_placeholder`. Example URLs in placeholders stay as they are.
- The clean-up found one missing behaviour: the "Auto Switch" toast (R-021, "Playlist failed to
  load. Switched to …") when Auto Switch Playlist loads another playlist. It is now shown.

### D-078 · Downloads (M7)

- **Libraries** (a new development build): `@kesha-antonov/react-native-background-downloader`
  4.6.3 (the kit's choice: background transfers, a progress notification, pause and resume,
  Wi-Fi only; a TurboModule with an Expo plugin) and `expo-file-system` 57.0.7 (the downloads
  folder, free space). react-native-mmkv already provides MMKV, so the plugin runs with
  `skipMmkvDependency`. The Android 13+ notification permission is asked at the first download.
- **Never Android's DownloadManager** (player.md §8.3): it keeps every URL in a system database,
  and Xtream URLs hold the password. The library uses its in-app downloader on Android 14+ but
  DownloadManager below 14, so `plugins/withInAppDownloader.js` patches its Kotlin source at
  prebuild: every Android version takes the in-app path (a foreground service below 14). The
  patch fails the build if the code it expects changes; `src/__tests__/plugins.test.ts` checks it
  (and the D-066 patch) against the installed sources.
- **No stream URL in the manifest.** A record keeps the catalogue ids. The URL is built (Xtream),
  read again from the catalogue (M3U, whose URLs hold the account) or requested from the portal
  (Stalker `create_link`, with its headers) each time a download starts. A record of a playlist
  that is not loaded waits in the queue. While a task runs, the library keeps its URL in its own
  app-private storage.
- **One download at a time** (player.md §8.2 "Limits": a download takes one of the account's
  connections; new-features.md allowed 2). Playing a stream while a download runs shows a warning;
  playing a downloaded file does not.
- **Wi-Fi only** is on by default (N-03), in Settings → Downloads, and applies to running tasks.
- **Space check**: a HEAD request (or a one-byte Range GET, which many IPTV servers answer better)
  gives the size and Range support; free space must cover the file plus 200 MB. A server without
  Range is marked: the Downloads screen says an interruption starts it again.
- **Interruptions**: pause keeps the task and continues it. On Android 14+ a lost network pauses
  the system job, which continues when the network returns; a Wi-Fi-only download below 14 waits
  for Wi-Fi. A download the library reports as failed starts over on Retry (the library cannot
  continue a failed task from JavaScript). To check on the phone.
- **After a restart** the manager reattaches to the tasks the library kept; a task that is gone
  goes back to the queue, and a finished file that is missing is marked "no longer available".
- **Offline playback**: the player plays `file://` for a finished download, with the same resume
  keys as online. Adult items ask for the PIN every time from the Downloads screen and never save
  a position (R-061, R-063). A download of another playlist is listed but plays only once that
  playlist is loaded (its progress keys belong to it).
- **Subtitles** (player.md §8.2): when a download finishes, the ibosub subtitle in the app
  language (else English) is saved next to it; a subtitle chosen while watching a downloaded
  video is saved too. Offline, the subtitle sheet lists the saved ones.
- **Fixtures**: downloads map fixture URLs to the public MP4 (65 MB) or MKV (17 MB) test file by
  container (`fixtureDownloadFor`); HLS fixtures are never downloadable.
- **Q-downloads** (default): kept until the user deletes them. An expired licence already blocks
  the app (R-006, D-035); an expired playlist does not block its downloads. Removing a playlist or
  portal offers to delete its downloads.
- **Not in v1**: HLS VOD downloads (N-03), catch-up downloads, and a "downloaded" tick on posters.
