# Progress

A new session must be able to continue from this file alone. Read `AGENTS.md` first.

## Current milestone: M4 · Browse. Built and tested on the PC; the phone run is next

| M4 item (04-build/roadmap.md)                                                  | Status                                                                                                                  |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| The design-system components (§5) with their states                            | done (`src/components/`, dev gallery `app/gallery.tsx`); `EpgTimeline` comes with the EPG guide in M5                   |
| Home (N-01), Movies, Series, Live (the list), Movie and Series details, Search | done (`app/(tabs)/`, `app/movie/[id].tsx`, `app/series/[id].tsx`, `app/category.tsx`, `app/search.tsx`)                 |
| My List (favourites and continue watching)                                     | done (`app/(tabs)/my-list.tsx`; Downloads is M7)                                                                        |
| Parental control: the PIN pad, locked categories, changing the PIN             | done (`src/components/PinPrompt.tsx`, `app/settings/parental.tsx`)                                                      |
| **Accept:** Maestro flows 5 and 6; a 5,000-item category scrolls smoothly      | flows written and syntax-checked (`e2e/flow-05-parental.yaml`, `flow-06-search.yaml`, `perf/`); **to run on the phone** |

The browse services are in `src/browse/` (platform-free, tested in the core Jest project), the
React Query hooks in `src/hooks/`. Owner rule applied in M4: development builds cannot reach the
production backend (D-061). Decisions D-057 to D-063.

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
  TMDB, image cache, analytics, fixtures (`__fixtures__/`) and the fixture transport.
- `src/db/` (M2): the `Db` interface, `expoDb.ts` (expo-sqlite), schema + migrations with FTS5,
  `queries/catalogue.ts`, `testing/testDb.ts` (better-sqlite3 for tests).
- `src/content/` (M2): `ContentSource` and the three sources, `sync.ts`, `catalogue.ts`
  (`login`, `CatalogueSession`), `rules/` (all 88 R-xxx).
- `src/storage/`: `keys.ts` (every TV key), `settings.ts` (TV defaults), `kv.ts` (MMKV).
- `src/platform/`: polyfills, device identity, clipboard (D-046), links, device model.
- `e2e/`: Maestro flows 1, 5, 6, 7, 10, the scrolling check (`perf/`) and shared steps.
- `src/browse/` (M4): Home rows, tab rows and category feeds, details, search, My List, Live
  selection, parental control. `src/hooks/` (React Query), `src/screens/` (shared screens).
- Tests: 357 in 31 suites (`npm test`); Jest projects "app" and "core" (D-022, D-033; core also
  covers `src/session` and `src/browse`).
- `docs/decisions.md` (D-001 to D-063), `docs/open-questions.md`, `docs/new-strings.md`.

## Running the app on the phone

- Dev server: `REACT_NATIVE_PACKAGER_HOSTNAME=<PC LAN IP> npx expo start --dev-client --host lan`.
  The PC is on Ethernet (192.168.1.101); its Wi-Fi IP is stale. Check the manifest's
  `launchAsset.url` host if the phone shows "Unable to load script". Stopping the server task
  can leave the Metro node process holding port 8081: stop that process too. A long-running
  Metro once wrote broken typed routes (`src/` files as routes) into `.expo/types/router.d.ts`;
  delete the file and restart Metro if `tsc` reports impossible `Href` errors.
- Over USB (Maestro): `adb reverse tcp:8081 tcp:8081`, then the flows open the app on
  `localhost:8081` themselves.
- The development build made at the start of M3 has `expo-application` and `expo-sqlite`.
  Rebuild (`npx eas-cli@latest build --profile development --platform android`) only after adding
  a native library or changing native config; the next one is expected in M5.
- Tools on this PC: JDK 17 (Temurin, JAVA_HOME), Platform-Tools at `C:\Android\platform-tools`,
  Maestro 2.10.0 at `%LOCALAPPDATA%\maestro\bin`; the phone (DNP NX9) is authorised for USB
  debugging.

## Blockers and later needs (owner)

- Later: a GitHub remote so CI runs, and the `EXPO_TOKEN` secret for tag builds.

## Next

- Run the M4 flows on the phone (`maestro test e2e/`, then the scrolling check in
  e2e/README.md), fix what they find, then the M4 report and the owner's go-ahead.
- Then M5 · Playback: react-native-video (a new development build), the VOD and live players,
  the EPG guide, PiP and background audio. Read 01-product/player.md.

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
