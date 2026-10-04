# Release checklist (v1.0.0)

From `iboplayer-mobile-kit/04-build/release.md` and `testing.md` §5. Tick each line for a
release; "Owner" lines need an answer or an account from the owner.

## 1. Build and automated checks

- [x] `npm ci && npm run typecheck && npm run lint && npm test` pass. (2026-10-04: 448 tests in
      38 suites, on the installed tree; `npm ci` not rerun.)
- [x] Preview build: `npx eas-cli@latest build --profile preview --platform android`, installed
      on the phone. (2026-10-04: 1.0.0, 132.7 MB universal APK, on the DNP NX9, Android 16.)
- [x] The Maestro suite passes on it: `maestro test -e BUILD=preview e2e/` (e2e/README.md).
      (2026-10-04: 10/10 flows in 16 min.)
- [ ] `npx expo-doctor` passes. (2026-10-04: 20/21; four Expo patch releases came out after the
      build: expo, expo-constants, expo-navigation-bar, expo-router.)

## 2. Manual device checklist (testing.md §5)

- [ ] Phones: a 2020-2021 mid-range phone (4 GB RAM, Android 10-11) and a current flagship.
- [ ] Real playlists from the owner: one Xtream, one M3U, one Stalker portal, and one with
      20,000+ channels. (Real servers: this is the only step that uses them.)
- [ ] Streams: HLS live, MPEG-TS live, an MP4 movie, an MKV movie with AC3 audio (the notice of
      D-073 when the phone cannot decode it), HEVC. Picture, audio and track switching on each.
- [ ] Poor network (3G throttling); airplane mode mid-playback, then the network back.
- [ ] Offline start (D-081): airplane mode, open the app: Home from the saved catalogue with the
      offline banner, My List → Downloads plays, Try again reloads once online.
- [ ] Downloads: kill the app mid-download (it continues or resumes), Wi-Fi off mid-download,
      an episode download, subtitles offline.
- [ ] Rotation, PiP, background audio and its notification controls, an incoming call pausing
      playback.
- [ ] TalkBack on Home, Live, a movie page, the player (controls stay, Unlock reachable), Settings,
      the PIN pad (D-082).
- [ ] Arabic: every main screen right to left; a native speaker has reviewed `ar.json` (D-077).

## 3. Performance budgets (architecture.md), on the mid-range phone, preview build

| Scenario                                | Target                                         | How to measure                                                                                  | Result                                                                                                            |
| --------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Cold start to Home, cached catalogue    | < 2.5 s                                        | `adb shell am start -W com.iboplayer.mobile/.MainActivity` (TotalTime) plus a stopwatch to Home | 2026-10-04, DNP NX9: TotalTime 430-443 ms; Home drawn at ~1.3-1.5 s (timed screenshots, Fixture Big cached). Pass |
| Sync a 20,000-channel Xtream playlist   | progress shown, UI never freezes, < 30 s on 4G | the Live tab's loader                                                                           | needs a real playlist (§2)                                                                                        |
| Scroll a 5,000-item category            | 60 fps                                         | `e2e/perf/big-category.yaml` with `dumpsys gfxinfo`                                             | 2026-10-04, DNP NX9: 7,366 frames, 0.83% janky, p99 14 ms. Pass                                                   |
| Search, first results                   | < 300 ms                                       | type in Search on the big fixture                                                               | to measure                                                                                                        |
| Play to first frame (VOD, good network) | < 2 s, spinner at once                         | stopwatch                                                                                       | to measure                                                                                                        |

## 4. Play Store (owner)

- [ ] **Owner:** the package id. `com.iboplayer.mobile` is a placeholder (Q-package-id) and can
      never change after the first upload.
- [ ] **Owner:** create the Play Console app; EAS keeps the upload key, Google Play App Signing on.
- [ ] **Owner:** privacy policy URL (Q-privacy), hosted on the website in `config.json`.
- [ ] **Owner:** content rating answers, as the TV stores were answered.
- [ ] Data safety form: the device id goes to the IBO backend; playlist credentials stay on the
      phone (encrypted MMKV, no backup); no analytics (D-080); no data is sold; no crash reporting unless the owner adds one.
- [ ] Foreground service declarations: `dataSync` (downloads the user starts, with a progress
      notification) and `mediaPlayback` (background audio and PiP controls).
- [ ] Listing text says the app contains no content (vision.md); screenshots from the fixtures
      only (neutral artwork, no real channels or posters).
- [ ] Target API level: what Google Play requires at upload time (Expo SDK 57 targets it).

## 5. Ship

- [ ] Bump `version` in `app.config.ts` (the store `versionCode` is managed by EAS,
      `autoIncrement`), write release notes (English, plus Arabic).
- [ ] `npx eas-cli@latest build --profile production --platform android`, then
      `npx eas-cli@latest submit --platform android`: internal testing → closed testing →
      production, staged 10% → 50% → 100%.
- [ ] **Owner (optional):** a Sentry DSN turns on crash reporting (D-079) before the rollout;
      otherwise watch the Play Console's Android vitals.
