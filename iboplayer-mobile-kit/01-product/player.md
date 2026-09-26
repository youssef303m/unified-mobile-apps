# Player: video playback spec for IBOPlayer mobile

This file describes how the IBOPlayer smart-TV app plays video today, so that the React Native Android phone app ("IBOPlayer mobile") can rebuild the same behaviour. The phone app will most likely use react-native-video on ExoPlayer/Media3. You do not need the TV code: everything that matters is written here. Short "Source:" notes name the TV files each fact comes from, for traceability only.

Words used below:

- **Xtream** (`playlist_type === "xc"`): an Xtream-Codes panel. We have `api_host_url`, `user_name`, `password`.
- **M3U** (`playlist_type === "general"`): a plain M3U playlist. Every item carries its own `url`.
- **Stalker** (`playlist_type === "stalker"`): a MAG/Ministra middleware portal. Stream URLs are created on demand with `create_link`.
- **Parity**: the TV app already does this, so the phone app must match it. **New**: a phone-only addition.
- `storage_id` for iboplayer is `gz3rYzUIC7_`. Every localStorage key below starts with it.

---

## 1. What gets played, and how the URL is obtained

All playback goes through one player object. The call sequence is `media_player.close()` → `media_player.init(videoElementId, pageId)` → `media_player.playAsync(proxiedMediaUrl(url))`.

`proxiedMediaUrl(url)` returns the URL unchanged unless the optional **Stararcs smart proxy** is switched on. With the proxy on, it prefixes the URL:
`"http://<proxyServer>:8080/?mimo_proxy_token_765=<TOKEN>&mimo_proxy_target_765=" + url`.
The target URL is appended raw, not URL-encoded. The token is an app constant, deliberately left out of this file. The server comes from the user's region/country/server choice. See §7. Source: common.js `proxiedMediaUrl`, api.js `updateProxyURL`.

### 1.1 URL formats

| Content | Xtream | M3U | Stalker |
|---|---|---|---|
| Live channel | `{api_host_url}/live/{user}/{pass}/{stream_id}.{ext}` (rule for `ext` below) | `channel.url` | `create_link` with `type=itv`, `cmd=channel.cmd` → token URL |
| Movie | `{api_host_url}/movie/{user}/{pass}/{stream_id}.{container_extension}` | `movie.url` | `create_link` with `type=vod`, `cmd=movie.cmd`, `series=movie.series`, `forced_storage=movie.storage_id` |
| Episode | `{api_host_url}/series/{user}/{pass}/{episode.id}.{episode.container_extension}` | `episode.url` | `createSeriesStreamUrl(cmd, series, storage_id)` → `create_link` |
| Catch-up (archive) | `{api_host_url}/streaming/timeshift.php?username={user}&password={pass}&stream={stream_id}&start={YYYY-MM-DD:HH-mm}&duration={minutes}` | not supported (empty URL) | `create_link` with `type=itv`, `timeshift=1`, `arc_start`, `arc_stop` (unix seconds), then a cascade of other `tv_archive` parameter shapes; if every shape fails, the **live** URL is played instead |
| Trailer | YouTube video ID from Xtream `get_vod_info` → `info.youtube_trailer`, played in the YouTube IFrame player | n/a | n/a |

**Live extension rule** (Xtream only). The code calls `getMovieUrl(id, "live", "ts")`:

- If the `stream_format` setting is not `"default"`, its value is the extension. In practice it is always `"default"`, because no screen lets the user change it.
- Otherwise the app reads the `output=` query parameter of the playlist's original URL. `mpegts` or `ts` gives `.ts`; `hls` or `m3u8` gives `.m3u8`. Anything else keeps `.ts`.
- So live channels play **MPEG-TS over HTTP by default**.

Source: common.js `getMovieUrl`.

**Catch-up start time** (Xtream). The EPG programme start is parsed in the display time format (`Y-MM-DD HH:mm`, or `Y-MM-DD hh:mm A` for the 12-hour format). The app subtracts `time_difference_with_server` minutes to convert it back to server time, then formats it as `YYYY-MM-DD:HH-mm`. `duration` is stop minus start, in minutes. Source: Models/LiveModel.js `getProgrammeVideoUrl`.

**Catch-up programme list.**

- Xtream: `player_api.php?username=&password=&action=get_simple_data_table&stream_id=`. Keep only items with `has_archive != 0` whose start and stop are both in the past.
- Stalker: `getFullEPG(stream_id, 100)`. Keep only past programmes.
- Only channels with `tv_archive != 0 && tv_archive_duration != 0` appear in the catch-up ("replay") section.

Source: vod_series_page.js, stalker_integration.js `loadStalkerCatchupEPG`, search_page.js `getReplayCategories`.

### 1.2 Stalker links are fetched just before playback

- Each play asks the portal for a fresh link: `create_link`, with `disable_ad=0`, `download=0`.
- The reply is cleaned. Prefixes such as `ffmpeg `, `ffrt `, `ffrt2 `, `ffrt3 ` and `auto ` are stripped, and `%mac%` is expanded.
- For MAG-internal `http://localhost/...` stubs, the real URL from the portal is preferred.
- If the reply has an empty `stream=` but carries a `play_token=`, the fresh token is spliced into the channel's own `cmd`.
- Links are **short-lived, token-stamped URLs** (`play_token=...`).
- Live requests carry a generation counter. When the user zaps again before the link returns, the late link is thrown away.
- A session keepalive (`watchdog.get_events`) runs every 90 s while on the live page, and stops when the user leaves the page.

**Important gap in the TV app:** the reconnect loop (§6) replays the **same URL**. It never asks for a new Stalker link. The phone app should call `create_link` again before each retry. Treat this as **new**, recommended behaviour.

