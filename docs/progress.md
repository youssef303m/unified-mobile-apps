# Progress

A new session must be able to continue from this file alone. Read `AGENTS.md` first.

## Current milestone: M0 · Project skeleton. Code complete; one acceptance check blocked

| M0 item (04-build/roadmap.md)                                        | Status                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Expo app, TypeScript strict, expo-router, dev client                 | done (SDK 57)                                                         |
| ESLint + Prettier, Jest (jest-expo + RNTL), CI workflow              | done                                                                  |
| Folder layout from architecture.md, with empty modules               | done (`src/*/index.ts` placeholders)                                  |
| Theme tokens and typography (design-system.md §1-3)                  | done (`src/theme/`)                                                   |
| Fonts loaded (Inter, Noto Sans Arabic, Noto Sans Devanagari)         | done (runtime, during splash)                                         |
| Icon and splash configured (assets/README.md)                        | done (`app.config.ts`; verified in a trial prebuild)                  |
| i18n with the 18 locales and RTL switching                           | done (`src/i18n/`)                                                    |
| **Accept:** splash → placeholder tab bar, EN + AR (RTL), on a device | **waiting**: EAS development build on the owner's phone (D-019)       |
| **Accept:** CI passes on a clean checkout                            | verified locally with `npm ci` in a fresh clone; no GitHub remote yet |

## What exists

- `app/_layout.tsx`: keeps the native splash up until i18n and fonts are ready, reloads once if
  the layout direction must change, then renders the stack.
- `app/(tabs)/`: the placeholder tab bar (Home, Live TV, Movies, Series, My List) with placeholder
  screens. Home has a dev-only English/Arabic switch.
- `src/theme/`: colours, spacing, radius, elevation, artwork sizes, motion, typography, font map.
- `src/i18n/`: 18 locale files (copied from the kit; `en.json` has the `mobile_*` keys), language
  resolution, typed `t()` keys, and `changeLanguage` with the RTL reload.
- `src/storage/`: encrypted MMKV (`kv.ts`) with the TV prefix `gz3rYzUIC7_`; secure-store key
  (`secure.ts`).
- `src/components/`: `AppText` (the text primitive), `PlaceholderScreen`, `DevLanguageSwitch`.
- Tests: 27 tests in 7 suites (languages, locale files, direction, i18n, kv, theme, tab bar).
- `eas.json` (development / preview / production), `.github/workflows/ci.yml`.
- `docs/decisions.md` (D-001 to D-018), `docs/open-questions.md`, `docs/new-strings.md`.

## Blockers (need the owner)

The owner chose cloud builds (decisions D-019): no Android Studio, SDK or emulator.

1. The owner creates a free account at expo.dev and runs `npx eas-cli@latest login` in the
   project terminal.
2. Then: `npx eas-cli@latest init` (links the project; add the printed `extra.eas.projectId` to
   `app.config.ts`), then the owner runs the first
   `npx eas-cli@latest build --profile development --platform android` interactively, because
   generating the Android keystore needs a prompt.
3. The owner installs the resulting APK on their phone (from the build page link or QR).
4. Before M3: JDK 17 and Android SDK Platform-Tools, for Maestro over USB.
5. Later: a GitHub remote so CI runs, and the `EXPO_TOKEN` secret for tag builds.

## Next

1. After the phone has the development build: `npm start` (expo start --dev-client), open the
   project on the phone, and check the splash, the tab bar, and the dev switch to Arabic (RTL,
   mirrored tab order) and back. Then mark M0 accepted.
2. M1 · Fixtures and API clients: read 02-backend/* fully and 04-build/testing.md §1 first.
   Wait for the owner's go-ahead before starting.

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
