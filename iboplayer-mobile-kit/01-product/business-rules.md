# Business rules — to preserve in IBOPlayer mobile

Numbered rules extracted from the TV app's behaviour. Reference them as R-xxx in tickets. "Must" = keep as is; "Mobile" notes say how to express it on a phone. Storage prefix `P` = `gz3rYzUIC7_`, `{pid}` = playlist id. Backend protocol details are in the backend docs; video player internals in `player.md`.

## A. Startup, terms, device and license

- **R-001 Terms first.** On first launch the terms dialog is shown before anything else. Only "Accept" exists. Acceptance is stored (`P termsApproved = "true"`) and never asked again unless storage is cleared.
- **R-002 Device identity.** The device is identified by a MAC-like id (`XX:XX:XX:XX:XX:XX`) plus a server-issued **device key**. Both are shown to the user on: loading screen, welcome screen, "stuck" panel, Home, Playlists, Portals, Account. The user types them on the website to add playlists. Mobile: must show them in the same places (Account + onboarding + empty Playlists state) with copy buttons.
- **R-003 Registration.** A device without a stored token must pass verification (captcha typed in-app, or verification on the website then "Continue"). A backend 401/403 or "device not found" (404) clears the token and restarts verification.
- **R-004 Server failover.** Backend calls try every known server in turn (status "Server busy, trying another (i/N)..."). If all fail and a cached account exists, the app starts **offline** from the cache; if nothing is cached the "Server URLs failed" panel lets the user type a custom domain. A custom domain that works is remembered; one that fails is forgotten.
- **R-005 Offline license tolerance.** When starting from the cache (backend unreachable), an app license that looks expired is treated as valid (the app never locks the user out because the server is down).
- **R-006 License expired.** If the app license `expire_date` < today (server data), show the "Trial Period Expired" screen with activation instructions and **no way to continue**.
- **R-007 Trial / not registered.** If the device is not registered (`mac_registered` false), show the welcome screen with the trial notice ("…ends in N days.") and a "Continue" button that loads the playlist.
- **R-008 License status label.** Account "Status" = "Active" when license type `is_trial` is 2 or 3, otherwise "Trial".
- **R-009 Demo entry.** If the server returns more than one playlist and the first has id `demo`, the demo entry is removed. An entry without a URL (demo/sample) cannot be loaded → Playlists screen with "This playlist has no server address…".
- **R-010 Parental PIN from server.** If device info contains `parent_pin`, it replaces the local PIN at every login.
- **R-011 Loading watchdog.** If a playlist is still loading after 120 s, offer Change Playlist / Restart App / Dismiss.

## B. Choosing the playlist at startup

- **R-020 App Initialization.** "Automatic": use the last selected playlist (`P playlist_id`), or the first one if that id no longer exists. "Playlist Selection" (`playlist_first`): open the Playlists screen at every launch with no playlist marked CURRENT; Back there exits.
- **R-021 Auto Switch Playlist.** If ON and the active playlist fails to load, try the next untried playlist in list order (toast "Auto Switch" / "Playlist failed to load. Switched to \"<name>\"."). When all failed → Playlists screen "All playlists failed to load…". The tried list resets on a manual switch.
- **R-022 Load failure destination.** Xtream/M3U failure → Playlists screen with the error banner (empty content). Stalker failure → Portals screen with its error. The home is still built behind it but has no data.
- **R-023 Xtream login validation.** Account reply without `user_info`, `auth = 0`, or status Expired/Banned/Disabled = failure; "Expired" gets the specific "Your playlist subscription has expired…" message. Other failures show the generic message ending "IBOPlayer does not manage or sell playlist subscriptions".
- **R-024 Xtream → M3U fallback.** If the Xtream API calls fail (network or parse), the app retries the same playlist as a plain M3U using its original `get.php` URL.
- **R-025 M3U validation.** An M3U response must be text starting with `#EXTM3U`, otherwise the generic error.
- **R-026 Stalker connect.** Connect with the saved STB profile (default MAG 250) to the primary URL, then the fallback URL. Profile status ≠ 1, expired or not registered = failure ("Your portal subscription has expired…" when expired/unregistered, else "Sorry, the portal is currently unavailable…").
- **R-027 Playlist expiry date.** For Xtream, `user_info.exp_date` (unix) gives the playlist expiry; `null` = "Unlimited". Server time offset is computed from `server_info` and applied to EPG times.