Source: StalkerClient.js, stalker_integration.js `channelPlayLive`, `prepareStalkerVodPlayerUrl`.

### 1.3 Other per-type facts

- **Live** runs on the channel page. It has two modes (§3.2):
  - **preview**: small video beside the channel list;
  - **full screen**.
  Each successful live play adds the channel to "recent", except adult/protected channels. The recent list is stored at `gz3rYzUIC7_{playlistId}live_recent` (note: no `_` before `live`). The newest ID comes first.
- **Movie, episode and catch-up** all run on one "VOD player" page, entered as `movie_type` = `movie`, `series` or `epg`. Catch-up is seekable. Only movies and episodes save a resume position.
- **Trailer**: YouTube IFrame, `videoId = youtube_trailer`.
  - The "Watch Trailer" button is **hidden on Samsung and LG** and shown on the other TV platforms.
  - If YouTube reports an error (removed, private or not embeddable), the app returns and shows the toast "No trailer video available". The same toast shows when the YouTube API script is not loaded.
  - Keys: LEFT/RIGHT seek −5/+5 s, OK toggles play/pause, BACK closes.
  - Mobile: use `react-native-youtube-iframe` or a WebView. Opening the YouTube app is also fine.

  Source: trailer.js, vod_summary.js.

---

## 2. Engines, fallback chain, watchdog, retries

### 2.1 TV engines

| Kind | What it is | Where |
|---|---|---|
| `avplay` | Samsung Tizen native player (hardware demux, plays MKV/MP4/TS/HLS) | Samsung only; it is what "native" means there |
| `native` | HTML5 `<video><source src=url>` | every non-Samsung TV |
| `hls` | hls.js over MSE | all platforms |
| `shaka` | Shaka Player over MSE; its script is lazy-loaded on first use | all platforms |
| `mpegts` | mpegts.js over MSE, always created with `isLive: true` | all platforms |

### 2.2 Chain building (runs on every `playAsync`)

Inputs:

- `settings.media_player_type`: `native` (default), `hls`, `shaka` or `mpegts`;
- `settings.auto_switch_player`: `off` (default) or `on`;
- the URL path in lower case, with query and fragment removed;
- whether this is the live page.

Rules:

1. **Complete-file containers**: the path ends in `.mkv .mp4 .m4v .mov .avi .wmv .webm .3gp .mpg .mpeg`. The chain is `[native]` only (`[avplay]` on Samsung). No fallback.
2. **Neither `.m3u8` nor `.mpd`**. This covers live `.ts` and the extension-less catch-up `timeshift.php`.
   - Auto on, live page: `native → mpegts → hls`.
   - Auto on, VOD/catch-up page: `native → hls → mpegts`. mpegts.js is forced to live mode, which breaks seeking, so it goes last.
   - Auto off: the base order is `mpegts → hls → native`, and the user's pick moves to the front.
3. **`.m3u8`**: capable players are `hls → shaka → native`. Shaka is included only if it is already loaded or the user picked it. The user's pick moves to the front.
4. **`.mpd`**: `shaka → native`. With auto on, the order stays Shaka-first.

The chain lives only for that one play. The saved setting is never changed by a fallback.

### 2.3 Advancing the chain vs. recovering in place

- **Before the first frame**, any fatal error moves silently to the next player. Fatal errors include: `prepareAsync` failure, a `<source>` error, a fatal hls.js error, a Shaka load rejection or CRITICAL error, and an mpegts error.
- **First-frame watchdog**: every attempt gets **12 000 ms** to fire its first `playing` event (Samsung: `prepareAsync` success). Missing the deadline counts as a failure and moves to the next player. The watchdog is not armed on the last player in the chain.
- **After playback has started**, errors never switch engine. hls.js first tries `startLoad()` for network errors or `recoverMediaError()` for media errors. Otherwise the reconnect loop runs.
- **Chain exhausted**: the loader hides, the error image shows (`.video-error`, a static "no video" picture) and the reconnect loop starts.

### 2.4 Reconnect loop (`tryReconnect`)

- Delay **6000 ms**, then `playAsync(sameUrl)`, which rebuilds the whole chain.
- **Maximum 10** attempts (`reconnect_max_count`). When the counter reaches 10, the loop stops and the "Reconnecting..." label hides. The error image stays on screen. There is no final toast and no retry button.
- A "Reconnecting..." label shows over the video during the loop.
- The counter resets only after the stream has **played for 5 s of wall-clock time** since the last successful load (non-Samsung). Samsung resets it on `prepareAsync` success. The 5 s rule stops a load→error→load cycle from repeating forever.
- On the VOD page, each reconnect first remembers the current position, so the reload seeks back to it. See §4.4.

### 2.5 Buffer settings on TV (for reference)

- **hls.js**: `maxBufferLength 60`, `maxMaxBufferLength 120`, `maxBufferSize 60 MB`, `backBufferLength 30`, `liveSyncDurationCount 5`, `liveMaxLatencyDurationCount 15`, `abrEwmaDefaultEstimate 5 Mbps`, `abrBandWidthFactor 0.9`, `abrBandWidthUpFactor 0.7`, `nudgeMaxRetry 5`, `lowLatencyMode false`.
- **Shaka**: `bufferingGoal 60`, `rebufferingGoal 4`, `bufferBehind 30`, retries 5 with a 500 ms base delay.
- **AVPlay**: 5 s buffer before play.
- **mpegts.js**: `lazyLoadMaxDuration 180`, `seekType "range"`.
- No user-facing buffer setting exists.

Source for §2: mediaPlayer.js.

### 2.6 What the phone app should do instead

