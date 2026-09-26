# Roadmap

Build in this order. Each milestone ends with its **acceptance checks passing**, and the tests,
lint and type check green, before the next starts. Commit per task. Keep `docs/progress.md`
in the new project up to date: the milestone, what's done, and what's next. A later session (or a
different agent) must be able to continue from it.

## M0 · Project skeleton
- The Expo app with TypeScript strict, expo-router, the dev client, ESLint and Prettier, Jest, and
  the CI workflow (04-build/tech-stack.md).
- The folder layout from 04-build/architecture.md, with empty modules.
- The theme tokens and typography (03-design/design-system.md §1-3), fonts loaded, the icon and
  splash configured (assets/README.md).
- i18n with the 18 locales and RTL switching (05-reference/translations.md).
- **Accept:** `npx expo run:android` shows the splash, then a placeholder tab bar, in English and
  Arabic (RTL). CI passes on a clean checkout.

## M1 · Fixtures and API clients (no UI)
- `src/api/http.ts` and the typed errors.
- The IBO backend client: server selection, device identity, registration, the playlist list, and
  every endpoint in 02-backend/ibo-api-reference.md, including the crypto (02-backend/device-and-auth.md).
- The Xtream, M3U and Stalker clients (02-backend/xtream.md, m3u.md, stalker.md), EPG and catch-up
  (epg-and-catchup.md), and TMDB, image cache and analytics (services.md).
- The fixtures and MSW (04-build/testing.md §1), plus the "use fixtures" dev toggle.
- **Accept:** unit tests cover every endpoint against the fixtures, the crypto test vectors pass,
  and the M3U parser handles the 20,000-entry fixture in under 3s under Jest.

## M2 · Content layer and storage
- The SQLite schema and FTS; the `ContentSource` interface and its three implementations; the sync
  with progress, including load-on-demand.
- The MMKV key-value storage with the TV key names (02-backend/data-models.md).
- The business rules module (01-product/business-rules.md), with one test per R-xxx.
- **Accept:** a fixture playlist of each type syncs into SQLite; category pages, lookups by id and
  search queries return the right data; every R-xxx test passes.

## M3 · Boot, activation and playlists
- The flows: splash → terms → registration → account-state routing → Activation screen → playlist
  load → Home placeholder (01-product/user-flows.md, first launch).
- The Playlists and Portals screens, switching playlists, and the Account screen.
- **Accept:** Maestro flows 1, 7 and 10 (04-build/testing.md §4).

## M4 · Browse
- The design-system components (§5), each with its states.
- Home (N-01), Movies, Series, Live (the list), and the Movie and Series details pages. Search. My
  List (favourites and continue watching).
- Parental control: the PIN pad, locked categories, and changing the PIN.
- **Accept:** Maestro flows 5 and 6. Scrolling a 5,000-item category stays smooth (no dropped
  frames visible in the perf monitor).

## M5 · Playback
- The VOD player with its controls, gestures (N-04), tracks, external subtitles, resume and
  continue watching, next episode (N-07), and trailers (01-product/player.md).
- The live player: zapping, the channel panel, EPG info, and catch-up. The EPG guide screen.
- PiP (N-05) and background audio (N-06).
- **Accept:** Maestro flows 2, 3 and 4 against the public test streams. The manual checks for HLS,
  MPEG-TS and MP4 pass on a device.

## M6 · Settings and the rest of parity
- Every setting in 01-product/settings.md (minus the TV-only ones) with the same effects. Clear
  cache and clear recent. Language. About.
- Expiry notifications and banners. Stararcs proxy, if in scope (see open-questions).
- **Accept:** Maestro flow 8. A parity check against 01-product/current-app-inventory.md, where every
  screen and action is marked as done, replaced (with what), or dropped (why), in `docs/parity.md`.

## M7 · Downloads
- The download manager, the Downloads screen, offline playback, the Wi-Fi-only setting,
  notifications, and storage checks (N-03, player.md §8).
- **Accept:** Maestro flow 9. The kill-and-resume manual test passes.

## M8 · Hardening and release
- Error states on every screen, offline mode (downloads usable, clear messaging elsewhere), and a
  TalkBack pass.
- Performance budgets (04-build/architecture.md), crash reporting (if decided), and the release
  checklist (04-build/release.md).
- **Accept:** the full Maestro suite and the manual device checklist (testing.md §5) pass. A
  preview build goes to the owner.

## Order of work inside a milestone

Types first, then the service with its tests, then the hook, then the component or screen. Never
start a screen whose data layer has no tests.