## C. Playlists and portals management

- **R-030 Save with offline queue.** Adding (or editing) a playlist/portal is sent to the backend. If the backend call fails, the entry is still added locally and queued (`P local_data`); the queue is replayed at the next launch (adds, updates, deletes), and entries the server accepted replace their local copies (server ids replace temporary `non_saved_<unix>` ids, and all per-playlist storage keys are renamed to the new id).
- **R-031 Xtream entry validation.** Name, URL, username, password required; the app test-calls the provider before saving; auth=0 / Expired / Banned = "Sorry, your playlist is not working…". A pasted `get.php?username=&password=` URL is converted to host+credentials.
- **R-032 Playlist URL form from server.** Server URLs of the form `<host>/playlist/<user>/<pass>/<type>[/<output>]` are converted to Xtream entries.
- **R-033 Minimum one playlist.** Deleting is refused when only one playlist/portal exists ("You need to have 1 playlist at least" / "You need to have at least 1 playlist."). Delete goes to the backend first; on failure nothing is removed.
- **R-034 Deleting the active one** clears the selection (`playlist_id` = ""); deleting the active portal sends the user to the Playlists screen.
- **R-035 Separation.** The Playlists screen lists only Xtream/M3U; Stalker portals are listed only on the Portals screen. Both share one backend list.
- **R-036 In-app types.** IBOPlayer lets users type only Xtream playlists in-app (M3U input disabled) and Stalker portals; M3U playlists are added via the website (QR / URL). Mobile: keep XC + Stalker in-app; offering M3U input is a product decision (flag `playlist_m3u_input` is off).
- **R-037 Expiry display on playlist cards.** Fetched when a card is focused (mobile: when visible), cached 5 minutes in `P all_playlists_info`, shown "Expires at D Mon YYYY" or "Unlimited"; reported to the backend.
- **R-038 Portal MAC.** Virtual Stalker MAC = prefix `00:1A:79` (or `00:1C:1D`) + last 3 bytes of the device id; if no device id, a random persistent `00:1A:79:XX:XX:XX`. Must match `^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$`.
- **R-039 Portal save** test-connects first (primary, then fallback); only a working portal is saved.

## D. Switching playlist / portal

- **R-040 What a switch does.** Save `playlist_id` + `playlist`, disconnect any Stalker client, empty all loaded categories/streams (live, movies, series), mark sections "not loaded", show the loading screen and run the normal login for the new entry. Per-playlist data (favourites, recent, progress, hidden categories, orders, custom-category membership) automatically follows the new `{pid}`.
- **R-041 Info cache reset.** When the new playlist has a different host, the movie-info cache (`P saved-movie-info`) is cleared.
- **R-042 Proxy warm-up.** If the Stararcs proxy is on, playlist loading waits 1 s before starting.
- **R-043 STB profile auto-save.** If a Stalker connect succeeds only after switching profile, the working profile is saved — unless the user explicitly selected the "IBOPlayer" profile.

## E. Content loading and caching

