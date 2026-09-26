# Progress

A new session must be able to continue from this file alone. Read `AGENTS.md` first.

## Current milestone: M2 · Content layer and storage. Code complete; waiting for the owner's review

| M2 item (04-build/roadmap.md)                                              | Status                                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| SQLite schema and FTS5                                                     | done (`src/db/`: schema, migrations, FTS5 kept in sync by triggers)       |
| The `ContentSource` interface and its three implementations                | done (`src/content/XtreamSource.ts`, `M3uSource.ts`, `StalkerSource.ts`)  |
| Sync with progress, including load on demand                               | done (`src/content/sync.ts`, `catalogue.ts` `CatalogueSession`)           |
| MMKV key-value storage with the TV key names                               | done (`src/storage/keys.ts`, `settings.ts`; MMKV wrapper `kv.ts`)         |
| Business rules module, one test per R-xxx                                  | done (`src/content/rules/`; a test checks every R-xxx in the kit has one) |
| **Accept:** a fixture playlist of each type syncs into SQLite              | passing (`src/content/__tests__/catalogue.test.ts`)                       |
| **Accept:** category pages, lookups by id and search return the right data | passing (same file; search < 300 ms on 20,000 channels)                   |
| **Accept:** every R-xxx test passes                                        | passing (88 rules)                                                        |

Owner answers so far: the backend accepts `android` (Q-app-type) and ignores device id case (D-024).

## Dev IBO backend (from the owner)

- Hosted: `https://iboplayer-backend.youssef-dev.online/` (panel base `…/api`; routes
  `/api/<app_type>/v4/...`, `android` allowed). Source: `d:\dev\Backend\iboplayer-backend`
  (Express; `routes/api.js`, `controllers/`). Do not read its `.env` (secrets).
- Use it from M3 as a "dev backend" network mode: IBO calls go only to it, skipping the real agent
  servers. Its source is the reference for real response shapes (Q-response-shapes).

## Accepted milestones

- **M0 · Project skeleton** (2026-09-26): accepted on the owner's phone (EAS development build,
  D-019). Languages then narrowed to English and Arabic (D-020).
- **M1 · Fixtures and API clients** (2026-09-26): every endpoint tested against fixtures, crypto
  vectors, M3U 20,000 entries in ~0.14 s.

## What exists

- `index.ts`: the entry (polyfills, then expo-router). `app/_layout.tsx`: applies the fixture
  setting, i18n, fonts, the RTL reload, then the stack. `app/(tabs)/`: placeholder tabs; Home has
  dev-only language and "use fixtures" switches.
- `src/config.ts`: generated from the kit's config.json (`npm run config:generate`).
- `src/api/` (M1): platform-free API layer: HTTP, errors, crypto, IBO, Xtream, M3U, Stalker,
  TMDB, image cache, analytics, fixtures (`__fixtures__/`) and the "use fixtures" transport.
- `src/db/` (M2): `database.ts` (the `Db` interface), `expoDb.ts` (expo-sqlite, first used in
  M3), `schema.ts` + `migrations/` (categories, items, `items_fts`, sync_state),
  `queries/catalogue.ts` (categories with counts, pages with R-090 sorts, by id, by ids, FTS
  search, recently added, top-rated candidates), `testing/testDb.ts` (better-sqlite3 for tests).
- `src/content/` (M2):
  - `types.ts`, `ContentSource.ts` (D-034), the three sources.
  - `sync.ts`: `writeCatalogue` (batched, one transaction, progress; Uncategorized only when
    needed), `writeCategories` + `cachePage` (Stalker), `forgetPlaylist`.
  - `catalogue.ts`: `createSource`, `login` (R-023/R-024/R-025/R-026, fix #8), `CatalogueSession`
    (R-050 per-section loading, `loadAll`, `refresh` (R-052), Stalker 5-page batches).
  - `rules/`: `startup` (A), `playlists` (B–D), `content` (E), `parental` (F), `library` (G),
    `customCategories` (H), `sports` (R-100/101), `live` (I), `app` (J–M).
- `src/storage/`: `keys.ts` (every TV key), `settings.ts` (TV defaults), `kv.ts` (MMKV,
  `kvStore` implements the injected `KeyValueStore` incl. `keys()`).
- `src/platform/`: `polyfills.ts`, `deviceIdentity.ts` (M3).
- Tests: 257 in 24 suites (`npm test`); Jest projects "app" and "core" (D-022, D-033).
- `docs/decisions.md` (D-001 to D-045), `docs/open-questions.md`, `docs/new-strings.md`.

## Running the app on the phone

- Dev server: `REACT_NATIVE_PACKAGER_HOSTNAME=<PC LAN IP> npx expo start --dev-client --host lan`.
  The PC is on Ethernet (192.168.1.101); its Wi-Fi IP is stale. Check the manifest's
  `launchAsset.url` host if the phone shows "Unable to load script". Stopping the server task
  can leave the Metro node process holding port 8081: stop that process too.
- Rebuild the development client (`npx eas-cli@latest build --profile development --platform
android`) only after adding a native library or changing native config. **Needed at the start
  of M3** (`expo-application` D-021, `expo-sqlite` D-032).

## Blockers and later needs (owner)

- (answered 2026-09-26) Q-offline-expired: an expired cached date blocks offline (D-035); Q-favourites-full: refuse (D-037).
- (done 2026-09-26) JDK 17 (Temurin, JAVA_HOME), Platform-Tools at `C:\Android\platform-tools`, Maestro 2.10.0 at `%LOCALAPPDATA%\maestro\bin`; the phone is authorised for USB debugging.
- Later: a GitHub remote so CI runs, and the `EXPO_TOKEN` secret for tag builds.

## Next

- Owner review of M2, then M3 · Boot, activation and playlists: rebuild the development client
  first; read 01-product/user-flows.md (first launch), current-app-inventory.md (boot, playlists,
  portals, account screens), 03-design/screens.md, and 04-build/testing.md §4 flows 1, 7, 10.
  Add the "dev backend" network mode.

## How to verify

```bash
npm ci
npm run typecheck
npm run lint
npm test
npx expo-doctor
npx eas-cli@latest build --profile development --platform android   # cloud dev build (D-019)
npm start         # then open the dev build on the phone
```