Use **one engine: Media3/ExoPlayer**, through react-native-video v6+. It plays HLS, progressive MP4/MKV/WebM/MPEG-TS/MPEG-PS/FLV and AVI natively, and DASH through its DASH module. The TV's multi-engine chain exists only to work around TV browser limits. Keep its *spirit*:

1. **Give ExoPlayer an explicit type when the URL gives no hint.**
   - `.m3u8` → HLS (`type: 'm3u8'`);
   - `.mpd` → DASH;
   - everything else → progressive (ExoPlayer sniffs the container: TS, MP4, MKV...).
   - Extension-less URLs, such as `timeshift.php` and many Stalker links, can be either TS or HLS. Mini-chain: try progressive first; if it fails before the first frame, retry once as HLS; optionally, check the start of the response for `#EXTM3U`. This matches the TV's "native → hls" auto order.
2. **Keep a first-frame watchdog** of about 12 s. Use it to trigger the progressive↔HLS switch or the optional secondary engine below.
3. **Keep the reconnect loop**: 6 s delay, at most 10 attempts, counter reset after 5 s of healthy playback. For live, reconnect from the live edge. For VOD, seek back to the last position (§4.4). Re-resolve Stalker links before each retry.
4. **Formats that need care:**
   - **Raw MPEG-TS over HTTP (the default for live).** ExoPlayer plays it as an unbounded progressive stream (TsExtractor). No live-edge management: if the stream stalls, reconnect. Set `DefaultExtractorsFactory.setTsExtractorFlags(FLAG_ALLOW_NON_IDR_KEYFRAMES | FLAG_DETECT_ACCESS_UNITS)` so playback starts quickly on IPTV streams.
   - **AC3/E-AC3/DTS/TrueHD audio** (common in MKV movies and some live channels). Most phones have no decoder for it, so the video plays silent or fails. Ship the Media3 **FFmpeg audio extension** (`decoder_ffmpeg`, `EXTENSION_RENDERER_MODE_PREFER`). This needs a custom react-native-video build or a native module. Alternative: libVLC (`react-native-vlc-media-player`) as a secondary engine for "unsupported format" failures. That secondary engine would mirror the TV's fallback chain.
   - **HEVC/H.265**: hardware-decoded on most phones since about 2016. 10-bit HEVC and Dolby Vision vary by device. On a decoder error, fall back to VLC if you add it.
   - **WMV/ASF**: not supported by ExoPlayer. VLC is the only option.
   - **MKV embedded subtitles**: SRT/SSA are shown (SSA styling is basic); PGS is supported; VobSub is not.
   - **Cleartext HTTP**: almost all IPTV URLs are `http://`. Android 9+ blocks cleartext by default, so set `android:usesCleartextTraffic="true"` or a network security config. This is mandatory.
   - **Servers that ignore HTTP Range**: seeking silently fails. Keep the seek verification in §3.1.
5. **Buffering on mobile**: use `bufferConfig` of roughly `minBufferMs 15000`, `maxBufferMs 60000`, `bufferForPlaybackMs 2500`, `bufferForPlaybackAfterRebufferMs 5000`. This is close to the TV's 60 s forward buffer while starting faster.

---

## 3. Player UI and controls

### 3.1 VOD player (movie, episode, catch-up) on TV

Source: vod_series_player.js, html/pages/vod_series_player_page.html, dialogs/video_resume_dialog.html.

**Overlays**

- **Title** at the top. Movie: `name`. Episode: `title`. Catch-up: programme title plus `HH:mm~HH:mm`.
- **Loader** spinner while buffering. **Error image** on failure. **"Reconnecting..."** label during the retry loop.
- **Subtitle text** container. Its styling is in §5.
- **Autoplay toggle** at the top: "Autoplay is on" / "Autoplay is off". It writes the global setting `auto_play`.
- The **control bar slides in** on any key and **auto-hides after 10 s**. It is shown when the video starts.

**Main buttons (left to right)**

1. **Previous**: previous item of the source list. See "next/previous source" below.
2. **Rewind −30 s**.
3. **Play/Pause**.
4. **Forward +30 s**.
5. **Next**: next item.

**Info buttons**

1. **Subtitles**: opens a 3-column modal, described in §5.
2. **Audio track**: list with radio buttons plus OK/Cancel.
3. **Aspect ratio**: Stretch, 16:9 Standard, 4:3 Traditional, 21:9 Ultra widescreen, 1:1 Square. The choice is not saved and applies to the current video only. The default is fit (contain).
4. **"Other in category"**: a grid of the category the user came from, loaded 40 at a time. Picking an item opens that item's detail page. Hidden for catch-up.
5. **Quick Seek**: the user types a minute number. The OK button reads "Seek to HH:MM:SS". If the value is past the end, it shows "Too long — max is HH:MM:SS". Hidden for catch-up.

**Progress bar**

- Shows current time and total time (format `HH:MM:SS`, or `MM:SS` under one hour).
- It can be dragged. With the remote, LEFT/RIGHT on the bar seeks ±30 s.

**Episode strip**

- Shown when the player was opened from a season's episode list.
- Each entry has a thumbnail (fallback: the series backdrop, then the cover), the episode number and the title.
- Picking an episode saves the current progress and starts that episode.

**Remote keys**

- FF/REW: ±30 s. PLAY/PAUSE/PLAYPAUSE: as labelled.
- BACK with the controls visible hides them. BACK with the controls hidden shows **"Do you want to exit?" Yes/No**.
- STOP behaves like BACK.

**Next/previous source**

The next or previous item depends on where the player was opened:

- the movie list of a category;
- the episodes of the current season;
- the catch-up programmes of that day;
- search results.

When the list runs out:

- manual Next/Previous stops at the first or last item and does nothing;
- when a video *ends by itself*, the player closes back to the list.