- **R-050 Load on Demand (default ON).** At first Xtream login `P load_on_demand` is set to 1 if missing. ON: no content is downloaded at startup; each section (Live, Movies, Series) downloads its categories + streams the first time it is opened (loader, cancellable), then stays in memory until restart/switch. OFF: all six lists are downloaded at startup before Home. Stalker always behaves as on-demand (categories per section, items per category/page).
- **R-051 Search availability.** Global Home search is hidden when Load on Demand is on or the playlist is Stalker (the data isn't loaded).
- **R-052 Refresh.** There is no incremental refresh: the Home "Refresh" and Playlists "Reload" restart the app (content re-downloaded). "Reload" keeps the Stararcs proxy connection.
- **R-053 Category building (Xtream/M3U).** Items are grouped by `category_id`; items with no category go to "Uncategorized" (row removed if empty). Virtual rows are prepended in this order — Live: Search All Channels, Recently Viewed, Favourites; Movies: Search All Movies, Continue Watching, Favourites, Top Rated, Newly Added; Series: Search All Series, Recently Viewed, Favourites, Top Rated, Recently Added/Updated. Custom-category rows are inserted right after Favourites. Stalker has no "Search All" rows and no Top Rated / Newly Added / Recently Added rows; portal "All"/"All Channels"/"All Movies"/"All Series" categories are removed.
- **R-054 Newly Added / Recently Added.** Movies with `added` within the last 15 days; series with `last_modified` within 15 days; also drive the "NEW" badge. Adult-category items excluded.
- **R-055 Top Rated.** Items with a numeric rating (adult excluded), sorted descending, top 10. If more than 10 share the highest rating they are shown shuffled; a "Refresh" shuffle button appears when ≥20 share it.
- **R-056 M3U parsing.** Type by URL: contains `/movie/`, `vod`, `=movie` → movie; `/series/` → series; else live. Category = `group-title` (empty → "Uncategorized"). Series grouped from names "Name SxxEyy" into seasons "Season xx" and episodes. M3U has no EPG and no catch-up.
- **R-057 Movie info cache.** Movie/series info from the provider is cached (max 100 entries, oldest dropped) and reused on hover/details.
- **R-058 Loading on first open of a live category** uses the first category that has channels (Xtream/M3U) or the first real portal category (Stalker).

## F. Parental control

- **R-060 Adult detection.** A category is adult if its name (lower-case) contains `xxx`, `adult` or `porn`. (For excluding items from Top Rated / Newly Added / Recently Added, `sex` is also matched.)
- **R-061 PIN on adult categories.** Opening an adult category on Live, Movies, Series or Replay asks for the 4-digit PIN ("Parent Control"; wrong → "Sorry, parent password does not match."; Cancel returns). Not asked when parental control is Off (`P parent_account_password = "off"`). The PIN is asked **every time** the category is opened (no session unlock).
- **R-062 No adult favourites.** Adding an item from an adult category to Favourites is refused: "Parental safety" / "Adding protected content to favourites is not allowed." (removing is allowed). Applies on Live, Movies grid, Movie details, "Add to" chooser.
- **R-063 No adult history.** Adult live channels are not added to Recently Viewed; adult movies/series progress is not saved (no Continue Watching).
- **R-064 Search hides adult.** Search never returns items from adult categories (even with parental control off).
- **R-065 Settings gate.** Opening Settings → Parental Control asks the current PIN when control is on ("Enter Parental PIN" / "Incorrect PIN."). Turning on asks for a new PIN ("Set Parental PIN"). Change PIN needs New + Confirm, equal, 4 digits.
- **R-066 PIN sync.** Every PIN change / on / off is saved locally first, then sent to the backend (`changeParentPin`, trying each server); failure → "The PIN was saved on this device only…". Default PIN "0000".

## G. Favourites, recent, continue watching

- **R-070 Per playlist and type.** Favourites are stored per playlist and per type: live (max 500), movies (max 200), series (max 200). New favourites are appended at the end.
- **R-071 Live favourites for Stalker.** The Home "Live Favorites" tile is hidden for Stalker portals (and when Toggle Home Favorites = Off). Favourites still work inside the Live page for Stalker; they are stored as full objects (`P{pid}_stalker_live_favourite_objs`, max 500) because portal channels are not all loaded.
- **R-072 Recently Viewed (live).** Playing a (non-adult) channel puts it first in Recently Viewed; max **15**; a channel already in the list is not re-added (Xtream/M3U keep its old position). Stalker keeps objects (max 15, re-plays move to front).
- **R-073 Progress saving (movies/episodes).** Progress is saved when position ≥ 10 s and remaining ≥ 10 s (periodically and on exit/background). Within the last 10 s the item counts as finished: its progress is deleted and it leaves Continue Watching (series: the episode entry is deleted; the series leaves the row when no episode progress remains).
- **R-074 Continue Watching lists.** Movies "Continue Watching" and Series "Recently Viewed" contain items with saved progress, newest first, max **15** (series: not added once 15 are present).
- **R-075 Resume.** Opening a movie/episode with saved progress asks "Continue from where you left / Do you want to resume the playback from the last position?" (time shown) Yes/No; dialog auto-closes after 15 s. Details page shows "Continue Watching" + % when progress > 0 %.
- **R-076 Series last watched.** Each series remembers the last watched season/episode (shown "S{n}EP{m}" on cards); episode progress is keyed by season position and episode position in the list.
- **R-077 Clear watch lists** removes all movie (or series) progress for the current playlist (R-073 data).
- **R-078 Favourite from details** is applied when leaving the details page (list badges update then).

## H. Custom categories and Sports

- **R-080 Feature switch.** Custom Categories default **off**. When off: favourite action toggles Favourites directly (no chooser), custom rows are hidden, user badges hidden; definitions and memberships are kept and come back when re-enabled.
- **R-081 Definitions global, membership per playlist.** Category name+icon are shared by all playlists; membership is per playlist and type (live/movies/series), max 500 per category (Stalker stores objects).
- **R-082 Rows.** Enabled categories appear as rows right after Favourites in Live, Movies and Series (live rows show badges: up to 2 icons + "+N").
- **R-083 Deleting a category** removes its rows and its membership for the current playlist.
- **R-084 Name** trimmed, 1–32 chars; default icon `cc-heart`.
- **R-100 Sports mode (flag on).** "Sports Channels" opens Live with virtual categories: **"My Sports Channels"** (user list, global across playlists, key `P wc_my_channel_ids`) + every live category whose name matches the sports include list and not the exclude list, each filtered to channels whose names match the channel include/exclude lists (below). Empty result → "No sport channels found in your playlist."
  - Category include: WORLD CUP, FIFA, MUNDIAL, WC 20, SPORT, SPORTS, ⚽, FOOTBALL, SOCCER, FUTBOL, BEIN, FOX SPORT, SKY SPORT, TSN, ESPN, ALWAN SPORT. Exclude: ENTERTAINMENT, MOVIES, AFLAM, CINEMA, MOSALSALAT, MUSIC, AGHANI, KIDS, ATFAL, ANIME, QURAN, MEDIA, NEWS, AKHBAR, DOCUMENTARY, WATHAEQ, HORSE RACING, RACING, MOTOR, F1, WWE, UFC, KOREA, BOLLYWOOD, TURKEY.
  - Channel include: WORLD CUP, FIFA WC, FIFA, MUNDIAL, SPORT, SPORTS, ⚽, BEIN, FOX SPORT, SKY SPORT, TSN, ESPN, BBC, ITV, ZDF, RAI, TRT SPOR, M6, SVT, NRK, RTE, TELEMUNDO, UNIVERS, CARACOL, TVP, HRT, RTS, BNT, TVR, SBS, FUBO, WCTV, ALWAYS ON, DSPORT, CAZE, SPORZA, ARENA SPORT, WIN SPORT, TIGO SPORT, TELETICA, SIGMA, CT SPORT, TVNZ. Exclude: F1, FORMULA, WWE, UFC, BOXING, NBA, NFL, MLB, NHL, CRICKET, GOLF, HORSE, RACING, MOTOR, AFLAM, MOSALSALAT, ANIME, QURAN, MOVIES, CINEMA, SERIES, BOX OFFICE, D-SMART, AGHANI, ATFAL, BOLLYWOOD, KOREA. Matching is case-insensitive substring.
- **R-101** In Sports mode the favourite action always opens the chooser (Favorites + My Sports Channels, plus custom categories if enabled). Arrange is not available. Search is limited to the sports categories.

## I. Live TV rules

- **R-090 Sort orders (Movies/Series/Replay).** Default = provider order; Added = newest first (series use `last_modified`); A-Z / Z-A by name (locale compare); Rating = highest first; (Number = highest `num` first, not offered in UI). Saved per section (`vod_sort`, `series_sort`, `live_sort` for Replay). Defaults: Added for movies/series, Default for replay. Stalker: Z-A hidden; series Rating hidden; sorting done by the portal plus a client-side re-sort.
- **R-091 Tap behaviour.** First tap on a channel = preview; tap on the playing channel = fullscreen.
- **R-092 Live Initialization** (see settings.md 2.13) applies only to Xtream/M3U; Stalker opens the first real category.
- **R-093 Manual order (Move).** Moving categories/channels persists per playlist (`_category_orders`, `_channel_orders`). "Search All Channels" can't be moved and nothing can move above the first row.
- **R-094 Arrange Categories.** Picked categories (ordered) are shown right after the pinned rows (Search All, Recently Viewed, Favourites), the rest keep their order. Stored per playlist (`_live_category_arrangement`); ids no longer present are kept for later. Reset clears (needs Save). Unsaved changes prompt on exit.
- **R-095 EPG sources.** Xtream: short EPG (30 entries) per channel for the info panel; full table per channel for guide and catch-up. Stalker: portal EPG. M3U: none (EPG button hidden). Times shifted by the server-time offset. XC titles/descriptions are base64.
- **R-096 EPG Guide** covers today only, loads lazily (max 4 concurrent), caches per playlist for the session, retries failed rows next visit, merges back-to-back programmes with the same title (≤1 min gap), gives up on a category when its first 8 rows have no EPG. Past programmes can't be played from the guide.
- **R-097 Replay (catch-up).** Not available for Stalker from Home ("Replay not available for stalker portals") and not for M3U ("Replay not available for current playlist"). Xtream: only channels with `tv_archive ≠ 0` and `tv_archive_duration ≠ 0`; programmes with `has_archive ≠ 0` and already finished; grouped by day; played via timeshift URL (start converted to server time, duration in minutes).
- **R-098 Live search** covers all visible live categories (hidden categories excluded) by channel name; not available on Stalker.
- **R-099 Live stream URL (Xtream).** `<host>/live/<user>/<pass>/<stream_id>.ts` (extension may follow the playlist's `output=` or a forced stream format) — details in backend/player docs.

## J. Expiry notifications

- **R-114 Playlist expiry popup.** On entering Home, if the Xtream playlist expires in 0–5 days (ceil of days until the date), show the notification popup (Dismiss). Days shown: 0 → "a few hours", 1 → "1 day", n → "n days", unknown → "Unknown". Not for Stalker (expiry block hidden), not for unlimited.
- **R-111 App license date** is displayed (Home "App Expiration:", Account) but produces no popup; expiry blocks at startup (R-006).

## K. Settings side-effects

- **R-120 Clear Cache** wipes all prefixed storage except analytics, resets defaults and restarts (device must re-verify).
- **R-121 Language** change applies immediately; missing translations fall back to English.
- **R-122 TMDB off** disables all TMDB calls (artwork, logos, cast, trailer backdrops) and forces the plain grid.
- **R-123 Load on Demand → Disabled** restarts the app immediately.

## L. Stararcs proxy

- **R-110 Keep Connection.** On a cold start, proxy settings are cleared unless Keep Connection is on (or the start was an in-app "Reload"). With Keep Connection on, the app waits (max 15 s) for the proxy status before loading the playlist, so the first request is already proxied.
- **R-112 Proxy states.** Success (subscriber) / Guest (free quota) = proxy usable; any other status turns the proxy off and replays the current stream without it.
- **R-113** When the proxy is connected, Home shows "Connected to <country>".

## M. Misc

- **R-130 Exit.** Back on Home (and on Playlists/Portals when no content is loaded, and on Terms/Welcome/Captcha) asks "DO YOU WISH TO EXIT APP?". Mobile: Back on the Home tab exits (double-back or dialog).
- **R-131 Toast duration** 2 s.
- **R-132 Weather** is fetched by IP and cached; stale after 13 days (optional on mobile).
- **R-133 Analytics events** "live_opened", "movies_opened", "series_opened" are sent when those sections open (analytics details in backend docs).

## Notes / uncertainties
- R-072: for Xtream/M3U the live recent list does **not** move an already-present channel to the front (code only inserts if absent); Stalker does move it. Probably unintended; recommend "move to front" on mobile, but that is a behaviour change.
- R-074: movie watch list `addToWatchList` trims to 15, series one refuses to add past 15 — inconsistent; after a restart both are rebuilt from saved progress (which is unlimited), so the rows can then exceed 15. Recommend capping at 15 newest on mobile.
- Search minimum length differs by screen (see inventory).
- Rule numbers have gaps on purpose (groups); R-100/R-101 (Sports) sit in group H.
