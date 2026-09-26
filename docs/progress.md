# Progress

A new session must be able to continue from this file alone. Read `AGENTS.md` first.

## Current milestone: M1 · Fixtures and API clients. Code complete; waiting for the owner's review

| M1 item (04-build/roadmap.md)                                                                  | Status                                                                |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/api/http.ts` and the typed errors                                                         | done (`http.ts`, `errors.ts`, `log.ts` with URL redaction)            |
| IBO client: server selection, device identity, registration, playlists, every endpoint, crypto | done (`src/api/ibo/`, `src/api/crypto.ts`)                            |
| Xtream, M3U and Stalker clients                                                                | done (`src/api/xtream/`, `m3u/`, `stalker/`)                          |
| EPG and catch-up                                                                               | done (`src/utils/epgTime.ts`; per-source parsing in the clients)      |
| TMDB, image cache, analytics                                                                   | done (`src/api/tmdb.ts`, `imageCache.ts`, `analytics.ts`)             |
| Fixtures + MSW + the "use fixtures" dev toggle                                                 | done (`src/api/__fixtures__/`, `fixtureTransport.ts`, switch on Home) |
| **Accept:** unit tests cover every endpoint against the fixtures                               | passing                                                               |
| **Accept:** crypto test vectors pass                                                           | passing (`src/api/__tests__/crypto.test.ts`)                          |
| **Accept:** M3U parser handles 20,000 entries in < 3 s under Jest                              | passing (~0.14 s)                                                     |

## M0 · Project skeleton: accepted 2026-09-26

- Accepted by the owner on their phone (EAS development build, D-019): the splash, the five
  tabs, and the English ⇄ Arabic switch. Not reported: persistence after a restart and the
  large-font check; nothing blocking.
- The owner then narrowed the languages to English and Arabic (D-020).

## What exists

- `index.ts`: the entry (polyfills, then expo-router). `app/_layout.tsx`: applies the fixture
  setting, i18n, fonts, the RTL reload, then the stack. `app/(tabs)/`: placeholder tabs; Home has
  dev-only language and "use fixtures" switches.
- `src/config.ts`: generated from the kit's config.json (`npm run config:generate`); a test
  checks it still matches.
- `src/api/`: platform-free API layer (no React Native imports), tested in Node with MSW.
  - `http.ts` (swappable transport), `errors.ts`, `crypto.ts`, `random.ts`, `parse.ts`,
    `store.ts` (the injected key-value store interface).
  - `ibo/`: `servers.ts` (agent, domain cache, fallback, panel URLs), `panel.ts` (V4 failover,
    decoding, auth-failure detection), `client.ts` (every endpoint), `links.ts`, `playlists.ts`,
    `identity.ts` (device id derivation).
  - `xtream/`, `m3u/`, `stalker/` clients; `tmdb.ts`, `imageCache.ts`, `analytics.ts`.
  - `__fixtures__/`: fixture servers (IBO agent + panel, Xtream + a 20,000-channel host, M3U
    variants + 20,000 entries, Stalker portal, TMDB, image cache, analytics), the scenario
    switches, MSW handlers and the Jest server.
  - `fixtureTransport.ts` / `fixtureMode.ts`: the in-app "use fixtures" mode (on by default in
    dev and preview; compiled out of production).
- `src/platform/`: `polyfills.ts` (crypto.getRandomValues), `deviceIdentity.ts` (not used until
  M3; needs `expo-application` in the development build).
- `src/session/fixtures.ts`: the persisted fixture setting.
- `src/utils/epgTime.ts`: EPG time parsing, now/next, catch-up grouping, guide normalisation.
- Theme, i18n (English + Arabic), storage, components from M0.
- Tests: 154 in 16 suites (`npm test`); two Jest projects (app, api), decisions D-022.
- `docs/decisions.md` (D-001 to D-031), `docs/open-questions.md`, `docs/new-strings.md`.

## Running the app on the phone

- Dev server: `REACT_NATIVE_PACKAGER_HOSTNAME=<PC LAN IP> npx expo start --dev-client --host lan`.
  The PC is on Ethernet (192.168.1.101); its Wi-Fi IP is stale. Check the manifest's
  `launchAsset.url` host if the phone shows "Unable to load script". Stopping the server task
  can leave the Metro node process holding port 8081: stop that process too.
- Rebuild the development client (`npx eas-cli@latest build --profile development --platform
android`) only after adding a native library or changing native config. **Needed at the start
  of M3** (`expo-application`, D-021).

## Blockers and later needs (owner)

- Confirm the device id case with the backend (D-024), and Q-app-type, before going live.
- Before M3: JDK 17 and Android SDK Platform-Tools, for Maestro over USB.
- Later: a GitHub remote so CI runs, and the `EXPO_TOKEN` secret for tag builds.

## Next

- Owner review of M1, then M2 · Content layer and storage: read 01-product/business-rules.md and
  02-backend/data-models.md fully first.

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
