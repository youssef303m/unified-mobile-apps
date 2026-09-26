# New features (phone only)

The TV app's features are the baseline (current-app-inventory.md). This file lists what the phone
app adds. Each feature has an id (`N-xx`), a release (v1 or v2) and acceptance criteria. Anything
not listed here or in the inventory is out of scope; ask before adding it.

## v1

### N-01 · Streaming-style Home
- **What:** a hero banner (the featured item), then rows: Continue Watching, My List, Live Now
  (favourite channels with their current programme), Recently Added Movies, Recently Added Series,
  and one row per category the user has opened most. The rows are built from local data only.
- **Rules:** the hero is the most recently added movie that has artwork and is not in an adult
  category (R-060). Items from adult categories never appear in any Home row, just as R-063 and
  R-064 keep them out of history and search.
- **Load on demand (on by default, R-050):** nothing is fetched at start-up, so Home would be
  empty. After Home appears, prefetch the movie and series lists in the background, at low
  priority and cancellable, and fill the rows as they arrive. This is the recommended default and
  open question Q-home-prefetch.
- **Acceptance:** Home renders from the SQLite cache in under 1s after the first sync. Every row
  has a skeleton and an empty state (the row is hidden when it has nothing to show).

### N-02 · My List
- **What:** a tab combining favourites (movies, series and channels: the same favourites as the
  TV app), Continue Watching (full list) and Downloads.
- **Acceptance:** favourites added here appear in the live page's Favourites category and vice
  versa. They use the same storage as the TV-parity favourites (data-models.md).

### N-03 · Downloads (offline viewing)
- **What:** download movies and episodes to watch offline.
- **Scope:** only items with a **direct file URL** (Xtream movies and episodes with
  `container_extension` such as mp4 or mkv; M3U VOD entries pointing at a file). Stalker VOD
  downloads the file behind `create_link` at download time. Live channels and HLS
  (`.m3u8`) VOD are not downloadable in v1: the button is hidden, with no error.
- **Behaviour:**
  - The download button is on the details page and on each episode row.
  - Downloads run in the background, with notification progress, and resume after network loss
    or app restart.
  - There is a Wi-Fi-only setting, on by default.
  - A queue with at most 2 parallel downloads.
  - Storage: app-specific internal storage. Before starting, check free space (Content-Length
    plus 200 MB margin) and explain if it is insufficient.
  - The Downloads screen in My List groups episodes by series, shows size, allows delete and
    delete-all, and shows the total storage used.
- **Offline playback:** plays the local file with the same player (resume, tracks). Downloaded
  external subtitles are stored next to the file.
- **Rules:**
  - A downloaded item stays playable offline even if the playlist later expires, **unless** the
    owner decides otherwise (open question Q-downloads).
  - Items from adult categories ask for the PIN every time, offline too (R-061). They get no
    resume position (R-063).
  - Removing a playlist offers to delete its downloads.
- **Acceptance:** download a 1 GB movie on Wi-Fi, kill the app midway, reopen it, and the
  download resumes. It then plays in airplane mode with resume position and subtitles.
- Technical details: 01-product/player.md §8, 04-build/tech-stack.md.

### N-04 · Player gestures and phone controls
- Double-tap left or right to seek −10s / +10s. The TV skips ±30s (player.md); the phone uses the
  streaming-app convention of 10s. The ±30s skip buttons remain in the control bar.
- Swipe vertically on the left half for brightness and on the right half for volume.
- Pinch for fit/fill.
- A lock-controls button.
- Tapping the seek bar and dragging it shows a thumbnail-less time bubble.
- Landscape on entry, back to portrait on exit.
- **Acceptance:** all gestures work in the VOD player. In the live player, the seek gestures are
  disabled; swiping up or down on the channel name zaps to the next or previous channel.

### N-05 · Picture-in-Picture
- **What:** leaving the app during playback (the home button, or the PiP button in the player)
  continues in PiP, for VOD and live.
- **Acceptance:** PiP shows play/pause; returning to the app restores the full player at the same
  position.

### N-06 · Background audio (setting, off by default)
- **What:** when on, audio continues with the screen off or the app in the background, with media
  notification controls. It suits radio-like live channels.

### N-07 · Next episode
- **What:** in the last 30s of an episode, or at the end credits if the playlist provides no
  markers, show a "Next episode" card with a 10s countdown. Autoplay can be turned off in Settings.
  Parity: the TV app may already have a next-episode behaviour (player.md). If so, keep its rules
  and only restyle it.

### N-08 · Share
- **What:** the share sheet on details pages shares the title and year as text. It must never
  share a stream URL or credentials.

### N-09 · Pull to refresh
- **What:** pull to refresh on Home, Live, Movies and Series re-syncs the active playlist. It is the
  same action as the TV app's refresh button, with the same rules (business-rules.md).

## v2 (do not build in v1; keep the architecture open for them)

| Id | Feature | Note |
|---|---|---|
| N-20 | Chromecast | `react-native-google-cast`; Stalker links and headers complicate it |
| N-21 | HLS downloads | Media3 DownloadManager through a native module |
| N-22 | Device-local profiles | a separate My List, Continue Watching and parental level per profile |
| N-23 | Android TV build | the same code base, a D-pad focus layer |
| N-24 | Reminders for EPG programmes | local notifications |
| N-25 | Home screen widgets / app shortcuts | for example "Continue watching" |