Samsung only: rewinding past 0 plays the previous item, and forwarding past the end plays the next one.

**End of video**

- `auto_play = off` (the default): playback stops and the controls appear.
- `auto_play = on`: the next item starts at once. There is **no countdown** on TV.
- Calls are debounced for 1 s so the end event cannot skip two items.

**Seek verification** (important for Xtream/M3U portals that ignore Range)

1. After every seek, the app polls the real position every **250 ms** for up to **4 s** (6 s on AVPlay). The seek succeeds if the position lands within **±3 s** of the target, plus the time that has passed.
2. Seek targets are clamped to `[0, duration − 5 s]`, so a seek never lands exactly on the end and triggers "ended".
3. Several quick presses add up. A pending target stays authoritative for 3 s, so three +30 s presses give +90 s.
4. If the seek fails, the app does **one** reload of the URL plus a re-seek (movie/episode only). If that also fails, the UI jumps back to the real position.
5. If the seek itself **killed the stream** (element error), seeking is disabled for the rest of the session. Every later seek attempt shows the toast "Seeking unavailable — This provider does not support skipping in this movie."
6. Quick Seek failure shows the toast "Seek failed — Could not jump to that position."

**Unused overlay**: an info overlay (`#vod-video-info-container`: poster, title, description) exists in the markup, but no code opens it. Ignore it.

### 3.2 Live player on TV

Source: channel_operation.js.

**Preview and full screen**

- OK on a channel starts it in the **preview** window. OK on the playing channel again goes **full screen**.
- After **15 s** with no input on the channel list, the app zooms to full screen by itself.
- BACK in full screen returns to preview.

**Full-screen info bar**

- Shows the channel number, logo and name, a clock (`hh:mm A`), EPG progress, the video resolution (`W x H`), and four buttons: EPG, Previous, Next, Audio.
- It shows on zap or key press and auto-hides after **7.5 s**.
- As observed in code, OK on any of the four buttons just leaves full screen. The buttons do not act on their own.

**Zapping**

- UP/DOWN or CH+/CH− in full screen move to the next or previous channel within the current category. The move clamps at the ends; it does not wrap.
- Playback starts after a **400 ms** debounce, so fast presses skip channels without starting each one.

**Number entry**

- Digits typed in full screen build a channel number. After **2 s** the app jumps to the channel whose `num` matches.
- If none matches, it shows the toast "Channel does not exist".

**Channel nav strip** (LEFT/RIGHT in full screen)

- A horizontal strip of the category's channels, plus Now/Next/Later EPG.
- Settings buttons:
  - **Aspect ratio**: same five options. It resets to **Stretch** on every channel change.
  - **Subtitles**: embedded tracks, plus Off.
  - **Audio**: embedded tracks; "Default" when there are none.
  - **Favourite**: star.
- The strip auto-hides after **5 s**.

**Behaviour gaps**

- There is **no pause/timeshift on live**. The PLAY/PAUSE keys call a function that does not exist, so they do nothing.
- There is no seek bar on live.

**Opening channel** (`live_initialization_choice`), see §7:

- `default`: the third category, or the first non-empty one, and its first channel;
- `last`: the most recent channel;
- `favorite`: the first favourite.

### 3.3 Recommended mobile player UI

| Mobile control | Parity/New | Notes |
|---|---|---|
| Tap to show/hide controls, auto-hide after 10 s VOD / 7.5 s live | Parity | Same timeouts |
| Play/Pause, ±30 s buttons, seek bar with drag and time labels | Parity | Keep ±30 s on the buttons |
| Double-tap left/right to seek −10/+10 s, taps add up | New | Reuse the "pending target" rule so taps sum |
| Previous/Next item buttons (same source-list rules) | Parity | |
| Episode strip / episode sheet | Parity | Bottom sheet on phone |
| "Other in category" | Parity | Optional; a sheet |
| Quick Seek (minute entry) | Parity | Could become "go to time" in a dialog |
| Autoplay toggle in the player | Parity | Global `auto_play` setting |
| Next-episode countdown card ("Next episode in 10 s", Cancel) at end or during the last ~20 s | New | Only when autoplay is on; the TV jumps with no countdown |
| "Skip intro" | New, optional | No data source exists; skip unless the provider gives markers |
| Audio track picker | Parity | |
| Subtitle sheet: language, colours, size, position, delay | Parity | §5 |
| Aspect: Fit / Fill (crop) / Stretch / 16:9 / 4:3 (+ 21:9, 1:1) with pinch to toggle Fit↔Fill | Parity + New (pinch) | `resizeMode` contain/cover/stretch; fixed ratios need a wrapper view |
| Swipe up/down on the left half = brightness, right half = volume | New | Window brightness, media volume |
| Screen lock (ignores touches until unlocked) | New | |
| Picture-in-Picture (auto on Home) | New | react-native-video `enterPictureInPictureOnLeave` |
| Orientation: VOD in landscape (sensor), live in portrait with a list or full-screen landscape | New | Portrait live = the TV's "preview" mode; rotate or tap for full screen |
| Playback speed 0.5–2× | New | TV has none; VOD only |
| Live: swipe or buttons for next/previous channel, 400 ms debounce | Parity | |
| Live: channel number entry | Drop (low value on phone) | Optional |
| Live info bar (logo, number, name, clock, Now/Next EPG, resolution) | Parity | |
| Keep screen on while playing; background audio off by default | New | |
| Exit confirmation "Do you want to exit?" | Drop on phone | System back leaves the player; saving still happens |
| Resume prompt | Parity | §4.3 |

---

## 4. Resume / continue watching

Source: vod_series_player.js (`trackProgress`, `saveVideoTime`, `showResumeBar`), Models/VodModel.js, Models/SeriesModel.js.

