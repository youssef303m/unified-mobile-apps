# Flavors plan: one codebase, many branded apps

Status: **plan, not started** (2026-10-24, branch `unified-codebase`).
Work through the phases in order. Each phase ends with a **stop and report**: tick its boxes, note
anything that changed in `docs/decisions.md`, and wait for the go-ahead before the next phase.

## Goal

1. **One command creates a new app (flavor).**
2. **One folder holds everything an app owns**: name, ids, version, logos, icons, splash, colours,
   website, backend values, optional features, signing.
3. **Every run and build command asks which app** (or takes `--flavor <key>`), and the result only
   contains that app.

The rest of the codebase is shared and never names an app.

## What we take from the Flutter app (`d:\dev\flutter\ibo_plus`) and what we do better

| Flutter (`ibo_plus`)                                                        | Here                                                                                                                                                        |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/flavors/<key>/app.json` as the single source of truth, JSON Schema     | **Keep.** `flavors/<key>/flavor.json` + `flavors/flavor.schema.json`                                                                                        |
| `flavorKey` naming (`^[a-z][a-z0-9]*$`), same keys (`ibo`, `c7`)            | **Keep**, with the same keys so both codebases talk about the same apps                                                                                     |
| Palette in a Dart class per app (`<key>_palette.dart`), no defaults         | **Simpler:** colours live in `flavor.json` (native config needs them too); the schema makes every brand colour required, so no app silently inherits one    |
| `apply_flavors.dart` generates Gradle flavors, Xcode schemes, CMake, `.iss` | **Not needed.** Expo CNG: `app.config.ts` reads the chosen flavor and `expo prebuild` writes `android/` for it. Almost nothing is generated or committed    |
| Release staging worktree to keep other apps' assets out of the build        | **Not needed.** Metro resolves `@flavor/*` to the chosen app's folder only, so other apps' files are never bundled. A post-build check still proves it      |
| CMake cache keeps the previous app's identity (gotcha)                      | Avoided by design: the build script records the flavor in `android/.flavor` and runs a clean prebuild when it changes; Metro's cache is keyed by the flavor |
| `create_flavor` (interactive + `--no-input`), `remove_flavor --dry-run`     | **Keep**, as `npm run flavor:new` / `flavor:remove`                                                                                                         |
| `check_placeholders`: release refuses images copied from another app        | **Keep**, inside `flavor:check`                                                                                                                             |
| `last-released.json` + downgrade protection                                 | **Keep**                                                                                                                                                    |
| `flavor_boundary_test`: shared code never imports an app or branches on it  | **Keep**, as a Jest test; plus a test that no app's name is hard-coded in shared code or strings                                                            |
| `features` list in `app.json`                                               | **Keep**, but start small: only features a second app actually turns off (YAGNI)                                                                            |
| Page variations, override builders                                          | **Later, only if a brand needs a different design.** Not in the first version                                                                               |
| PowerShell scripts (`dev.ps1`, `build.ps1`, `release.ps1`)                  | Node scripts (`scripts/*.mjs`) behind `npm run …`: same on Windows, CI and EAS, and testable with Jest                                                      |

## Target shape

```
flavors/
├── flavor.schema.json            # schema of every flavor.json (editor autocomplete + validation)
├── ibo/
│   ├── flavor.json               # ★ everything about the app (see below)
│   ├── last-released.json        # written by the release command; committed
│   ├── assets/                   # bundled into the app
│   │   ├── icon.png              # 1024×1024 launcher icon
│   │   ├── adaptive-icon.png     # 1024×1024 adaptive foreground
│   │   ├── splash-logo.png       # splash and loading screen
│   │   ├── logo.png              # Logo component (dark background)
│   │   ├── logo-wide.png         # Logo component, wide variant
│   │   └── poster-fallback.png   # artwork placeholder
│   └── store/                    # Play Store listing only, never bundled
│       ├── play-store-icon-512.png
│       └── feature-graphic-1024x500.png
└── c7/ …
credentials/<key>/                # git-ignored: credentials.json + keystore.jks per app
src/flavor/                       # the ONLY shared code that touches the chosen flavor
├── index.ts                      # typed `flavor` object + asset requires via @flavor/*
└── types.ts                      # Flavor type (matches the schema)
scripts/flavor/                   # new.mjs, remove.mjs, check.mjs, run.mjs, build.mjs, lib/…
```

Sketch of `flavors/ibo/flavor.json` (fields are settled in Phase 0 and 1):

```jsonc
{
  "$schema": "../flavor.schema.json",
  "key": "ibo",
  "displayName": "IBO Player", // launcher label, About, strings ({{appName}})
  "brandName": "IBOPlayer", // legal / footer text
  "slug": "iboplayer-mobile",
  "scheme": "iboplayer",
  "androidPackage": "com.iboplayer.mobile",
  "version": "1.0.0",
  "versionCode": 1,
  "websiteUrl": "https://iboplayer.com",
  "eas": { "owner": "youssef303m", "projectId": "857544d9-…" },
  "colors": {
    "background": "#000000",
    "adaptiveIconBackground": "#FFFFFF",
    "brand": {
      "primary": "#BF242E",
      "primaryPressed": "#950606",
      "deep": "#690101",
      "accent": "#C0392B",
      "light": "#FF8484",
      "logoGrey": "#323232",
      "vivid": "#E5303A",
      "glow": "rgba(229,48,58,0.55)",
    },
  },
  "backend": {/* the per-brand values from Phase 0, step 0.2 */},
  "features": [],
}
```

How the chosen app flows through:

```
APP_FLAVOR=<key>  (set by the run/build command after you pick the app)
   ├─► app.config.ts      reads flavors/<key>/flavor.json → name, package, icons, splash, colours, EAS ids
   ├─► metro.config.js    @flavor/* → flavors/<key>/*  (cache keyed by <key>)
   ├─► eas.json           <key>-development / <key>-preview / <key>-release / <key>-production profiles
   └─► credentials/<key>/ local release signing
```

Shared code reads only `import { flavor, flavorAssets } from "@/flavor"`.

---

## Phase 0 · Decisions and spikes (no app code changes)

- [ ] **0.1 Kit rule.** The kit (`iboplayer-mobile-kit/`) is IBO's spec and read-only. Record a
      decision (next free D-number) that brand values move out of the kit-generated config into
      flavors, and that `ibo` reproduces today's app exactly.
- [ ] **0.2 Per-brand values (owner).** Go through `src/config.ts` and mark each key shared or
      per-brand. Candidates: `app.id`, `brandName`, `brandShort`, `websiteUrl`, `storagePrefix`,
      `mobileAppType`, the IBO backend lists (`agentUrls`, `fallbackDomains`, `staticPanelUrls`,
      `mainDomain`), `stararcs.appName`, `imageCache`, `crypto.qrAesPassphrase`, TMDB, weather,
      subtitles. Does another brand use the same IBO backend with a different app type, or its
      own servers? Does the device id keep the `RN` prefix for every brand (D-086)?
- [ ] **0.3 Brand strings.** List every string that names the app (`en.json`: `playlists_footer_a`,
      `terms_welcome`, `mobile_playlist_error_*`, …; `ar.json` has the same). Plan: replace the
      name with `{{appName}}` through i18next default variables.
- [ ] **0.4 First second app.** Which brand is built after IBO (likely `c7`, as in Flutter), and
      its package id, name, website, colours and images. This is the acceptance test in Phase 9.
- [ ] **0.5 EAS.** One EAS project per app (its own `slug`/`projectId`) or not? Recommended: one
      per app, since the package, credentials and remote build numbers are per app.
- [ ] **0.6 Versioning.** Today `appVersionSource` is `remote` (EAS counts `versionCode`). Local
      Gradle builds (D-087) do not use it. Recommended: `local`, with `version` and `versionCode`
      in `flavor.json` and downgrade protection from `last-released.json`, as in Flutter.
- [ ] **0.7 Spike: Metro alias.** Prove on Expo SDK 57 (check the installed Metro types, not memory)
      that a `metro.config.js` resolver maps `@flavor/*` to `flavors/$APP_FLAVOR/*`, that
      `require("@flavor/assets/logo.png")` bundles as an image asset, that `cacheVersion` (or the
      SDK 57 equivalent) invalidates the cache when the flavor changes, and that only the chosen
      app's images end up in the APK.
- [ ] **0.8 Spike: EAS env.** Confirm in the v57 EAS docs how a cloud build gets `APP_FLAVOR`
      (profile `env` with `extends`, or EAS environment variables) and that `app.config.ts` sees
      it both locally and on the build worker.

**Stop and report:** answers, the decision entry, and both spike results.

## Phase 1 · The flavor folder, with IBO as the first flavor (no behaviour change)

- [ ] 1.1 Write `flavors/flavor.schema.json` (required fields, patterns for key, package, scheme,
      version, colours; `additionalProperties: false`; every brand colour required, no defaults).
- [ ] 1.2 Write `src/flavor/types.ts` (the `Flavor` type). A test checks the schema and the type
      agree on the field list.
- [ ] 1.3 Create `flavors/ibo/flavor.json` with today's values (`app.config.ts`, `colors.brand`,
      the per-brand config keys from 0.2).
- [ ] 1.4 Move `assets/brand/*` into `flavors/ibo/assets/` and `flavors/ibo/store/` with the
      names above. Remove files nothing uses (check `ibo-dev-wordmark.png`, `launcher-117.png`,
      `logo-light-bg-512.png`, `logo-512.png` first).
- [ ] 1.5 `scripts/flavor/lib/`: `loadFlavor(key)`, `listFlavors()`, schema validation (add `ajv`
      as an exact-pinned dev dependency; check it needs no install script, `.npmrc`).

**Done when:** `flavors/ibo/` validates, nothing reads it yet, typecheck/lint/tests green.

## Phase 2 · Native config from the flavor

- [ ] 2.1 `app.config.ts` reads `APP_FLAVOR` and loads `flavors/<key>/flavor.json`; an unknown or
      missing key fails with the list of flavors (no silent default for builds).
- [ ] 2.2 Map every field: `name`, `slug`, `scheme`, `version`, `android.package`,
      `android.versionCode`, `icon`, `adaptiveIcon`, splash image and colours, `backgroundColor`,
      `owner`, `extra.eas.projectId`. Remove the `BG_BASE` duplicate comment: the colour now has
      one home.
- [ ] 2.3 `plugins/withLocalReleaseSigning.js` reads `credentials/<key>/credentials.json`. Move
      today's `credentials.json` + keystore to `credentials/ibo/` (still git-ignored).
- [ ] 2.4 `eas.json`: per-flavor profiles (`ibo-development`, `ibo-preview`, `ibo-release`,
      `ibo-production`) that `extend` the four shared ones and set `APP_FLAVOR`, using what 0.8
      found. They are generated by the flavor tools (Phase 5), so mark the block as generated.
- [ ] 2.5 Compare `npx expo config --type public` with `APP_FLAVOR=ibo` against the output from
      before Phase 2: identical except for the intended changes.

**Done when:** `APP_FLAVOR=ibo npx expo prebuild` produces the same `AndroidManifest.xml`,
`build.gradle` ids and resources as today.

## Phase 3 · Runtime: shared code reads the flavor

- [ ] 3.1 `metro.config.js` with the `@flavor/*` resolver and the flavor-keyed cache (from 0.7).
      `tsconfig.json` path `@flavor/*` → `flavors/ibo/*` for the editor and `tsc`;
      `jest.config.js` `moduleNameMapper` the same, using `APP_FLAVOR` when set.
- [ ] 3.2 `src/flavor/index.ts`: exports `flavor` (typed `Flavor`) and `flavorAssets`
      (`icon`, `splashLogo`, `logo`, `logoWide`, `posterFallback`) as static `require`s of
      `@flavor/assets/…`.
- [ ] 3.3 Theme: `src/theme/colors.ts` takes `brand` (and `bg.base`) from `flavor.colors`.
      Everything else stays shared until a brand needs it.
- [ ] 3.4 Assets: `Logo.tsx`, `LoadingView.tsx`, `Artwork.tsx` use `flavorAssets`.
- [ ] 3.5 Config split: `scripts/generate-config.mjs` drops the per-brand keys from `src/config.ts`
      (so they cannot be used by mistake); callers (`links.ts`, `ActivationCard.tsx`, `servers.ts`,
      `panel.ts`, `storage/keys.ts`, `expired.tsx`, `server-failed.tsx`, `about.tsx`,
      `account.tsx`, …) read `flavor` instead. Keep `storagePrefix` stable for IBO so saved data
      survives the update.
- [ ] 3.6 Strings: `{{appName}}` / `{{brandName}}` as i18next default variables from `flavor`;
      update `en.json` and `ar.json` in the same change (D-077).
- [ ] 3.7 Dev links: `iboplayer://dev?…` (app/dev.tsx, Maestro) uses `flavor.scheme`.

**Done when:** an IBO dev build on the phone looks and behaves exactly as before (smoke test on
fixtures / the dev backend only, never production), and typecheck/lint/tests are green.

## Phase 4 · Guardrails (tests)

- [ ] 4.1 Boundary test: nothing outside `src/flavor/` imports `@flavor/*` or `flavors/`, and no
      file in `src/` or `app/` compares the flavor key (`=== "ibo"`).
- [ ] 4.2 Hard-coded brand test: no flavor's `displayName`, `brandName`, website host or package
      appears in `src/`, `app/` or the locale files (allowlist for tests and fixtures).
- [ ] 4.3 Every flavor validates against the schema; keys, packages, slugs, schemes and EAS project
      ids are unique across flavors; every required asset exists with the right size (1024×1024
      icons, etc.).
- [ ] 4.4 Run the Jest suite per flavor in `npm run flavor:check -- --tests` (loops `APP_FLAVOR`).

## Phase 5 · Flavor commands

- [ ] 5.1 `npm run flavor:new` — interactive by default: key, display name, package id, website,
      base flavor to copy from (colours and placeholder images), features, colours. Shows a
      summary and writes nothing until confirmed. Script mode:
      `npm run flavor:new -- c7 --name "C7 Player" --package com.mimocodes.c7player --website https://… --from ibo --yes`.
      It validates first, refuses an existing key or a duplicate id, writes `flavors/<key>/`,
      records the copied images as placeholders, adds the EAS profiles, and prints the manual
      to-do list (real images, colours, EAS project: `eas init`, keystore, backend values).
- [ ] 5.2 `npm run flavor:remove -- <key> [--dry-run] [--yes]` — removes the folder and its EAS
      profiles; never touches `credentials/<key>/` (prints where it is). Refuses the last flavor.
- [ ] 5.3 `npm run flavor:check [-- <key>]` — schema, uniqueness, assets and sizes, placeholder
      images still copied from another app (warning in dev, error for release), EAS profiles in
      sync, version not below `last-released.json`.
- [ ] 5.4 `npm run flavor:list` — key, name, package, version for every app.
- [ ] 5.5 Unit tests for the scripts' pure parts (argument parsing, validation, placeholder
      detection, profile generation) in `scripts/flavor/__tests__/`.

## Phase 6 · Run and build: pick the app

- [ ] 6.1 `npm start` / `npm run dev` asks for the app (arrow-key list of flavors; remembers the
      last choice as the default) or takes `--flavor <key>`; starts Metro with `APP_FLAVOR` set.
- [ ] 6.2 `npm run android` — same picker; runs a clean prebuild when `android/.flavor` differs
      from the chosen key, then `expo run:android`.
- [ ] 6.3 `npm run build` — asks for the app, then the kind of build:
  - local release APK (D-087 Gradle flow, signed with `credentials/<key>/`)
  - local release AAB (Play Store)
  - EAS cloud: development / preview / release / production
    Non-interactive: `npm run build -- --flavor c7 --type apk --local`. `--all` builds every app
    one after another.
- [ ] 6.4 Output goes to `dist/<key>/<key>-<version>-<versionCode>.apk|aab` (git-ignored), with
      `dist/manifest.json` listing what was built.
- [ ] 6.5 Fail early with a clear message when: `APP_FLAVOR` is unknown, the keystore for a local
      release is missing, the tree has uncommitted changes (release only), or the version would go
      down.

## Phase 7 · Release checks and history

- [ ] 7.1 After a release build, inspect the artifact (`aapt2 dump badging` / unzip): package id,
      label, `versionName`, `versionCode` match `flavor.json`; no image from another flavor's
      `assets/` is inside (hash comparison); no fixture code when the profile excludes it.
- [ ] 7.2 Only when every check passes: write `flavors/<key>/last-released.json`
      (`{ version, versionCode, releasedAt }`) and print the reminder to commit it.
- [ ] 7.3 `docs/release-checklist.md` gets a per-flavor section.

## Phase 8 · End-to-end tests per app

- [ ] 8.1 Maestro flows use `appId: ${APP_ID}` and the dev-link scheme from an env value;
      `npm run e2e -- --flavor <key>` passes both from `flavor.json`.
- [ ] 8.2 Update `e2e/README.md`.

## Phase 9 · Acceptance: a real second app

- [ ] 9.1 `npm run flavor:new` for the app from 0.4, real images and colours.
- [ ] 9.2 Build both apps; install both on the phone side by side (different packages).
- [ ] 9.3 Smoke test both (fixtures / dev backend): launcher name and icon, splash, logo, colours,
      website links, strings with the app name, activation, playback, downloads.
- [ ] 9.4 Maestro suite on both.
- [ ] 9.5 Release checks (Phase 7) pass for both; each APK contains only its own images.

## Phase 10 · Documentation

- [ ] 10.1 `docs/flavors.md`: the guide (concepts, shared vs per-app, create/remove, run/build,
      release, versioning, troubleshooting, what not to do), modelled on Flutter's
      `docs/REPLICATION_GUIDE.md`.
- [ ] 10.2 `AGENTS.md`: commands and the rules (shared code never names an app; every per-app
      value lives in `flavors/<key>/`; never hand-edit generated blocks).
- [ ] 10.3 A `.claude/skills/flavors` skill like Flutter's `replication-guide`, pointing to the
      guide.
- [ ] 10.4 `docs/progress.md` and `docs/decisions.md` updated.

---

## Rules from day one

- Shared code (`src/`, `app/`) never imports `flavors/` and never checks which app is running;
  it reads `@/flavor`. If two apps need different behaviour, add a field or a feature flag to
  `flavor.json`.
- A new brand colour or asset is added to the schema as **required**, and to every flavor in the
  same change. No defaults that let an app silently look like IBO.
- `ibo` must stay identical to today's app (package, storage prefix, signing) so installed users
  update in place.
- Testing happens on fixtures or the dev backend, never on a production backend.
- `credentials/`, `dist/` and keystores are never committed.

## Open questions (fill in during Phase 0)

| #   | Question                                                     | Answer |
| --- | ------------------------------------------------------------ | ------ |
| F-1 | Which `config.ts` keys are per brand? (0.2)                  |        |
| F-2 | Same IBO backend for every brand, or per-brand servers?      |        |
| F-3 | `RN` device id prefix for every brand?                       |        |
| F-4 | The second app: key, name, package, website, colours, images |        |
| F-5 | One EAS project per app?                                     |        |
| F-6 | Versions local in `flavor.json` (recommended) or EAS remote? |        |
| F-7 | Which features may differ per app in v1 (if any)?            |        |
