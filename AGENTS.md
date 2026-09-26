# IBO Player (Android) — agent notes

This is the React Native (Expo) phone app built from the spec in `iboplayer-mobile-kit/`.

## Start here

1. `docs/progress.md`: the current milestone, what is done, what is next, blockers.
2. `iboplayer-mobile-kit/AGENTS.md`: the working rules, reading order and definition of done.
   The kit is the only source of truth, and it is **read-only**: copy from it, never edit it.
3. `docs/decisions.md` (deviations and choices), `docs/open-questions.md`, `docs/new-strings.md`.

## Expo has changed — do not trust your training data

This project is on Expo SDK 57 (React Native 0.86, React 19.2, TypeScript 6). Before using an
Expo, EAS or React Native API, check the installed package's types or the versioned docs at
`https://docs.expo.dev/versions/v57.0.0/`. The same applies to every other library: read its
`.d.ts` in `node_modules` first.

## Commands

```bash
npx expo install <package>  # always, instead of npm install, for SDK-compatible versions; then pin exactly
npm run typecheck           # tsc --noEmit
npm run lint                # eslint, zero warnings
npm test                    # jest (jest-expo)
npx expo-doctor             # dependency and config diagnostics
npm run android             # expo run:android (needs JDK 17 + Android SDK)
```

Type check, lint and tests must be green before a task is done.

## Layout

- Routes live in **`app/`** at the repository root (04-build/architecture.md), not `src/app/`.
  Never put non-route files (tests, helpers) under `app/`.
- Everything else lives in `src/` (import it as `@/…`).
- `android/` and `ios/` are generated (Continuous Native Generation) and not committed. Configure
  native behaviour in `app.config.ts` and config plugins.
- Colours, sizes and fonts come from `src/theme/`; strings from `src/i18n/locales/`.
