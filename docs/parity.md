# Parity check: TV app → phone app

Every screen and action of the TV app (`iboplayer-mobile-kit/01-product/current-app-inventory.md`)
and each one's state in the phone app. The settings are listed item by item in §21.

- **Done:** the phone does what the TV does, with touch in place of the remote.
- **Replaced:** the same job, done the phone way (says with what).
- **Dropped:** not in v1 (says why; the owner's choices are in `docs/decisions.md`).
- **Gap:** in the phone spec but not built yet. The owner decides whether it goes in (see the end).

Checked on 2026-09-27, at the end of M6.

## 0. Global elements

| TV                               | Phone                                                                      | State             |
| -------------------------------- | -------------------------------------------------------------------------- | ----------------- |
| Toast                            | Toast (4 s, D-039)                                                         | Done              |
| Full-screen loader, Back cancels | Loader screens with Cancel; Back cancels                                   | Done              |
| PIN overlay                      | PIN bottom sheet (4 cells, number pad, Cancel)                             | Replaced          |
| Exit dialog                      | Double Back on Home exits, with a "Press back again to exit" toast (R-130) | Replaced          |
| On-screen keyboards              | The phone keyboard                                                         | Dropped (TV-only) |
| Colour keys                      | Visible buttons, long-press menus                                          | Dropped (TV-only) |

## 1. Loading / splash

| TV                                                                         | Phone                                                    | State |
| -------------------------------------------------------------------------- | -------------------------------------------------------- | ----- |
| Logo, title, message, spinner                                              | Splash and loading screen                                | Done  |
| MAC and device key strip                                                   | Shown on the loading screen                              | Done  |
| Boot status line                                                           | Shown (the kit recommends it)                            | Done  |
| 1a. "Stuck on loading?" after 120 s: Change Playlist, Restart App, Dismiss | Same panel and actions                                   | Done  |
| 1b. "Server URLs failed" with a custom domain                              | Server-failed screen with the domain field and Try again | Done  |

## 2–4. First launch

| TV                                        | Phone                                                                | State                                  |
| ----------------------------------------- | -------------------------------------------------------------------- | -------------------------------------- |
| 2. Terms dialog, Accept only; Back exits  | Terms screen                                                         | Done                                   |
| 3. Captcha: image, code, New Code, Verify | Same, with the phone keyboard                                        | Done                                   |
| 3. "Scan the QR on your phone" + Continue | "Verify on website" opens the same URL in the browser, then Continue | Replaced                               |
| 3. Cancel (only from the Stararcs page)   | —                                                                    | Dropped (Stararcs is not in v1, D-074) |
| 4. Welcome (trial) with Continue          | Welcome screen                                                       | Done                                   |
| 4. Expired licence: blocked, no Continue  | Expired screen, with Check again and the website link                | Done                                   |

## 5. Home

| TV                                                     | Phone                                                                      | State                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| Tile home                                              | Streaming-style Home: hero and rows (N-01)                                 | Replaced                                              |
| Stararcs "Connected to <country>"                      | —                                                                          | Dropped (D-074)                                       |
| Weather, date and clock block                          | —                                                                          | Dropped (optional on phone; the phone shows the time) |
| Playlist expiry block ("Playlist will expire in …")    | Home banner when it expires within 5 days, dismissible (R-114)             | Replaced                                              |
| Playlist expiry popup (0–5 days)                       | Bottom sheet, once per launch and playlist, with the same text and Dismiss | Done                                                  |
| Account icon                                           | The avatar on every tab                                                    | Done                                                  |
| Search icon                                            | Search on every tab                                                        | Done                                                  |
| Refresh icon                                           | Pull to refresh (N-09)                                                     | Replaced                                              |
| Live Favorites tile                                    | "Live now" favourites row on Home, and the Favourites chip on Live         | Replaced                                              |
| Live TV / Movies / Series tiles                        | Bottom tabs, and the Home chips                                            | Replaced                                              |
| Replay tile (and the Stalker toast)                    | Replay button on the Live tab, shown only where Replay works (R-097)       | Replaced                                              |
| Sections load on demand, Back cancels, failure message | Same (section loader with Cancel and Try again)                            | Done                                                  |
| Device info block (MAC, key, app expiry)               | Account screen                                                             | Replaced                                              |
| Sports Channels                                        | —                                                                          | Dropped (owner, D-075)                                |
| Change Server                                          | Playlists (Account, and the Home playlist chip)                            | Replaced                                              |
| Settings                                               | Account → Settings                                                         | Replaced                                              |
| Stalker Portals                                        | Account → Stalker Portals                                                  | Replaced                                              |
| Stararcs Proxy                                         | —                                                                          | Dropped (D-074)                                       |
| "No active playlist" toast                             | The tabs need a loaded playlist; without one the app shows Playlists       | Replaced                                              |

## 6. Playlists

| TV                                                         | Phone                                                     | State    |
| ---------------------------------------------------------- | --------------------------------------------------------- | -------- |
| List of Xtream / M3U playlists, CURRENT badge, expiry line | Same                                                      | Done     |
| Error banners after a failed load (every message)          | Same banners                                              | Done     |
| Delete with confirmation; last playlist refused; failures  | Overflow menu → confirmation; same messages               | Done     |
| Auto Switch Playlist toggle                                | Playlists screen and Settings → Startup                   | Done     |
| Start on Playlist toggle                                   | Playlists screen, and Settings → App Initialization       | Done     |
| Add Playlist                                               | Add playlist screen (Xtream only, as the IBOPlayer build) | Done     |
| Reload                                                     | Pull to refresh                                           | Replaced |
| Playlists QR Code                                          | "Open website to manage playlists"                        | Replaced |
| Stalker Portals button                                     | Account → Stalker Portals                                 | Replaced |
| Footer text                                                | Kept                                                      | Done     |
| Back at startup or after a failed load exits               | Same                                                      | Done     |
| Empty list (no text on TV)                                 | Empty state with the device id and the website            | Done     |

## 7–9. Add playlist and portals

| TV                                                                                                 | Phone                                               | State    |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------- |
| 7. Add playlist form, validation, server test, local save and retry (R-030)                        | Same                                                | Done     |
| 7. "Scan to add a playlist from your phone"                                                        | "Or add on the website"                             | Replaced |
| 8. Portals list, Selected, empty text, error banners                                               | Same                                                | Done     |
| 8. Device information card (model, virtual MAC, software MAC, key)                                 | Same                                                | Done     |
| 8. STB Profile radio                                                                               | Same                                                | Done     |
| 8. Add Portal, Remove Portal                                                                       | Add; remove from the row's menu with a confirmation | Done     |
| 8. Portal URL QR                                                                                   | The in-app form and the website link                | Replaced |
| 9. Add Portal form, MAC prefixes, validation, test connect (the TV portal list has no Edit button) | Same                                                | Done     |

## 10. Live TV

| TV                                                                      | Phone                                                                                                                                  | State                    |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Classic / Normal / Modern layouts                                       | One layout                                                                                                                             | Dropped (TV-only; D-074) |
| Category list: virtual rows, custom, provider, Uncategorized            | Chips (Recently Viewed, Favourites, current) and the category sheet                                                                    | Replaced                 |
| Category icons with country flags                                       | Names only                                                                                                                             | Gap (small)              |
| Channel counts per category                                             | —                                                                                                                                      | Gap (small)              |
| Adult categories ask for the PIN                                        | Same (R-061)                                                                                                                           | Done                     |
| Channel rows: number, logo, name, star, playing highlight               | Same, plus the programme on now                                                                                                        | Done                     |
| First tap previews, second tap full screen (R-091)                      | Mini player at the top; a tap on it or on the playing channel goes full screen                                                         | Done                     |
| Idle auto-fullscreen after 15 s                                         | —                                                                                                                                      | Dropped (TV-only)        |
| Now Playing card with next programmes                                   | EPG in the full-screen player's info panel                                                                                             | Replaced                 |
| Move (categories and channels, R-093)                                   | Category sheet → "Move categories"; long press a channel → "Move channel"; up / down buttons, saved at once in the TV's format (D-075) | Replaced                 |
| Search                                                                  | Search icon (live scope)                                                                                                               | Done                     |
| Fav                                                                     | Star on the row, long-press menu                                                                                                       | Done                     |
| Switch Page dialog                                                      | Bottom tabs                                                                                                                            | Replaced                 |
| Arrange Categories                                                      | —                                                                                                                                      | Dropped (owner, D-075)   |
| EPG button (hidden for M3U)                                             | Guide button on the Live tab (hidden for M3U)                                                                                          | Done                     |
| Favourite toasts, adult refusal                                         | Same                                                                                                                                   | Done                     |
| Full screen: info bar, clock, EPG now/next, previous / next, audio      | Same, auto-hide after 7.5 s                                                                                                            | Done                     |
| Up / Down zapping                                                       | Previous / next buttons and swipes                                                                                                     | Replaced                 |
| Number keys → channel                                                   | —                                                                                                                                      | Dropped (TV-only)        |
| Channel strip with Now / Next / Later                                   | Channels panel in the player                                                                                                           | Replaced                 |
| Aspect ratio, subtitles, audio, favourite                               | Player settings and track sheets                                                                                                       | Done                     |
| Reconnecting overlay                                                    | Reconnecting state (6 s × 10)                                                                                                          | Done                     |
| Favourites-only entry, empty category, Stalker paging and stream errors | Same                                                                                                                                   | Done                     |
| 10a. Legacy live search dialog                                          | One Search screen (min. 2 characters, D-040)                                                                                           | Replaced                 |
| 10b. Switch Page                                                        | Bottom tabs                                                                                                                            | Replaced                 |

## 11–14. Guide, Arrange, grids, catch-up

| TV                                                                          | Phone                                                      | State                                             |
| --------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| 11. EPG Guide for the category's channels, today, now-line                  | Guide screen, scrollable timeline (D-068)                  | Done                                              |
| 11. Tap: preview, then full screen                                          | First tap previews, second plays full screen               | Done                                              |
| 11. Past programme → "not available from the guide"                         | Plays its catch-up where there is one (mobile spec, D-068) | Replaced                                          |
| 11. Lazy loading, 4 at a time, give-up messages, M3U / empty checks (R-096) | Same                                                       | Done                                              |
| 12. Arrange Categories                                                      | —                                                          | Dropped (owner, D-075)                            |
| 13. Movies / Series sidebar with rows (R-053)                               | Tab rows and "See all" category screens                    | Replaced                                          |
| 13. Category search box                                                     | —                                                          | Gap (small; the category sheet has no search yet) |
| 13. Replay mode                                                             | Replay screen (Xtream)                                     | Done                                              |
| 13. Sort dialog (R-090)                                                     | Sort on category screens                                   | Done                                              |
| 13. Theme dialog (Classic / Modern)                                         | One layout                                                 | Dropped (TV-only)                                 |
| 13. Hero info panel, YouTube trailer on idle                                | Hero on Home; details pages                                | Replaced                                          |
| 13. Top Rated with the Refresh shuffle (R-055)                              | Same                                                       | Done                                              |
| 13. NEW badge, S{n}EP{m}, star, progress                                    | Same                                                       | Done                                              |
| 13. Adult categories ask for the PIN                                        | Same                                                       | Done                                              |
| 13. Replay checks and errors                                                | Same messages                                              | Done                                              |
| 14. Catch-up list: days, programmes, only finished ones                     | Catch-up sheet                                             | Done                                              |

## 15–20. Details, trailer, search, collections

| TV                                                                                                    | Phone                                   | State                                                               |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| 15. Movie details: backdrop, rating, info, cast, Start / Continue Watching with %, trailer, favourite | Same                                    | Done                                                                |
| 16. Series details: seasons, episodes with progress, errors, M3U series                               | Same                                    | Done                                                                |
| 17. Trailer player                                                                                    | Opens YouTube (D-063)                   | Replaced                                                            |
| 18. Global and scoped search                                                                          | One Search screen with segments (D-040) | Replaced                                                            |
| 19. "Add to" chooser                                                                                  | —                                       | Dropped (custom categories not in v1, D-074; Sports dropped, D-075) |
| 20. Custom Categories page                                                                            | —                                       | Dropped (D-074)                                                     |

## 21. Settings (settings.md)

| TV setting                                  | Phone                                                                               | State             |
| ------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------- |
| Media Player, Auto Switch Player            | One player engine, fallback automatic                                               | Dropped (D-074)   |
| Change Language                             | Settings → General, and Account (English and Arabic, D-020)                         | Done              |
| Hide Categories                             | Settings → Content                                                                  | Done              |
| App Theme                                   | One dark look                                                                       | Dropped (D-074)   |
| Channel Theme                               | One Live layout                                                                     | Dropped (D-074)   |
| Parental Control                            | Settings → General                                                                  | Done              |
| Clear Cache                                 | Settings → Storage, with a confirmation; also clears the saved catalogue and images | Done              |
| Clear Watch Lists (movies, series)          | Settings → Storage, with confirmations                                              | Done              |
| Subtitle Settings (size, colours, position) | Settings → Playback, and the player's subtitle menu                                 | Done              |
| Font Size                                   | Android's font size                                                                 | Dropped (D-074)   |
| Toggle TMDB API                             | Always on                                                                           | Dropped (D-074)   |
| Toggle Home Favorites                       | Always on                                                                           | Dropped (D-074)   |
| Live Initialization                         | Settings → Content                                                                  | Done              |
| Load on Demand                              | Always enabled                                                                      | Dropped (D-074)   |
| App Initialization                          | Settings → Startup (and "Start on Playlist")                                        | Done              |
| Custom Categories                           | —                                                                                   | Dropped (D-074)   |
| Autoplay (player)                           | Player menu and Settings → Playback                                                 | Done              |
| Stararcs proxy, Keep Connection             | —                                                                                   | Dropped (D-074)   |
| STB Profile                                 | Stalker Portals screen                                                              | Done              |
| Sort orders                                 | Category screens                                                                    | Done              |
| Movies Theme Control                        | One layout                                                                          | Dropped (TV-only) |
| — (phone)                                   | Background audio (N-06) in Settings → Playback and the player menu                  | New               |

## 22–25. Account, Stararcs, exit, player

| TV                                                                                          | Phone                                                                                                    | State           |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------- |
| 22. Account: device, app and playlist info                                                  | Same cards, copyable MAC and key, links to Playlists, Portals, Settings, Language, About and the website | Done            |
| 23. Stararcs Proxy page                                                                     | —                                                                                                        | Dropped (D-074) |
| 24. Exit dialog                                                                             | Double Back on Home                                                                                      | Replaced        |
| 25. Player: live, movie, series, catch-up; resume prompt; autoplay; tracks; next / previous | Done in M5 (D-065 to D-073)                                                                              | Done            |
| 25. AC3 / DTS audio                                                                         | Plays where the phone has a decoder; otherwise a notice (D-070)                                          | Replaced        |

## Gaps for the owner

Small items from the phone spec that are not built. None blocks a feature; each is a few hours:

1. Country flags on live category names (user-flows.md §5 Mobile).
2. Channel counts in the category sheet.
3. A search box in the category sheet, for long category lists.

Downloads (N-03) come in M7.
