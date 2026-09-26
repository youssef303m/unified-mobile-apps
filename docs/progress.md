# Progress

A new session must be able to continue from this file alone. Read `AGENTS.md` first.

## Current milestone: M3 · Boot, activation and playlists. Done; waiting for the owner's review

| M3 item (04-build/roadmap.md)                                                             | Status                                                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Splash → terms → registration → account-state routing → Activation → playlist load → Home | done (`app/index.tsx`, `app/(boot)/`, `app/loading.tsx`; the flows in `src/session/`) |
| The Playlists and Portals screens, switching playlists, and the Account screen            | done (`app/playlists/`, `app/portals/`, `app/account.tsx`)                            |
| **Accept:** Maestro flows 1, 7 and 10                                                     | **passing on the phone** (2026-09-26, `maestro test e2e/`: 3/3 in 4 min)              |

Also done in M3: the client fixes found in the dev backend's source (D-047 to D-049), the network
mode with the owner's dev backend (D-050), the route guard (D-051), and the dev link for the e2e
flows (D-052). Owner answers applied: Q-offline-expired (an expired cached licence blocks
offline, D-035) and Q-favourites-full (refuse, D-037).

The phone run found a native crash on the first catalogue write (expo-sqlite + FTS5, fixed in
D-055). Owner answers after the run: Q-mac-registered (Welcome for a new device on its trial,
D-056) and Q-rate-limit.

## Dev IBO backend (from the owner)

- Hosted: `https://iboplayer-backend.youssef-dev.online/` (panel base `…/api`; routes
  `/api/<app_type>/v4/...`, `android` allowed). Source: `d:\dev\Backend\iboplayer-backend`
  (Express; `routes/api.js`, `controllers/ApiController.js`). Do not read its `.env` (secrets).
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

## What exists

- `index.ts`: the entry (polyfills, then expo-router).
- `app/` (routes, D-051): `_layout.tsx` (network setting, i18n, fonts, the RTL reload, then
  `src/navigation/AppStack.tsx` with the `Stack.Protected` guards, and the toast host);
  `index.tsx` (splash + boot); `(boot)/` terms, verify, welcome, expired, server-failed;
  `loading.tsx` (playlist load and switch); `(tabs)/` with `home.tsx` (placeholder: playlist chip,
  account avatar, first live categories, dev switches) and placeholder tabs; `account.tsx`;
  `playlists/` (list, add); `portals/` (list, add); `dev.tsx` (dev link, D-052).
- `src/session/` (M3): `device.ts` (V4 device flow), `account.ts` (routing after device info,
  R-030 replay), `playlistLoad.ts` (load, auto switch, errors), `playlists.ts` (add/delete),
  `store.ts` (zustand session), `networkMode.ts` + `network.ts` (D-050), `boot.ts` (wiring to
  MMKV, device id, SQLite, network mode; used by the screens).
- `src/components/`: AppText, Button, TextField, Card, ListRow, Screen, Toast, CopyRow, Banner,
  LoadingView, ActivationCard, PlaylistRow, Logo, DevLanguageSwitch, DevNetworkSwitch,
  PlaceholderScreen (early versions, D-053).
- `src/config.ts`: generated from the kit's config.json (`npm run config:generate`).
- `src/api/` (M1): platform-free API layer: HTTP, errors, crypto, IBO, Xtream, M3U, Stalker,
  TMDB, image cache, analytics, fixtures (`__fixtures__/`) and the fixture transport.
- `src/db/` (M2): the `Db` interface, `expoDb.ts` (expo-sqlite), schema + migrations with FTS5,
  `queries/catalogue.ts`, `testing/testDb.ts` (better-sqlite3 for tests).
- `src/content/` (M2): `ContentSource` and the three sources, `sync.ts`, `catalogue.ts`
  (`login`, `CatalogueSession`), `rules/` (all 88 R-xxx).
- `src/storage/`: `keys.ts` (every TV key), `settings.ts` (TV defaults), `kv.ts` (MMKV).
- `src/platform/`: polyfills, device identity, clipboard (D-046), links, device model.
- `e2e/`: Maestro flows 1, 7, 10 and shared steps.
- Tests: 305 in 28 suites (`npm test`); Jest projects "app" and "core" (D-022, D-033; core now
  also covers `src/session`).
- `docs/decisions.md` (D-001 to D-056), `docs/open-questions.md`, `docs/new-strings.md`.

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

- The owner's review of M3 and the go-ahead for M4.
- Then M4 · Browse: the design-system components with their states and the gallery; Home rows
  (N-01), Movies, Series, Live list, details pages, Search, My List, parental PIN. Read
  03-design/design-system.md §5, screens.md, user-flows.md §4-13, new-features.md N-01.

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
