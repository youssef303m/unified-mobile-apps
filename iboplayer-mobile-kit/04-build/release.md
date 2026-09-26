# Release

## Versioning

- `version` (user-visible) uses semver, starting at `1.0.0`. `android.versionCode` goes up by 1
  on every store upload. EAS can manage it (`autoIncrement` in the production profile).
- The IBO backend receives the app version during registration, as the TV app sends its version
  (02-backend/device-and-auth.md). Send the mobile `version` in the same field.

## Build profiles (eas.json)

| Profile | Output | Use |
|---|---|---|
| `development` | APK with the dev client | daily work on emulator and device |
| `preview` | APK, internal distribution | testers; fixtures toggle available in a hidden dev menu |
| `production` | AAB | Play Store; the dev menu and fixtures are compiled out |

## Signing

Use EAS-managed credentials (the upload key is stored by EAS) plus Google Play App Signing.
The owner must create the Play Console app. The package id cannot change after the first upload
(04-build/tech-stack.md).

## Play Store requirements checklist

- **Data safety form:** the device identifier is sent to the IBO backend. Playlist credentials are
  stored on the device. Analytics, if enabled, collects the events listed in 02-backend/services.md.
  No data is sold.
- **Privacy policy URL:** needed. Ask the owner; the TV app's website (see
  02-backend/config.json `websiteUrl`) should host it.
- **Content rating questionnaire:** as a media player, content depends on the user's playlist.
  Answer as the TV stores were answered (ask the owner).
- **Policy:** the listing and the app must say the app contains no content (01-product/vision.md).
  Do not show screenshots of copyrighted channels, movies or posters. Use the fixtures with neutral
  artwork for the screenshots.
- **Target API level:** whatever Google Play currently requires for new apps and updates.
- **Foreground service type declaration** for downloads (`dataSync`), with its justification.

## Release steps

1. `npm ci && npx tsc --noEmit && npm run lint && npm test` all pass. The Maestro suite passes on
   the preview build.
2. Run the manual device checklist in 04-build/testing.md §5.
3. Bump `version` and write release notes (English, plus any translated ones available).
4. `eas build --profile production --platform android`, then `eas submit` to the internal testing
   track → closed testing → production with a staged rollout (10% → 50% → 100%), watching crash
   reports.