### 4.1 Storage keys and shapes

`{playlistId}` is the ID of the active playlist.

**Movies**, key `gz3rYzUIC7_{playlistId}_saved_vod_times`:

```json
[ { "stream_id": "12345", "time": 1834.2, "duration": 6120.5 } ]
```

**Series**, key `gz3rYzUIC7_{playlistId}_saved_series_times`:

```json
[ { "stream_id": "678",            // series_id
    "video_times": {
      "0": { "3": { "time": 512.0, "duration": 2600.0 } },  // seasonIndex -> episodeIndex -> progress
      "recent": { "ep": 4, "s": 1 }  // last watched, 1-based
    } } ]
```

- Season and episode keys are **0-based positions** in the seasons and episodes arrays. They are not season or episode numbers.
- **Units**: `time` and `duration` are **seconds** on every platform except Samsung, which stores **milliseconds**. The phone app has its own storage, so pick seconds, or better, milliseconds as integers, and document the choice. Do not try to read TV data.
- The "Continue watching" (recent) rows on the home and category pages are built from these lists: VOD and series IDs that have an entry.

### 4.2 When and what is saved

Only movies and episodes are saved. Live and catch-up never are. Items in an adult category are never saved.

**While playing** (every time update):

- A write happens at most once every **60 s**.
- No write happens while the resume prompt is on screen, or while a position restore is in progress.
- The position must be at least **10 s** in, and at least **10 s** before the end.

**On exit, next/previous, or episode switch** (`saveVideoTime`):

- If `duration − position ≥ 10 s` and `position ≥ 10 s`: save it, and add the movie or series to the recent ("watch") list.
- If `duration − position < 10 s`: treat it as **finished**. Remove the entry (for series, that episode only; the series leaves "recent" when no episodes remain). Remove it from recent too, and from the Stalker server-side recent list.
- If `position < 10 s` and not finished: nothing is saved or removed.

**Bookmark protection**: after a failed restore (playback restarted from 0), saving stays blocked until playback passes the old bookmark. Early viewing therefore cannot overwrite it.

### 4.3 Resume prompt

- The resume time is looked up when the player opens: movie by `stream_id`, episode by series ID + season index + episode index.
- The prompt appears when the media is ready (first loaded data), if the resume time is greater than 0.
- Dialog: **"Continue from where you left"** / "Do you want to resume the playback from the last position?" / the time `HH:MM:SS` / **Yes** · **No**. It opens with Yes focused.
- **Yes** seeks, with verification. **No** or BACK plays from 0.
- The dialog **auto-closes after 15 s** without resuming. That counts as No.
- If another modal is open (subtitles, audio...), the prompt waits until that modal closes.
- If the stream cannot seek, no prompt is offered.
- **Restore failure** shows the toast "Resume failed — Could not jump back to your last position. Playing from the start." and offers the dialog again so the user can retry.
- Mobile: show the same dialog, or a "Resume from 30:34 / Start over" sheet. Parity.

### 4.4 Automatic restore after a reconnect

- When the stream drops mid-VOD, the last known position becomes the restore target. After the reload, the app seeks there silently, without a dialog.
- There is at most **one** automatic restore attempt in a row. The budget resets after a successful restore. A 20 s watchdog clears a restore that never completes.
- Keep this on mobile. Media3 recovers from many network errors by itself; this logic is for full reloads.

---

## 5. Audio and subtitle tracks

### 5.1 Audio

- The list comes from the engine's tracks: `audioTracks` on HTML5, `getTotalTrackInfo` on AVPlay.
- Labels are language codes mapped to names through a code→name table (`language_codes`). Tracks without a language show as "Track N" (live: "Audio N").
- AVPlay removes duplicate languages.
- The choice applies to the current video only. It is **not saved**, and there is **no preferred-audio-language setting**. The default is the stream's default track.
- With no tracks, the toast "Sorry — No Audios exist" shows.
- The picker refuses to open before the media is ready: toast "Video not loaded yet".
- Mobile: react-native-video `onAudioTracks` plus `selectedAudioTrack`. A **new**, optional addition: remember the last picked language and prefer it (Media3 `preferredAudioLanguage`).

### 5.2 Subtitles on VOD: three-column modal

**Column 1, languages.**

- Samsung shows the **embedded** tracks.
- Every other TV platform shows **external SRT subtitles from ibosub.com** (§5.3). It never shows embedded text tracks on the VOD page.
- The first row is OFF. Languages are grouped (several files per language; the first file is used), sorted by label, and **the app language is moved to the top**.
- A loader shows while the lookup runs. If nothing is found, the column reads "No subtitles found".

**Column 2, colours** (saved globally):

- Text colour: White `#ffffff` (default), Black `#000000`, Yellow `#ffe000`, Green `#26d367`, Cyan `#39d5e0`, Red `#e02323`.
- Background: None `transparent` (default), Black `#000000`, Semi Black `rgba(0,0,0,0.6)`, White `#ffffff`, Red `#950606`, Blue `#1d528f`.
- Arrows cycle through the palette and wrap around.

**Column 3, settings:**

- **Delay**: −60…+60 s in 1 s steps, default 0. It resets for every video and is **not saved**. Positive values show subtitles *later*. It works only on the SRT subtitles the app renders itself, so it is hidden on Samsung.
- **Size**: 20–80 px in steps of 5, default **50**. It is applied as `font-size: size/16 rem`. Saved.
- **Vertical position**: 0–50 % from the bottom in steps of 5, default **5**. Saved.

Changes apply live, through `applySubtitleStyles()`: font size, colour, background colour, bottom %.

**Cue rendering.** Only `<i> <b> <u> <br>` tags are kept. Other tags are stripped and their text kept, and the text is HTML-escaped.

