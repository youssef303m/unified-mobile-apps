# End-to-end flows (Maestro)

The flows of 04-build/testing.md §4 for the milestones done so far, on the fixtures (never a real
server). They run against the development build on a phone connected over USB.

| File                           | Flow                                                                     |
| ------------------------------ | ------------------------------------------------------------------------ |
| `flow-01-first-launch.yaml`    | 1: terms → captcha → trial Welcome → Home; expired → Check again → Home  |
| `flow-07-switch-playlist.yaml` | 7: switch playlist → the catalogue re-syncs → Home shows the new content |
| `flow-10-expired.yaml`         | 10: expired account → Expired screen → no content reachable              |

`common/` holds shared steps (not run on their own). The flows drive the fixtures through the
dev-only link `iboplayer://dev?network=fixtures&reset=1&account=trial|active|expired` (app/dev.tsx).

## Running

1. Start the dev server: `npx expo start --dev-client`.
2. Connect the phone (USB debugging on) and check `adb devices` lists it.
3. Let the phone reach Metro as `localhost:8081`: `adb reverse tcp:8081 tcp:8081`.
4. `maestro test e2e/` (or one file). Maestro installs two helper apps on the phone
   (`dev.mobile.maestro`, `dev.mobile.maestro.test`); remove them afterwards with
   `adb uninstall dev.mobile.maestro` and `adb uninstall dev.mobile.maestro.test`.
