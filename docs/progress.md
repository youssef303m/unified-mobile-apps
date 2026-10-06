# Progress

A new session must be able to continue from this file alone. Read `AGENTS.md` first.

## Current milestones: M6, M7 and M8 · Hardening and release. Built; the whole app is retested next

The owner asked to build M8, then retest the whole app. **Retest on the preview build
(2026-10-04): all 10 Maestro flows passed**; the shared open step now stops the app first on a
preview build, which has no dev-client reload. Cold start reaches Home in ~1.3-1.5 s; the
5,000-movie scroll has 0.83% janky frames (docs/release-checklist.md §1, §3).

Earlier, on the M7 development build: flows 1, 2,
3, 4, 6, 8 and 9 passed on the M7 development build (flow 9: the MKV downloaded, then played in
airplane mode); flow 5 needed one more Back (fixed); flows 7 and 10 did not run (the phone
dropped off USB).

| M8 item (04-build/roadmap.md)                                    | Status                                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Error states on every screen                                     | done: `ErrorState` with Try again where a query failed silently; refresh failures toast; Expired and loading feedback           |
| Offline mode (downloads usable, clear messaging)                 | done (D-081): a playlist opens from its saved catalogue without a connection; Home banner with Try again; "nothing saved" error |
| TalkBack pass                                                    | done (D-082): the player keeps its controls, Unlock is reachable; switch/radio rows; announcements; fuller labels               |
| Crash reporting (if decided)                                     | hook in place, disabled until the owner gives a Sentry DSN (D-079); a crash screen instead of closing                           |
| Analytics (Q-analytics)                                          | removed by the owner (D-080); R-133 dropped                                                                                     |
| Performance budgets, release checklist                           | `docs/release-checklist.md` (budgets measured on the preview build)                                                             |
| **Accept:** full Maestro suite + manual checklist; preview build | Maestro 10/10 on the preview build (2026-10-04); the manual checklist (§2) to do                                                |