**Live subtitles**: the live page shows embedded tracks only (Off + tracks). There is no ibosub lookup.

### 5.3 External subtitles: where they come from

Source: vod_series_player.js `loadSubtitleLanguages`, `getMovieDetail`, `getTmdbID`, `getSubtitlesForLG`, `applySubtitleIndex`.

The lookup runs **once per video**, the first time the subtitle modal opens. It is not prefetched.

**1. Find the TMDB ID.**

- Movie: use `movie.tmdb_id` or `movie.tmdb`.
- Otherwise, on Xtream, call `player_api.php?...&action=get_vod_info&vod_id={stream_id}` and use `info.tmdb_id`.
- Otherwise search TMDB: `GET https://api.themoviedb.org/3/search/movie?api_key={key}&query={name}`, or `/search/tv` for series. The key comes from the app config and can be overridden by the backend.
  - The name is `info.o_name`, else `info.name`, else the item name, cleaned by `getRealMovieName`, which strips year, country and quality tags. The cleaned name is lower-cased.
  - One result: take it.
  - Several results, movie: match `release_date` against `info.releasedate`; otherwise take the result only if exactly one title is contained in the cleaned name.
  - Several results, series: take the result if exactly one `name` or `original_name` matches, or if the overview equals the series plot.
- Series: use `current_series.tmdb` or `info.tmdb`, or the episode's `info.tmdb_id`, otherwise search.

**2. List the subtitles.** `POST https://ibosub.com/api/get-subtitles-update`, form-encoded:

- movie: `{ tmdb_id }`
- episode: `{ movie_type: "episode", season_number, episode_number, tmdb_id: <series tmdb>, episode_tmdb_id? }`
  - `season_number` falls back to season index + 1 and `episode_number` to `episode_num` or index + 1.
  - If there is no series TMDB ID but the episode has one: `{ movie_type: "episode", episode_tmdb_id }`.

Response:

```json
{ "status": "success",
  "subtitles": [ { "file_id": 123, "language": "en" } ],
  "srt_map": { "123": "<srt text>" },
  "movie_list_id": 42 }
```

Other fields per subtitle may exist. The `srt_map` may already hold some contents.

**3. Fetch one file**, when it is not already in `srt_map`: `POST https://ibosub.com/api/get-single-subtitle-content` with `{ movie_list_id, file_id }`. The reply is `{ "status": "success", "content": "<srt text>" }`. It is cached per video. On error, the toast "Something error caused while downloading subtitles for current language, please try again later" shows.

Any failure in steps 1–3 leaves the list empty ("No subtitles found"). The colour and size columns still work. Late replies for a previous video are dropped by a request ID.

### 5.4 SRT parsing and sync (reproduce exactly)

Source: srt_parser.js, srt_operation.js.

**Parsing**

- Remove `\r`. Split with `/(\d+)\n(\d{1,2}:\d{2}:\d{2},\d{1,3}) --> (\d{1,2}:\d{2}:\d{2},\d{1,3})/g`.
- If that yields nothing, retry with `.` as the millisecond separator.
- Each group gives `{id, start, end, text}`. Text is trimmed.
- Timestamps are normalised: `.`→`,`, h/m/s padded to 2 digits, ms padded at the end or cut to 3 digits. Example: `0:00:28.9` → `00:00:28,900`.
- Converted to seconds: `h*3600 + m*60 + s + ms/1000`.
- Empty input gives no cues. WebVTT is not supported.

**Sync**

- On every time update, the app compares `videoTime + offset` with the current cue.
  - Inside the cue: show it.
  - Past its end and before the next cue: clear.
  - Inside the next cue: advance by one.
  - Further away (seek or jump): binary-search the cue whose `[start, end)` contains the time, or else the last cue that starts before it.
- After any seek, a 200 ms delay, then re-search from the real position.

**Offset**

- `offset = −delay`, as an **integer** (`parseInt`), so the delay is whole seconds.
- Applying the offset clears the cue on screen and re-searches.
- Loading a new file resets the offset, so the chosen delay is applied again afterwards.

**Mobile**: the simplest route to exact parity, including the delay, is a **custom overlay**:

- parse SRT in JS as above;
- drive it from `onProgress` with `progressUpdateInterval` of about 100–250 ms;
- render a Text view with the saved style.

Media3 side-loading (`textTracks`, `application/x-subrip`) works, but makes live delay and custom colours harder. Use Media3 rendering for **embedded** tracks; offer them next to the ibosub languages (New: the TV shows embedded tracks only on Samsung).

---

## 6. Errors, messages, retries

**On-screen states (VOD and live)**

- Loader GIF while opening or buffering.
- Error image when the chain is exhausted or a mid-stream error happens.
- "Reconnecting..." (`reconnecting`) during the 6 s × 10 retry loop.

**Stalker failure** (`showPlaybackFailed`): no link, or the portal call fails. The loader hides, the error image shows, and a toast appears: "Sorry — This stream could not be started. Please try again later." For VOD, the toast is skipped if the user already left the player. There is no automatic re-request.

**Toasts** (title — message). The key is in parentheses; texts are the English strings:

