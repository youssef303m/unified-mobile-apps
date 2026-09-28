# End-to-end flows (Maestro)

The flows of 04-build/testing.md §4 for the milestones done so far, on the fixtures (never a real
server). They run against the development build on a phone connected over USB.

| File                           | Flow                                                                      |
| ------------------------------ | ------------------------------------------------------------------------- |
| `flow-01-first-launch.yaml`    | 1: terms → captcha → trial Welcome → Home; expired → Check again → Home   |
| `flow-02-movie-resume.yaml`    | 2: movie details → Play → seek → back → Continue Watching at that point   |
| `flow-03-next-episode.yaml`    | 3: series → season 2 → episode 3 → play → Quick Seek → next-episode card  |
| `flow-04-live.yaml`            | 4: live → category → channel → zap → EPG guide → catch-up; Stalker: none  |
| `flow-05-parental.yaml`        | 5: locked category → wrong PIN → right PIN → change PIN → new PIN opens   |
| `flow-06-search.yaml`          | 6: search finds a channel, a movie and a series; empty query → recents    |
| `flow-07-switch-playlist.yaml` | 7: switch playlist → the catalogue re-syncs → Home shows the new content  |
| `flow-08-language.yaml`        | 8: Settings → Arabic → the layout turns right to left → back to English   |
| `flow-09-download.yaml`        | 9: HLS has no Download; an .mkv downloads → airplane mode → plays offline |
| `flow-10-expired.yaml`         | 10: expired account → Expired screen → no content reachable               |
| `perf/big-category.yaml`       | M4: fling through a 5,000-movie category (run on its own, see below)      |

Flows 2, 3 and 4 play video: in fixture mode, fixture stream URLs become public test streams
(Mux HLS, Google MP4/MKV, a Unified Streaming live stream, an Apple TS segment; docs/decisions.md), so the
phone needs internet. They need the M5 development build (react-native-video).

`common/` holds shared steps (not run on their own). The flows drive the fixtures through the
dev-only link `iboplayer://dev?network=fixtures&reset=1&account=trial|active|expired&big=0|1`
(app/dev.tsx). Development builds cannot reach the production backend (docs/decisions.md D-061).

## Running

1. Start the dev server: `npx expo start --dev-client`.
2. Connect the phone (USB debugging on) and check `adb devices` lists it.
3. Let the phone reach Metro as `localhost:8081`: `adb reverse tcp:8081 tcp:8081`.
4. `maestro test e2e/` (or one file). Maestro installs two helper apps on the phone
   (`dev.mobile.maestro`, `dev.mobile.maestro.test`); remove them afterwards with
   `adb uninstall dev.mobile.maestro` and `adb uninstall dev.mobile.maestro.test`.

## On a preview build (release step 1)

A preview build has its JavaScript inside and no dev client; fixtures stay available
(`EXPO_PUBLIC_ENABLE_FIXTURES=1`). No Metro or `adb reverse` is needed:

```bash
maestro test -e BUILD=preview e2e/
```

## The scrolling check (M4)

`maestro test e2e/` runs the numbered flows only. The scrolling check runs on its own, with
Android's frame statistics around it:

```bash
adb shell dumpsys gfxinfo com.iboplayer.mobile reset
maestro test e2e/perf/big-category.yaml
adb shell dumpsys gfxinfo com.iboplayer.mobile | grep -E "Total frames|Janky frames|percentile"
```

A development build runs JavaScript in debug mode, so its numbers are worse than a release
build's; the perf monitor (dev menu → "Perf monitor") shows the same on screen.
