# Progress

A new session must be able to continue from this file alone. Read `AGENTS.md` first.

## Current milestone: M0 · Project skeleton. Code complete; one acceptance check blocked

| M0 item (04-build/roadmap.md)                                                        | Status                                                                |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Expo app, TypeScript strict, expo-router, dev client                                 | done (SDK 57)                                                         |
| ESLint + Prettier, Jest (jest-expo + RNTL), CI workflow                              | done                                                                  |
| Folder layout from architecture.md, with empty modules                               | done (`src/*/index.ts` placeholders)                                  |
| Theme tokens and typography (design-system.md §1-3)                                  | done (`src/theme/`)                                                   |
| Fonts loaded (Inter, Noto Sans Arabic, Noto Sans Devanagari)                         | done (runtime, during splash)                                         |
| Icon and splash configured (assets/README.md)                                        | done (`app.config.ts`; verified in a trial prebuild)                  |
| i18n with the 18 locales and RTL switching                                           | done (`src/i18n/`)                                                    |
| **Accept:** `npx expo run:android` shows splash → placeholder tab bar, EN + AR (RTL) | **blocked**: no JDK 17, Android SDK or emulator on this machine       |
| **Accept:** CI passes on a clean checkout                                            | verified locally with `npm ci` in a fresh clone; no GitHub remote yet |

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

1. **Install JDK 17 and the Android SDK, and set up an emulator or a USB-debugging device.**
   Without them, `npx expo run:android` can't build. Instructions are in the M0 report; in short:
   - JDK 17: `winget install Microsoft.OpenJDK.17`, then set `JAVA_HOME` to its folder
     (e.g. `C:\Program Files\Microsoft\jdk-17…`) and put `%JAVA_HOME%\bin` before the Java 8
     entry in `Path`.
   - Android Studio (`winget install Google.AndroidStudio`) → SDK Manager: Android SDK Platform
     36, Build-Tools 36, Platform-Tools, Emulator, and a system image. Set `ANDROID_HOME` to
     `%LOCALAPPDATA%\Android\Sdk` and add `%ANDROID_HOME%\platform-tools` and
     `%ANDROID_HOME%\emulator` to `Path`. Create an AVD (e.g. Pixel, API 34/35).
2. A GitHub remote, so CI runs, and the `EXPO_TOKEN` secret for tag builds (later).

## Next

1. When the tools are installed: `npm run android`, then check the splash, the tab bar, and the
   dev switch to Arabic (RTL, mirrored tab order) and back. Then mark M0 accepted.
2. M1 · Fixtures and API clients: read 02-backend/* fully and 04-build/testing.md §1 first.
   Wait for the owner's go-ahead before starting.

## How to verify

```bash
npm ci
npm run typecheck
npm run lint
npm test
npx expo-doctor
npm run android   # needs JDK 17 + Android SDK + emulator/device
```