| Key(s) | English |
|---|---|
| `sorry` + `msg_stream_could_not_be_started` | Sorry — This stream could not be started. Please try again later. |
| `seeking_unavailable` + `msg_this_provider_does_not_support_skipping_in` | Seeking unavailable — This provider does not support skipping in this movie. |
| `resume_failed` + `msg_could_not_jump_back_to_your_last` | Resume failed — Could not jump back to your last position. Playing from the start. |
| `seek_failed` + `msg_could_not_jump_to_that_position` | Seek failed — Could not jump to that position. |
| `msg_video_not_loaded_yet` | Video not loaded yet |
| `msg_no_audios_exist` | No Audios exist |
| `msg_something_error_caused_while_downloading_subtitles_for` | Something error caused while downloading subtitles for current language, please try again later |
| `no_subtitles_found` | No subtitles found |
| `msg_no_trailer_video_available` | No trailer video available |
| `msg_channel_does_not_exist` | Channel does not exist |
| `msg_no_archive_video_available_for_this_programme` | No archive video available for this programme |
| `msg_no_epg_archive_available_for_this_channel` | No EPG archive available for this channel |
| `msg_no_epg_available_for_current_channel` | No Epg Available for current channel |
| `msg_something_went_wrong_or_no_epg_available` | Something went wrong or no EPG available for this channel |
| `msg_failed_to_load_epg_for_this_channel` | Failed to load EPG for this channel |
| `msg_too_long_max_is` | Too long — max is |
| `msg_seek_to` | Seek to |

**Player labels**

- `reconnecting` "Reconnecting...", `resume` "Continue from where you left", `resume_video` "Do you want to resume the playback from the last position?", `exit_confirm` "Do you want to exit?", `yes`/`no`, `ok`/`cancel`.
- `autoplay_off` "Autoplay is off". "Autoplay is on" is hard-coded in the code.
- `aspect_ratio` "Aspect Ratio", `stretch` "Stretch", `aspect_standard` "Standard", `aspect_traditional` "Traditional", `aspect_ultra_widescreen` "Ultra widescreen", `aspect_square` "Square".
- `subtitle` "Subtitle", `subtitles` "Subtitles", `subtitle_off` "Off", `subtitles_languages` "Subtitles Languages", `subtitles_colors` "Subtitles Colors", `subtitles_settings` "Subtitles Settings", `text_color` "Text Color", `background_color` "Background Color", `subtitle_delay` "Delay", `size` "Size", `subtitle_vertical_position` "Vertical Position".
- `audio` "Audio", `audio_track` "Audio Track".
- `quick_seek` "Quick Seek", `quick_seek_desc` "Enter the exact minute number to jump to", `minute` "Minute", `min_short` "min".
- `other-in-category` "Other in category", `watch_trailer` "Watch Trailer", `epg` "EPG", `now`/`next`/`later`, `previous`.

**Mobile recommendations (new)**

- After the 10th failed retry, replace the silent error image with a clear state: "Can't play this stream" + **Retry** + (live) **Next channel**.
- Map ExoPlayer error codes to plain messages:
  - HTTP 401/403 → "Access denied / subscription or connection limit";
  - 404 → "Stream not found";
  - decoder errors → "This format isn't supported on your device".
- Re-resolve Stalker links on each retry.

---

## 7. Playback-related settings

All settings are stored as `gz3rYzUIC7_<key>` (a global value, not per playlist). Source: settings.js, settings_page.js.

| Key | Values (default) | Effect | Mobile |
|---|---|---|---|
| `media_player_type` | `native` \| `hls` \| `shaka` \| `mpegts` (`native`) | Engine placed first in the fallback chain (§2.2) | Replace with an optional "Player engine: Auto / ExoPlayer / VLC" only if VLC ships; otherwise drop |
| `auto_switch_player` | `off`/`on` (`off`) | Ignore the manual pick; the stream type decides the order | Default behaviour on mobile (always "auto") |
| `stream_format` | `default` \| `ts` \| `m3u8` (`default`) | Xtream live extension (§1.1). **No UI on TV**; always `default` | Worth exposing as "Live stream format: Auto / TS / HLS" (New); HLS is often more robust on mobile networks |
| `auto_play` | `off`/`on` (`off`) | Advance to the next movie or episode at the end | Parity; add the countdown |
| `subtitle_size` | 20–80 (50) | Subtitle font size | Parity (scale for phone DPI) |
| `subtitle_text_color` | palette (`#ffffff`) | | Parity |
| `subtitle_bg_color` | palette (`transparent`) | | Parity |
| `subtitle_position` | 0–50 % (5) | Distance from the bottom | Parity |
| `subtitle_bg` | legacy preset | Only migrated into the two colours | Ignore |
| `live_initialization_choice` | `default` \| `last` \| `favorite` (`default`) | Which channel starts when Live opens | Parity |
| `smart_proxy_connection_state`, `smart_proxy_region`, `smart_proxy_country`, `smart_proxy_server` | false / indexes | Wrap every media URL with the Stararcs proxy (§1) | Parity if the proxy feature is kept |
| `language` | app language | Subtitle language sorted first | Parity |
| `tmdb_choice` | `on`/`off` | Metadata only (not playback) | n/a |

The Settings screen shows these playback items:

- "Media Player" (Native/HLS/Shaka/MPEGTS + "Auto Switch Player" toggle). Help text: "Choose how video is played. Native uses the device player. HLS uses HLS.js. Shaka uses Shaka Player. MPEGTS uses mpegts.js for raw TS streams and falls back to HLS automatically. Turn on Auto Switch Player to ignore the choice below and let the app pick the player from the stream being played."
- "Subtitle Settings" (size + colours + preview "This is how subtitles will look like").
- "Live Initialization" (Default/Last/Favorite).

There are **no** settings for buffer size, default audio language, default subtitle language, hardware/software decoding, or playback speed. Mobile additions (all New, optional): preferred audio language, preferred subtitle language (auto-select), decoder mode, Wi-Fi-only downloads.

---

## 8. Downloads (NEW for mobile; the TV app has none)

### 8.1 What can be downloaded

