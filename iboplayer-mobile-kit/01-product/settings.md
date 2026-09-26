# Settings — IBOPlayer (TV) → IBOPlayer mobile

Every user-changeable setting of the TV app, with its English label (from the master string list `en.json`, key in backticks), its options, the default, where it is stored and what it changes.

**Storage.** The TV app stores everything in `localStorage` with the prefix **`gz3rYzUIC7_`** (written below as `P`). On mobile use AsyncStorage / MMKV with the same key names (keeping the prefix is optional but makes migration/debugging easier). "Per playlist" keys contain the playlist id (`{pid}`) right after the prefix.

Source: `settings.js`, `settings_page.js`, `settings_page.html`, `playlist.js`, `stararcs_page.js`, `custom_categories*.js`, `vod_series_page.js`, `channel_operation.js`.

---

## 1. The Settings screen (in menu order)

The TV Settings page is a left list of 16 items; choosing one shows its panel on the right. Order and labels:

| # | Menu label (key) | Panel description (key → English) |
|---|---|---|
| 0 | Media Player (`media_player_type`) | `media_player_type_desc` |
| 1 | Change Language (`change_language`) | `change_language_desc` "Select your preferred language for menus, navigation, and on-screen text." |
| 2 | Hide Categories (`hide_categories`) | `hide_categories_desc` "Choose which content categories (Adult, Sports, etc.) you want to hide from the main interface." |
| 3 | App Theme (`app_theme`; panel title `theme`) | `theme_desc` "Switch between various backgrounds for the app to match your viewing environment or personal style." |
| 4 | Channel Theme (`channel_theme`) | `channel_theme_desc` "Choose the layout and the background backdrop used by the Live TV page." |
| 5 | Parental Control (`parent_control`) | `parent_control_desc` "Restrict access to specific content with a PIN code to ensure a safe viewing experience for kids." |
| 6 | Clear Cache (`clear_cache`) | `clear_cache_desc` |
| 7 | Clear Watch Lists (`clear_watch_lists`) | `clear_watch_lists_desc` "Remove all saved items from your Continue Watching categories." |
| 8 | Subtitle Settings (`subtitle_settings`) | `subtitle_settings_desc` "Adjust subtitles size and colors." |
| 9 | Font Size (`font_size`) | `font_size_desc` |
| 10 | Toggle TMDB API (`toggle_tmdb`) | `toggle_tmdb_desc` |
| 11 | Toggle Home Favorites (`toggle_home_favorites`) | `toggle_home_favorites_desc` |
| 12 | Live Initialization (`live_initialization`) | `live_initialization_desc` |
| 13 | Load on Demand (`load_on_demand`) | `load_on_demand_desc` |
| 14 | App Initialization (`app_initialization`) | `app_initialization_desc` |
| 15 | Custom Categories (`custom_categories`) | opens its own page (see §3) |

Opening Settings from the Home "Settings" tile opens item 0 (Media Player) directly.

---

## 2. Setting reference

### 2.1 Media Player
- **Auto Switch Player** (`auto_switch_player`) toggle. Options `on`/`off`. Default **off**. Key `P auto_switch_player`. When on, the manual choice below is greyed out/disabled and the app picks the player per stream (details: player spec, `01-product/player.md`).
- **Player** list: `Native` / `HLS` / `Shaka` / `MPEGTS` → stored values `native` / `hls` / `shaka` / `mpegts`. Default **native**. Key `P media_player_type`. The chosen engine leads the fallback chain.
- Description `media_player_type_desc`: "Choose how video is played. Native uses the device player. HLS uses HLS.js. Shaka uses Shaka Player. MPEGTS uses mpegts.js for raw TS streams and falls back to HLS automatically. Turn on Auto Switch Player to ignore the choice below and let the app pick the player from the stream being played."
- **Mobile:** keep the two controls, but map the engine names to what the RN player supports (e.g. "Automatic" / "ExoPlayer (native)" / alternative engines). If only one engine exists on Android, keep "Auto Switch Player" semantics hidden and document it.

### 2.2 Change Language
- Options: the language list from the backend login response if it has one, otherwise the bundled list: English (`en`), العربية (`ar`), Français (`fr`), Deutsch (`de`), Español (`es`), Türkçe (`tr`), Italiano (`it`), Português (`pt`), Nederlands (`nl`), Русский (`ru`), Polski (`pl`), Svenska (`sv`), Dansk (`da`), Norsk (`no`), Suomi (`fi`), اردو (`ur`), हिन्दी (`hi`), فارسی (`fa`).
- Default: the device language code (first part of the locale, e.g. `fr-FR` → `fr`); falls back to English when no file exists. `resetDefaultValues` uses `en`.
- Key `P language`. Applies immediately (all labels re-translated). Missing keys fall back to English.
- **Mobile:** same list; support RTL for ar/ur/fa.

