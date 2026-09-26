# Progress

A new session must be able to continue from this file alone. Read `AGENTS.md` first.

## Current milestone: M1 · Fixtures and API clients (in progress)

## M0 · Project skeleton: accepted 2026-09-26

- Accepted by the owner on their phone (EAS development build, D-019): the splash, the five
  tabs, and the English ⇄ Arabic switch (reload, language changes). Not reported: persistence
  after a restart and the large-font check; nothing blocking.
- The owner then narrowed the languages to English and Arabic (D-020).

## What exists

- `app/_layout.tsx`: keeps the native splash up until i18n and fonts are ready, reloads once if
  the layout direction must change, then renders the stack.
- `app/(tabs)/`: the placeholder tab bar (Home, Live TV, Movies, Series, My List) with placeholder
  screens. Home has a dev-only English/Arabic switch.
- `src/theme/`: colours, spacing, radius, elevation, artwork sizes, motion, typography, font map.
- `src/i18n/`: the English and Arabic locale files (copied from the kit; `en.json` has the `mobile_*` keys), language
  resolution, typed `t()` keys, and `changeLanguage` with the RTL reload.
- `src/storage/`: encrypted MMKV (`kv.ts`) with the TV prefix `gz3rYzUIC7_`; secure-store key
  (`secure.ts`).
- `src/components/`: `AppText` (the text primitive), `PlaceholderScreen`, `DevLanguageSwitch`.
- Tests: 27 tests in 7 suites (languages, locale files, direction, i18n, kv, theme, tab bar).
- `eas.json` (development / preview / production), `.github/workflows/ci.yml`.
- `docs/decisions.md` (D-001 to D-018), `docs/open-questions.md`, `docs/new-strings.md`.

## Running the app on the phone

- Dev server: `REACT_NATIVE_PACKAGER_HOSTNAME=<PC LAN IP> npx expo start --dev-client --host lan`.
  The PC is on Ethernet (192.168.1.101); its Wi-Fi IP is stale. Check the manifest's
  `launchAsset.url` host if the phone shows "Unable to load script".
- Rebuild the development client (`npx eas-cli@latest build --profile development --platform
android`) only after adding a native library or changing native config.

## Blockers and later needs (owner)

- Before M3: JDK 17 and Android SDK Platform-Tools, for Maestro over USB.
- Later: a GitHub remote so CI runs, and the `EXPO_TOKEN` secret for tag builds.

## Next

- M1 · Fixtures and API clients (04-build/roadmap.md), then stop and report.

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