| M7 item (04-build/roadmap.md)                                | Status                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Download manager, queue, storage checks (N-03, player.md §8) | done (`src/downloads/`: manager, rules, native adapter; one at a time; space check; in-app downloader on every Android, D-078) |
| Downloads screen, Download buttons, offline playback         | done (My List → Downloads, `src/screens/DownloadsList.tsx`; movie page and episode rows; the player plays the file)            |
| Wi-Fi-only setting, notifications                            | done (Settings → Downloads, on by default; the library's progress notification; permission at the first download)              |
| **Accept:** Maestro flow 9; the kill-and-resume manual test  | flow 9 written (`e2e/flow-09-download.yaml`); both to run on the phone with the new build                                      |

| M6 item (04-build/roadmap.md)                                        | Status                                                                                                                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Every kept setting (settings.md minus TV-only and the owner's drops) | done (`app/settings/`: Settings, Hide Categories, Subtitle Settings, Parental Control; `OptionSheet`, `LanguageSheet`); D-074, D-076 |
| Clear Cache, Clear Watch Lists, Language, About                      | done (`clearAppCache` in `src/session/boot.ts`; `app/about.tsx`)                                                                     |
| Expiry notices (R-114)                                               | done (Home banner and once-per-launch sheet; fixture link `expiresIn=`)                                                              |
| Stararcs proxy                                                       | dropped by the owner (D-074)                                                                                                         |
| Move (R-093), from the parity check                                  | done (`app/live-order.tsx`, `src/browse/order.ts`; D-075). Sports mode and Arrange Categories dropped by the owner                   |
| Unsupported audio notice (Q-ffmpeg-audio)                            | done (`audioUnplayable` in `src/player/tracks.ts`)                                                                                   |
| Arabic for every phone string (owner, from the M6 review)            | done (`src/i18n/locales/ar.json` complete; unused TV keys removed; D-077); drafts to be reviewed by a native speaker before release  |
| **Accept:** Maestro flow 8; `docs/parity.md`                         | flow 8 written (`e2e/flow-08-language.yaml`), to run on the phone; `docs/parity.md` done (3 small gaps listed for the owner)         |

Flow 5 now reaches Parental Control through Account → Settings.

## Dev IBO backend (from the owner)

- Hosted: `https://iboplayer-backend.youssef-dev.online/` (panel base `…/api`; routes
  `/api/<app_type>/v4/...`, `android` allowed). Source: `d:\dev\Backend\iboplayer-backend`
  (Express; `routes/api.js`, `controllers/ApiController.js`). Do not read its `.env` (secrets).
- **Never test on the production backend** (owner, 2026-09-26): development builds cannot select
  it (D-061).
- In the app: the "Dev backend" network mode (Home, Account or Server-failed screen, dev builds).
  It is the only panel; the agent servers are skipped. It blocks an IP for 4 hours after 50
  requests a minute (Q-rate-limit).
- The owner allows changing the backend source **for testing only**: discard every change
  afterwards, and never commit or push anything in `iboplayer-backend`. (The hosted copy only
  changes if it is redeployed; a local run would be needed to test changes.)

## Accepted milestones

- **M0 · Project skeleton** (2026-09-26): accepted on the owner's phone (EAS development build,
  D-019). Languages then narrowed to English and Arabic (D-020).
- **M1 · Fixtures and API clients** (2026-09-26): every endpoint tested against fixtures, crypto
  vectors, M3U 20,000 entries in ~0.14 s.
- **M2 · Content layer and storage** (2026-09-26): all three types sync into SQLite, search
  < 300 ms on 20,000 channels, all 88 R-xxx tests.
- **M3 · Boot, activation and playlists** (2026-09-26): Maestro flows 1, 7 and 10 passed on the
  owner's phone; the native SQLite crash they found is fixed (D-055). Owner answers:
  Q-offline-expired, Q-favourites-full, Q-mac-registered (D-035, D-037, D-056).
- **M4 · Browse** (2026-09-27): Maestro flows 5 and 6 (and 1, 7, 10) passed on the owner's phone;
  the 5,000-movie scrolling check in a debug build (D-064). Development builds cannot reach the
  production backend (D-061).
- **M5 · Playback** (2026-09-27): Maestro flows 2, 3 and 4 passed on the owner's phone, with the
  HLS, MPEG-TS and MP4 checks, PiP and background audio (D-073). Owner answer: Q-ffmpeg-audio (not
  in v1).

## What exists

- `index.ts`: the entry (polyfills, then expo-router).
- `app/` (routes, D-051): `_layout.tsx` (network setting, i18n, fonts, the RTL reload, the query
  client and bottom-sheet providers, then `src/navigation/AppStack.tsx` with the
  `Stack.Protected` guards, the PIN sheet, quick actions and the toast host); `index.tsx`
  (splash + boot); `(boot)/` terms, verify, welcome, expired, server-failed; `loading.tsx`
  (playlist load and switch); `(tabs)/` home, live, movies, series, my-list; `movie/[id]`,
  `series/[id]`, `category`, `search`, `settings/parental`; `account.tsx`; `playlists/`;
  `portals/`; `dev.tsx` (dev link, D-052); `gallery.tsx` (dev only).
- `src/session/` (M3): `device.ts` (V4 device flow), `account.ts` (routing after device info,
  R-030 replay), `playlistLoad.ts` (load, auto switch, errors), `playlists.ts` (add/delete),
  `store.ts` (zustand session), `networkMode.ts` + `network.ts` (D-050), `boot.ts` (wiring to
  MMKV, device id, SQLite, network mode; used by the screens).
- `src/components/`: the design-system components (design-system.md §5) plus the M3 ones
  (AppText, Button, TextField, Card, ListRow, Screen, Toast, CopyRow, Banner, LoadingView,
  ActivationCard, PlaylistRow, Logo, the dev switches).
- `src/config.ts`: generated from the kit's config.json (`npm run config:generate`).
- `src/api/` (M1): platform-free API layer: HTTP, errors, crypto, IBO, Xtream, M3U, Stalker,
  TMDB, image cache, fixtures (`__fixtures__/`) and the fixture transport.
- `src/db/` (M2): the `Db` interface, `expoDb.ts` (expo-sqlite), schema + migrations with FTS5,
  `queries/catalogue.ts`, `testing/testDb.ts` (better-sqlite3 for tests).
- `src/content/` (M2): `ContentSource` and the three sources, `sync.ts`, `catalogue.ts`
  (`login`, `CatalogueSession`), `rules/` (all 88 R-xxx).
- `src/storage/`: `keys.ts` (every TV key), `settings.ts` (TV defaults), `kv.ts` (MMKV).
- `src/platform/`: polyfills, device identity, clipboard (D-046), links, device model.
- `e2e/`: Maestro flows 1 to 10, the scrolling check (`perf/`) and shared steps.
- `src/browse/` (M4): Home rows, tab rows and category feeds, details, search, My List, Live
  selection, parental control; `guide.ts` (M5: the guide loader, catch-up, Replay). `src/hooks/`
  (React Query), `src/screens/` (shared screens, the guide and Replay).
- `src/player/` (M5): the platform-free playback services and their tests, the player store
  (`session.ts`), `usePlayback` (URL resolution + supervisor), the VOD, live and mini players and
  `controls/`. `src/navigation/useRouteOrientation.ts`: orientation per route.
  `plugins/withTsExtractorFlags.js`: the Media3 TS flags patch (D-066).
- `src/downloads/` (M7): the download manager and rules (platform-free, tested), the native
  adapter (background downloader, expo-file-system) and the app instance and hooks.
  `plugins/withInAppDownloader.js`: keeps downloads off Android's DownloadManager (D-078).
- Tests: 455 in 39 suites (`npm test`); Jest projects "app" and "core" (D-022, D-033; core also
  covers `src/session`, `src/browse`, `src/player` and `src/downloads`).
- `docs/decisions.md` (D-001 to D-086), `docs/parity.md` (TV → phone check), `docs/open-questions.md`, `docs/new-strings.md`.

## Running the app on the phone

- Dev server: `REACT_NATIVE_PACKAGER_HOSTNAME=<PC LAN IP> npx expo start --dev-client --host lan`.
  The PC is on Ethernet (192.168.1.101); its Wi-Fi IP is stale. Check the manifest's
  `launchAsset.url` host if the phone shows "Unable to load script". Stopping the server task
  can leave the Metro node process holding port 8081: stop that process too. A long-running
  Metro once wrote broken typed routes (`src/` files as routes) into `.expo/types/router.d.ts`;
  delete the file and restart Metro if `tsc` reports impossible `Href` errors.
- Over USB (Maestro): `adb reverse tcp:8081 tcp:8081`, then the flows open the app on
  `localhost:8081` themselves.
- The development build made at the start of M3 has `expo-application` and `expo-sqlite`. M5
  needs a new one (react-native-video and the player modules, D-065):
  `npx eas-cli@latest build --profile development --platform android`. Rebuild only after adding
  a native library or changing native config.
- Tools on this PC: JDK 17 (Temurin, JAVA_HOME), Platform-Tools at `C:\Android\platform-tools`,
  Maestro 2.10.0 at `%LOCALAPPDATA%\maestro\bin`; the phone (DNP NX9) is authorised for USB
  debugging.

## Blockers and later needs (owner)

- Later: a GitHub remote so CI runs, and the `EXPO_TOKEN` secret for tag builds.

## Next

- Retest the whole app on the phone (owner's request). Done on the preview build (2026-10-04): the
  Maestro suite (10/10), cold start and the 5,000-item scroll. Left: the manual checks of
  `docs/release-checklist.md` §2 (the owner's real playlists, kill-and-resume download, PiP,
  TalkBack, Arabic), search and play-to-first-frame timing (§3), then the M6 + M7 + M8 report.
- **Found in the retest (owner, 2026-10-04):** a download on mobile data sat at 0% with no
  explanation. Fixed (D-083): netinfo added, a dialog on mobile data, "Waiting for Wi-Fi" with Use
  mobile data. netinfo is native, so **a new development build and a new preview build** are
  needed; then check on the phone: Download on mobile data (both choices), Use mobile data on a
  waiting download, Wi-Fi only turned off releasing it, and flow 9 again.
- **Style A (owner, 2026-10-05, D-085):** the whole app restyled after the owner picked style A
  from a mockup page. On the new development build (2026-10-06) every Maestro flow passed, flows
  2, 3, 4, 6 and 7 after fixes: list sheet rows inset (style A cards), the guide retries its scroll
  to now after layout (it stopped short on a slow phone), and flows 4, 6, 7 updated (titles without
  the year; slow swipes in the catch-up sheet). A long single run of the debug build still slows
  down; the preview build needs one more EAS build, then the full suite in one run.
- The same rebuild carries the Expo patch releases and `expo-clipboard` (D-084); expo-doctor
  passes 21/21.

- **Release APK on the real backend (owner, 2026-10-06, D-086):** device ids start with RN; EAS
  profile `release`. The owner tests it against production by hand (the agent runs nothing
  there). Still to do: check the RN id on the dev backend once the phone is back on USB; the
  owner applies the website MAC check fix (left uncommitted in the dev backend copy) to production.

## How to verify

```bash
npm ci
npm run typecheck
npm run lint
npm test
npx expo-doctor
npx eas-cli@latest build --profile development --platform android   # cloud dev build (D-019)
npm start         # then open the dev build on the phone
maestro test e2e/ # phone on USB, see e2e/README.md
```