### 2.3 Hide Categories
- Three tabs: Live TV (`live_tv`), Movies (`movies`), Series (`series`). Each lists every category of the **current playlist** (including the virtual ones: Recently Viewed / Continue Watching, Favourites, Top Rated, Newly Added / Recently Added/Updated, Uncategorized), except "Search All …" and custom categories. A checked item = visible; tapping toggles.
- Empty placeholder: `categories_will_show_here` "Categories will show here" (when that type's data was not loaded yet — with Load on Demand the lists are only filled after the section was opened once).
- Storage per playlist and type: `P{pid}live_hiddens`, `P{pid}vod_hiddens`, `P{pid}series_hiddens` → JSON array of hidden category ids.
- Effect: hidden categories disappear from the Live / Movies / Series category lists and from Search. Takes effect the next time the page is opened.

### 2.4 App Theme (background)
- Options: backgrounds from the backend (`themes` list: name + image URL) or the built-in list: Future, Honor Wallpaper, Red Bubbles, Movies Area, Red Strings, "IBO Classic", Modern Look, Red Lines, Main Background, Sharp Lines, Cinema.
- Default: the first server theme (saved automatically at first login if nothing chosen).
- Keys `P bg_img_file` (file name only) and `P bg_img_name` (display name).
- Effect: the app's full-screen background image (loaded from `<working website host>/images/upload/<file>`). Choosing one previews it by fading the settings page.
- **Mobile:** optional. A Netflix-style UI is dark; you may drop this setting or keep it only for the Home hero background. If dropped, list it as a known difference.

### 2.5 Channel Theme (Live page look)
- **Layout**: Classic (`classic`) / Normal (`normal`) / Modern (`modern`) → stored `""` / `"normal"` / `"modern"`. Default Classic (`""`). Key `P channel_theme`.
- **Background**: Classic, Blue, Dark, Iconic, Light, Modern, Purple, Red → stored keys `classic`,`blue`,`dark`,`iconic`,`light`,`modern`,`purple`,`red`. Default none (`no_backdrop_selected` "No backdrop selected"). Key `P channel_bg_theme`.
- Effect: TV live page layout only.
- **Mobile:** drop (TV layout specific) — the mobile Live tab has one layout. Mention in "dropped" list.

### 2.6 Parental Control
- Opening this panel while parental control is ON first asks for the PIN (title "Enter Parental PIN"; wrong → "Incorrect PIN.").
- **Toggle** "Parental Control". ON ↔ OFF.
  - Turning OFF: immediately sets the PIN value to `"off"`, saves, syncs to server. Toast `msg_parental_control_turned_off` "Parental control turned off."
  - Turning ON: PIN pad "Set Parental PIN" (4 digits); the entered PIN becomes the new PIN and is synced.
- **Change PIN** (only visible when ON): New PIN (`new_password`), Confirm New PIN (`confirm_new_password`), Submit (`submit`). Validation messages: `msg_please_fill_all_fields` "Please fill all fields", `msg_new_pins_do_not_match` "New PINs do not match", `msg_pin_must_be_4_digits` "PIN must be 4 digits". Success toast `msg_parental_control_pin_changed_successfully` "Parental control PIN changed successfully!".
- Server sync failure toast: `msg_parental_pin_saved_on_device_only` "The PIN was saved on this device only. Please check your connection and try again." (the local value is kept).
- Default PIN: the backend's `parent_pin` from device info if present, else **`0000`**. Key `P parent_account_password` (value = 4-digit string or `"off"`).
- What it locks: see business rules R-060…R-066.

### 2.7 Clear Cache
- One button "Clear Cache". Description `clear_cache_desc`: "Free up storage and resolve playback issues by clearing temporary app data. This will reset all the settings, favorites, watching progress. The app will restart to apply these changes."
- Effect: deletes **every** key with the app prefix (except the analytics session/buffer keys), resets settings to defaults, restarts the app. No confirmation dialog on TV.
- **Mobile:** add a confirmation dialog (Cancel / Clear) — recommended; then wipe storage and restart the root navigator to the splash. Note this also deletes the device token/uid, so the device re-registers.

### 2.8 Clear Watch Lists
- "Clear Movies Watch List" (`clear_movies_watch_list`) → toast `msg_movies_watch_lists_cleared_successfully` "Movies Watch lists cleared successfully!"
- "Clear Series Watch List" (`clear_series_watch_list`) → toast `msg_series_watch_lists_cleared_successfully` "Series Watch lists cleared successfully!"
- Effect: for the current playlist, deletes `P{pid}_saved_vod_times` / `P{pid}_saved_series_times` and empties the "Continue Watching" / "Recently Viewed" row. No confirmation on TV.

### 2.9 Subtitle Settings
| Row | Label | Options | Default | Key |
|---|---|---|---|---|
| 0 | Subtitle Size (`subtitle-size`) | 20…80 px, step 5 (left/right) | 50 | `P subtitle_size` |
| 1 | Text Color (`text_color`) | White `#ffffff`, Black `#000000`, Yellow `#ffe000`, Green `#26d367`, Cyan `#39d5e0`, Red `#e02323` (cycles) | White | `P subtitle_text_color` |
| 2 | Background Color (`background_color`) | None `transparent`, Black `#000000`, Semi Black `rgba(0,0,0,0.6)`, White `#ffffff`, Red `#950606`, Blue `#1d528f` (cycles) | None | `P subtitle_bg_color` |
| – | Vertical position (only in the player's subtitle menu) | percent from bottom | 5 | `P subtitle_position` |

A live preview shows "This is how subtitles will look like" (`subtitle_preview_text`). Changes apply instantly. Legacy key `P subtitle_bg` (paired preset black/white/red/transparent) is only read to migrate old installs.

### 2.10 Font Size
- Normal (`normal`) / Large (`large`). Default Normal. Key `P font_size`. Applies instantly (bigger UI text).
- **Mobile:** map to a text-scale multiplier (e.g. 1.0 / 1.15), or drop in favour of the Android system font scale.

### 2.11 Toggle TMDB API
- Off / On. Default **On**. Key `P tmdb_choice`.
- Effect when Off: no TMDB artwork/logos/cast; the Movies/Series grid is forced to the "Classic" (no hero/info panel) layout and the theme switch shows `msg_theme_cannot_be_changed_unless_tmdb_is` "Theme cannot be changed unless TMDB is allowed in settings."; details pages show only provider data; hover info is not fetched.

### 2.12 Toggle Home Favorites
- Off / On. Default **On**. Key `P home_favorites_choice`.
- Effect: shows/hides the "Live Favorites" tile on Home. Always hidden for Stalker portals regardless. Applies instantly.

### 2.13 Live Initialization
- Default (`default`) / Last (`last`) / Favorite (`favorite`). Default **default**. Key `P live_initialization_choice`.
- Effect on opening Live TV (Xtream/M3U only): Default = open the 3rd category (index 2, usually the first real category after "Search All" and "Recently Viewed") if it has channels, else the first non-empty one, and start its first channel. Last = find the most recently watched channel and open its category and play it (falls back to Default). Favorite = open Favourites and play its first channel (falls back to Default).

### 2.14 Load on Demand
- Disabled (`disabled`) / Enabled (`enabled`) → stored `0` / `1`. Default **Enabled** (`1` is written automatically at the first Xtream login if the key is missing). Key `P load_on_demand`.
- Description: "When enabled, the app will only request data when you actually open a section (Movies, Series, or Live)… When disabled, all content data … will be loaded together when the app starts… This setting will take effect the next time you load the app".
- Choosing **Disabled** reloads the app immediately. Choosing Enabled takes effect next launch.
- Side effect: while enabled (or for Stalker), the global Home Search button is hidden.
- **Mobile:** keep. Recommended default Enabled (phones on mobile data).

### 2.15 App Initialization
- Automatic (`automatic`) / Playlist Selection (`playlist_selection`) → stored `automatic` / `playlist_first`. Default **automatic**. Key `P app_initialization_choice`.
- Description: "Choose how you want the application to start. Playlist First: You will be prompted every time to choose the playlist before the app initializes. Automatic: The app will automatically choose your last selected playlist, or the first playlist by default."
- The same value is shown on the Playlists screen as the toggle **Start on Playlist** (`start_on_playlist`): toggle ON = automatic, OFF = playlist_first. Both controls edit the same key.

### 2.16 Custom Categories (own page)
See §3.

---

## 3. Settings that live on other screens

| Setting | Where | Options / default | Key | Effect |
|---|---|---|---|---|
| Auto Switch Playlist (`auto_switch_playlist`) | Playlists screen toggle | on/off, default **off** | `P auto_switch_playlist` | if the active playlist fails to load, automatically try the next one (R-021) |
| Start on Playlist (`start_on_playlist`) | Playlists screen toggle | = App Initialization | `P app_initialization_choice` | see 2.15 |
| Enable Custom Categories (`enable_custom_categories`) | Custom Categories page | on/off, default **off** | `P custom_categories_enabled` (`"true"`/`"false"`) | shows custom rows and the "Add to" chooser (R-080…) |
| Custom category definitions | Custom Categories page | name (max 32 chars) + icon (12 icons) | `P custom_categories` (JSON `[{id,name,icon}]`, global across playlists) | |
| STB Profile (`stb_profile`) | Stalker Portals screen | MAG 250 / MAG 322 / MAG 520 / IBOPlayer; default MAG 250 | `P stalker_stb_profile` (`mag250`,`mag322`,`mag520`,`iboplayer`) | identity used when connecting to Stalker portals; may be auto-changed after a successful fallback (R-043) |
| Autoplay (`autoplay_off` "Autoplay is off"/"Autoplay is on") | Player (series/movies) | on/off, default **off** | `P auto_play` | play next item when one ends (player spec) |
| Stararcs Proxy "Toggle Connection" | Stararcs page | on/off, default off | `P smart_proxy_connection_state` (+ `P smart_proxy_region`, `P smart_proxy_country`, `P smart_proxy_server` indexes, default 0) | route streams via proxy |
| Keep Connection (`keep-connection`) | Stararcs page | on/off, default off | `P keep_connection` | keep proxy on across app restarts (R-110) |
| Sort order (Movies / Series / Replay) | Movies/Series grid sort dialog | Default, Added, A-Z, Z-A, Rating | `P vod_sort` (default `added`), `P series_sort` (default `added`), `P live_sort` (default `default`, used by Replay) | grid order (R-090) |
| Movies Theme Control (`movies-theme-control`) | Movies/Series grid theme dialog | Classic Type (`classic_type`) / Modern Type (`modern_type`) → `n`/`m` | `P vod_theme` (default: unset → treated as modern if TMDB on) | Modern shows a hero info panel with backdrop above a 1-row grid; Classic shows only the grid. **Mobile:** drop; the Netflix layout is always "modern". |
| Selected playlist | Playlists / Portals screens | – | `P playlist_id`, `P playlist` (JSON of the entry) | active source |

Not user-visible but in the settings object: `stream_format` (`P stream_format`, default `default` — forces a live stream extension if not `default`; no UI), `time_format` (`24`, no UI, not saved).

---

## 4. Other stored data (not settings, but part of the product state)

Per playlist `{pid}`:
| Key | Content |
|---|---|
| `P{pid}live_favourite`, `P{pid}vod_favourite`, `P{pid}series_favourite` | favourite ids |
| `P{pid}live_recent` | recently watched live channel ids (max 15, newest first) |
| `P{pid}_saved_vod_times` | `[{stream_id,time,duration}]` movie progress |
| `P{pid}_saved_series_times` | `[{stream_id(series_id), video_times:{ "<seasonIdx>":{ "<episodeIdx>":{time,duration}}, recent:{s,ep}}}]` |
| `P{pid}_category_orders`, `P{pid}_channel_orders` | manual "Move" re-ordering of live categories / channels |
| `P{pid}_live_category_arrangement` | "Arrange Categories" pinned order (array of category ids) |
| `P{pid}{type}_cc_{catId}` | custom-category membership (ids) for Xtream/M3U |
| `P{pid}_stalker_{type}_{recent|favourite}_objs`, `P{pid}_stalker_{type}_cc_{catId}_objs` | Stalker: full item objects (because Stalker items are not all loaded) |

Global:
| Key | Content |
|---|---|
| `P termsApproved` | `"true"` once the terms were accepted |
| `P wc_my_channel_ids` | "My Sports Channels" membership (global, not per playlist) |
| `P saved-movie-info` | cache of movie/series info (≤100 entries, cleared when the playlist host changes) |
| `P all_playlists_info` | per playlist cached expiry/status (5-minute freshness) |
| `P api_data`, `P domain_lists`, `P local_data`, `P _manually_chosen_url`, `P v4_uid`, `P v4_token`, `P stararcs_secret_token`, `P stararcs_base_url`, `P stararcs_domain_list`, `P isRefresh` | backend/session state (see backend docs) |
| `P weather-forecast` | weather cache (stale after 13 days) |
| `stalker_mac` (no prefix!) | random fallback virtual Stalker MAC `00:1A:79:XX:XX:XX` |

## Notes / uncertainties
- The "Parental Control → OFF" action does not ask for the PIN again because the panel itself was PIN-gated on entry.
- `msg_current_password_does_not_match` exists in en.json but no current-PIN field exists in the change form.
- `live_sort` has no UI of its own; it is only changed through the sort dialog on the Replay grid.