| Content | Source | URL shape | Downloadable? |
|---|---|---|---|
| Movie | Xtream | `/movie/{u}/{p}/{id}.{mkv\|mp4\|avi...}`: a single progressive file | **Yes**, plain HTTP with Range resume |
| Episode | Xtream | `/series/{u}/{p}/{id}.{ext}` | **Yes**, same |
| Movie/episode | M3U | `item.url`: often progressive (`.mp4/.mkv`), sometimes `.m3u8` | Progressive: yes. HLS: yes through **Media3 DownloadManager** (HLS segments) |
| Movie/episode | Stalker | `create_link` token URL (`play_token`), expires | **Yes, carefully**: resolve right before starting, re-resolve on resume or on 401/403/410 |
| Live channel | any | continuous TS/HLS | **No** (unbounded). Recording is out of scope |
| Catch-up | Xtream `timeshift.php` / Stalker archive | bounded but server-generated | Not in v1 (possible later; often not Range-capable) |
| Trailer | YouTube | | No (YouTube terms) |

### 8.2 How

- **Progressive files** (most VOD):
  - Use a resumable background downloader: Android `DownloadManager`, or a library such as `@kesha-antonov/react-native-background-downloader`, or Media3 `DownloadService` with a `ProgressiveDownloader`.
  - Requirements: a foreground-service notification with progress, pause/resume/cancel, resume with HTTP `Range`, retry with backoff, an optional Wi-Fi-only rule, a check for free storage before starting (use `Content-Length`).
  - Before starting, check `Accept-Ranges`. If the server ignores Range (the same portals where seeking fails, §3.1), warn that the download cannot resume after an interruption.
- **HLS VOD**:
  - Use Media3 `DownloadManager` + `DownloadService` with `DownloadHelper` to pick one quality variant. Play offline through the download cache as a `MediaItem`. react-native-video offline support needs a native module.
- **Storage**:
  - Use app-private storage (`context.getExternalFilesDir(Movies)` or `filesDir`). It needs no permission, is removed on uninstall, and other apps cannot read it.
  - Save a manifest record per download:

    ```json
    { "id", "type": "movie|episode", "playlistId", "streamId", "seriesId", "seasonIdx", "episodeIdx",
      "title", "poster", "container", "localPath", "bytes", "status", "createdAt", "expiresAt",
      "subtitles": [ { "lang", "path" } ] }
    ```

- **Offline playback**:
  - Play `file://localPath` with the same player, with the same resume logic and keys as online (§4), keyed by `streamId` or `seriesId+season+episode`. Offline and online progress should merge.
  - Also download the chosen **ibosub SRT** files (§5.3) next to the video, so subtitles work offline.
- **Expiry**:
  - Optionally tie `expiresAt` to the subscription end (Xtream `user_info.exp_date`, Stalker account end date).
  - Re-check when the app is online. When the playlist is deleted or the account has expired, mark the download expired or delete it. This is a product decision; see open questions.
- **Limits**:
  - Default to **one download at a time**. IPTV accounts often allow only 1–2 connections (`max_connections`), and a running download takes a slot, which can break live playback on the same account.
  - Show a warning when the user starts playback while a download is running.

### 8.3 Risks

- **Stalker links are temporary tokens**:
  - Never store the resolved URL as the download source. Store `cmd`, `series` and `storage_id`, and call `create_link` again for every start or resume.
  - Some portals may refuse Range, or tie the token to one connection. The `download=0` parameter the TV sends may matter: unknown whether `download=1` changes behaviour.
- **Xtream URLs contain the username and password** in the path:
  - Do not log them. Do not put them in notifications, analytics or crash reports. Do not store them in the download manifest.
  - Rebuild the URL from the stored IDs plus the credentials held in secure storage at download time.
  - `DownloadManager` keeps its own database of URLs. Prefer an in-app downloader or Media3 DownloadService, whose index is app-private.
- **Proxy**: when the Stararcs proxy is on, downloads would go through it too. Decide whether to allow that (bandwidth cost).
- **Legal/provider terms**: the app plays user-supplied content. Downloading may break provider terms. Consider letting the playlist or backend disable downloads.
- **Codec**: a downloaded MKV with AC3/DTS audio still needs the FFmpeg extension to play offline (§2.6).

---

## 9. Uncertainties and open questions

1. **`time_difference_with_server`** (catch-up start offset): this analysis did not trace how it is computed. It is probably server time minus local time in minutes, from the Xtream `server_info`. Verify before building catch-up.
2. **Stalker playback headers**: the TV plays the resolved URL with the WebView's default headers. Some portals may need a MAG User-Agent or cookie on the stream request. The TV code shows none for playback. Test with real portals.
3. **User-Agent for Xtream/M3U**: the TV sends its browser UA. Some panels block unknown UAs; ExoPlayer's default UA may be rejected. Consider a configurable UA.
4. **Live full-screen buttons** (EPG/Previous/Next/Audio): as observed, they all just leave full screen. Unclear whether that is intended. On mobile, wire them properly (New).
5. **ibosub API**: request and response fields are inferred from the calling code only. Other fields per subtitle entry (file name, rating...) are unknown. There is no auth header, and the API is called from the device.
6. **M3U catch-up** is not supported in the TV app (M3U `catchup-source` attributes are ignored). Not requested for mobile v1.
7. **Episode keys use array indexes** (season position, episode position), not numbers. If the provider reorders seasons, the resume data points at the wrong episode. Mobile may prefer `episode.id` as the key. That is a deliberate deviation; decide.
8. **Samsung-only behaviours** (prev/next when seeking past the ends, embedded subtitles on VOD, no delay): the mobile app should follow the non-Samsung behaviour, plus embedded tracks.
9. **Download expiry policy**, and whether downloads are allowed per provider: product decisions.
10. **Playback speed, PiP, gestures, countdown**: these are proposals (New). There is no TV reference behaviour for them.
