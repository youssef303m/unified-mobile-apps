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
