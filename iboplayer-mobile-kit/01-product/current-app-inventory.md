# Current app inventory — IBOPlayer (smart-TV app)

Every screen, dialog and overlay of the existing TV app "IBOPlayer" (brand name `IBOPlayer`, long name `IBO IPTV Player`, website `https://iboplayer.com`), what is on it, what the user can do, and its states. Strings are quoted as `en.json key` → "English text". Strings hard-coded in the TV code (not translatable) are marked *(hard-coded)*.

IBOPlayer build configuration that shapes this inventory:
- Sports feature **on**; EPG Guide **on**; Category Arrange **on**.
- Playlist editing (pencil/edit) **off**; M3U/General URL input in the editor **off** (only Xtream "XC" can be typed in-app; M3U playlists come from the website); provider contact info **off**.
- Home = the "iboplayer" tile home.

Playlist types the app handles: **xc** (Xtream Codes: host + username + password), **general** (M3U URL), **stalker** (MAG/Stalker portal: portal URL + MAC). Type-specific differences are listed per screen.

Related docs: `settings.md` (all settings), `business-rules.md` (numbered rules R-xxx), `user-flows.md` (flows + mobile mapping), `player.md` (video player — separate author).

---

## 0. Global UI elements

| Element | Description |
|---|---|
| **Toast** | Top notification with a title + text, auto-hides after 2 s. Most messages below are toasts ("title / text"). |
| **Loader** | Full-screen spinner. On most pages Back cancels the pending request and closes it. |
| **PIN overlay** | Keypad 1-9, 0, backspace, confirm, Cancel; 4 masked digit cells; title (default `enter_your_pin` "Enter your PIN"); error line. Used for parental control. |
| **Exit dialog** | `exit_app` "DO YOU WISH TO EXIT APP?" with `yes` "Yes" / `no` "No". Yes closes the app. |
| **On-screen keyboards** | TV-only (static keyboard, keyboard overlay). **Drop on mobile** — use the native keyboard. |
| **Colour keys (Red/Green/Yellow/Blue)** | TV remote shortcuts shown as coloured labels. **Drop on mobile** — replaced by visible buttons, long-press menus, and swipe actions (see user-flows.md). |

---

## 1. Loading / splash screen (`loading_page`)
Purpose: shown during boot and whenever a playlist (re)loads.
- Logo, title `loading_title` "Discover, Play, Enjoy...", paragraph `loading_message` "Elevate your entertainment experience with IBO IPTV Player. … Please note: this IPTV player does not include preloaded content and requires you to add your own playlists.", spinner, footer `made_by` "Made by" + IBO Dev logo.
- Device info strip (top): `mac_address` "Mac Address": value; `device_key` "Device Key": value (filled once known).
- Status line (boot phases; English fallbacks): "Finding the best server...", "Identifying this device...", "Verifying device...", "Registering device...", "Loading your account...", "Connecting securely...", "Syncing your playlists (n/N)...", "Server busy, trying another (i/N)...", "Loading your playlist...", "Connecting to your provider...", "Downloading streams...", "Organising categories...", "Downloading playlist...", "Reading channels...", "Connecting to portal...", "Almost ready..." (keys `loading_*`). *(In the iboplayer build the status line markup is not shown — the calls are no-ops. On mobile: show the status line; it is useful.)*

### 1a. "Stuck on loading screen?" panel
Appears if the playlist is still loading after **120 s**.
- Title `stuck_on_loading`, text `stuck_on_loading_desc` ("The app may experience delays on the loading screen for various reasons. A large playlist … selecting an alternative playlist.").
- Instructions `add_playlist_instructions_title` "Follow these simple instructions to add a playlist.": `visit_our_website` "Visit our website:" **iboplayer.com**; `navigate_to_manage_playlists` "Navigate to manage playlists page"; `enter_mac_address_label` "Enter your mac address:" MAC; `enter_device_key_label` "Enter your device key:" key; `add_or_edit_playlists` "Add another playlist or edit the currently added playlists".
- Buttons: `change_playlist` "Change Playlist" (abort loading → Playlists screen with error "Playlist loading aborted by the user" *(hard-coded)*; for a Stalker portal → Portals screen, "Portal loading aborted by the user"), `restart_app` "Restart App", `dismiss` "Dismiss" (hide panel, keep waiting).

### 1b. "Server URLs failed" panel
Appears when no backend server answers during device registration/login and no cached account exists.
- Title `server_urls_failed` "Server URLs failed" (or `msg_server_backup_urls_failed` "Server & backup URLs failed" when the proxy backup domains also failed, plus `urls_failed_fallback_note` "All backup connection servers were unreachable." and "Code: E-SX-ALL").
- Text `urls_failed_desc` "You can contact our customer support to get a custom URL to retry. visit our website" + website.
- Input (placeholder "example.com") for a custom server domain; button `try_again` "Try again". A typed domain that works is remembered for later launches; it is forgotten if it fails.

---

## 2. Terms dialog (`terms_dialog`)
Shown once, on first launch, before device identification.
- Title `terms_welcome` "Welcome to IBOPLAYER".
- Body: `terms_intro_a` "Our products and services are designed for" **`terms_legal_use_only` "legal use only"** `terms_intro_b` ". By accessing this application, you confirm you understand and agree to the following: You are permitted to use our services only for purposes such as:" then list: `terms_use_personal_media`, `terms_use_licensed`, `terms_use_private_streams`, `terms_use_free_to_air`, `terms_use_dev_testing`.
- Warning box: `terms_warning_a` "You agree that you will" **`terms_warning_not` "NOT"** `terms_warning_b` "use our services for unauthorized streaming of copyrighted content." / `terms_warning_c` "You are solely responsible for ensuring your use complies with all applicable laws and copyrights."
- Note `terms_note` "By clicking \"Accept,\" you agree to our Terms and Conditions…".
- Single button `accept` "Accept". Back = exit dialog. No decline button.

---

## 3. Device verification (captcha) dialog (`v4_captcha_modal`)
Shown when the device has no backend token yet (first launch, after Clear Cache, after a 401/404 from the backend), or when the backend asks to re-verify device ownership.
- Title `verify_your_device` "Verify Your Device"; subtitle `verify_device_desc` "Type the characters you see to verify this device." (uid mismatch variant: server message or "Device ID mismatch. Enter the code shown to verify ownership." *(hard-coded)*).
- Left: captcha image (SVG), typed code display (`type_the_code` "Type the code…"), keyboard.
- "or" (`or`).
- Right: QR code to verify on the phone (opens `https://iboplayer.com/device/verify?d=<encrypted payload>`), hint `scan_enter_code_phone` "Scan and enter the code on your phone", button `continue` "Continue" (checks with the server whether the phone verification is done).
- Buttons: `new_code` "New Code" (not in uid mode), `verify` "Verify", `cancel` "Cancel" (only when opened from the Stararcs page).
- Errors (hard-coded): "Please enter the code shown above.", "Not verified yet. Finish entering the code on your phone, then press Continue again.", "Network error. Please try again.", "Verification failed.", server message; on a wrong code a new captcha is fetched.
- Uid mode: code is upper-cased automatically.
- **Mobile:** keep as a screen: captcha image + native text field + Verify + New Code; the "scan QR on phone" half is pointless on a phone — replace with a button "Verify in browser" that opens the same verify URL, then "Continue".

---

## 4. Welcome / activation screen (`login-container`)
Shown after device registration when the device is **not registered/activated yet (trial)**, or when the **app license expired**.

**Trial variant** (`mac_registered` = false):
- Left: logo; heading "Experience Entertainment, Redefinedss" (`msg_experience_entertainment_redefinedss`, sic); `login_description`; "Trial period notice your complimentary trial ends in **N days.**" (N from server `trial_days`); `trial_thank_you` "Thank you for choosing us to bring your entertainment to life."
- Right: `to_continue_using_app` "To Continue Using The App"; `continue_demo_note` "Press Continue to explore our demo. or visit our website to add your own playlist. After your trial period, a license purchase will be required."; `adding_playlist_title` "Adding Playlist:" with steps: `visit` "Visit" iboplayer.com; `login_instruction_2` "Log in using your device's MAC Address and unique device key."; `device_id_label` "Device ID:" MAC and `device_key_label` "Device key:" key; `login_instruction_4` "Add your preferred playlist, then restart the app to enjoy your updates."
- Button `login` "Continue" → loads the playlist (normal login).

**Expired variant** (app `expire_date` < today):
- Heading `msg_notice_trial_period_expired` "Notice: Trial Period Expired!" (red), `msg_thank_you_for_choosing_our_app_if` "Thank you for choosing our app. If you have any questions or need assistance. please contact our support team.", `msg_your_trial_period_has_ended_to_continue` "Your trial period has ended. To continue enjoying uninterrupted access to our app, please follow the instructions below to purchase and activate yor license." Last instruction becomes `msg_activate_your_device_and_subscribe_with_a` "Activate your device and subscribe with a variety of payment methods."
- **No Continue button** — the user is blocked; only Back → exit dialog.

Registered and not expired → this screen is skipped.

---

## 5. Home (`home_page`, iboplayer home)
Purpose: main menu after a playlist loaded.

Top bar:
- Logo; when the Stararcs proxy is connected: flag + `connected_to` "Connected to" + country name.
- Weather/date block: city, country; date "Sun. 10 Sep 2024"; clock "hh:mm AM" (updates every 30 s); weather icon + °C (from IP geolocation weather API, cached).
- Expiry block: `playlist_will_expire_in` "Playlist will expire in" | value ("N days", "1 day", `msg_a_few_hours` "a few hours" for 0, `msg_unknown` "Unknown"). Hidden for Stalker. Stays "Unknown" if unlimited.
- Icon buttons: **Account** (→ Account screen), **Search** (→ global Search; hidden when Load on Demand is enabled or the playlist is Stalker), **Refresh** (reloads the app).

Main tiles (data-action names):
| Tile | Label | Action |
|---|---|---|
| live_favorites | `live-favorites` "Live Favorites" | Live TV opened on Favourites only (no category list). Hidden when "Toggle Home Favorites" is Off or for Stalker. Empty → toast `sorry` "Sorry" / `msg_you_have_no_favorite_channels` "You have no favorite channels." |
| live | `live_tv` "Live TV" | Live TV screen |
| vod | `movies` "Movies" | Movies grid |
| series | `series` "Series" | Series grid |
| replay | `replay` "Replay" | Replay (catch-up) grid. Stalker: toast "Sorry" / `msg_replay_not_available_for_stalker_portals` "Replay not available for stalker portals" |

With Load on Demand (or Stalker), tapping Live/Movies/Series first downloads that section's categories+streams with the loader (Back cancels → toast `cancelled` "Cancelled" / `msg_data_loading_aborted` "Data loading aborted"; failure → `failed` "Failed" / `msg_data_loading_failed` "Data loading failed").

Device info block (bottom-left, shrinks after 5 s): `mac_address_label` "Mac Address:", `device_key_label` "Device Key:", `app_expiration_label` "App Expiration:" (app license date).

Control row:
| Control | Label | Action |
|---|---|---|
| sports | `sports-channels` "Sports Channels" | Live TV in Sports mode (R-100). No sports channels → "Sorry" / `msg_no_sport_channels_found_in_your_playlist` "No sport channels found in your playlist." |
| playlists | `change_server` "Change Server" | Playlists screen |
| settings | `settings` "Settings" | Settings (opens Media Player panel) |
| portals | `stalker_portals` "Stalker Portals" | Stalker Portals screen |
| stararcs | `stararcs-proxy` "Stararcs Proxy" | Stararcs screen |

Playlist expiry notification (popup over Home at entry, when the Xtream playlist expires in 0–5 days): title `notification` "Notification"; body `expiry_notice_a` "Your playlist will expire in" **N days** `expiry_notice_b` ". To extend your playlist please contact your IPTV provider."; footer `expiry_notice_footer` "Note: The playlist channel expiry date is unrelated to your app license. This is out of our control, please contact your IPTV provider for further information."; button `dismiss` "Dismiss".

No active playlist when opening a section → toast "Sorry" / `msg_no_active_playlist_now_please_select_one` "No active playlist now<br>Please select one playlist in change playlist page".

Back on Home → exit dialog.

---

## 6. Playlists screen ("Choose Your Playlist", `playlists_page`)
Purpose: pick the active playlist (Xtream / M3U), add an Xtream playlist, delete, see expiry.
- Title `choose_your_playlist` "Choose Your Playlist".
- Error banner (shown when arrived because loading failed): `playlist_error_1` "Playlist is not working or your subscription has expired." `playlist_error_2` "Please contact your IPTV provider for renewal or support." `playlist_error_3` "The app provider is not responsible for playlist services." — or a specific message replacing it:
  - generic: "Sorry, there is a problem with your playlist. Please contact your IPTV provider. **IBOPlayer does not manage or sell playlist subscriptions**" *(hard-coded)*
  - Xtream expired: "Your playlist subscription has expired. Please contact your IPTV provider. IBOPlayer does not manage or sell playlist subscriptions"
  - entry without URL (demo/sample): "This playlist has no server address, so there is nothing to load. Please add your playlist to get started."
  - all playlists failed (auto switch): "All playlists failed to load. Please check your subscriptions or contact your IPTV provider."
  - user aborted: "Playlist loading aborted by the user"
- Playlist cards (Stalker portals are **excluded** — they live on the Portals screen): logo tile, name, badge "CURRENT" *(hard-coded)* on the active one (not shown when the screen was opened at startup in "Playlist Selection" mode), expiry line "Expires at 15 Aug 2025" / `msg_unlimited` "Unlimited" / hidden if unknown. Expiry is fetched when a card is focused (Xtream only, cached 5 min) and reported to the backend.
- Per card: delete button (trash) → inline confirm ✓ / ✕. Delete calls the backend; failure → `error` "Error" / `msg_failed_to_delete_playlist` "Failed to delete playlist."; if only one playlist exists → "Sorry" / `msg_you_need_to_have_1_playlist_at` "You need to have 1 playlist at least". Deleting the active playlist clears the selection.
- (Edit/pencil button: disabled in IBOPlayer.)
- Buttons column: `auto_switch_playlist` "Auto Switch Playlist" toggle; `start_on_playlist` "Start on Playlist" toggle; `add_playlist` "Add Playlist" (→ Add playlist screen); `reload` "Reload" (restarts app keeping proxy connection); `playlists_qr_code` "Playlists QR Code" (shows a QR to the website "add playlist by QR" page for this device: `https://iboplayer.com/qr-playlist?identifier=<AES-encrypted MAC>&type=xc`); `stalker_portals` "Stalker Portals" (→ Portals screen); `stararcs-proxy` "Stararcs Proxy".
- Device info: MAC, Device Key.
- Footer: `playlists_footer_a` "IBOPlayer is a general media player and it does not include any content, IBOPlayer is not responsible for the content you use in the application." `playlists_footer_b` "Please follow" iboplayer.com `playlists_footer_c` "to add or manage your playlists."
- Tapping a card → activates it and reloads the app content (loading screen).
- Back: to Home — unless the screen was reached at startup (Playlist Selection mode) or after a load error, in which case Back = exit dialog (there is no working home).
- Empty list: no cards (only buttons). *(No explicit empty-state text on TV — add one on mobile.)*

## 7. Add playlist screen (`playlist_edit_page`)
- Title `add_new_playlist` "Add a new playlist". (Type tabs General/XC/Code hidden in IBOPlayer: only XC.)
- Fields: `playlist_name` "Playlist Name"; `playlist_url` "Playlist URL, or Host URL (For XC case)" (placeholder "Playlist URL ( EX: http://example.com:port )"); `user_name` "Username (For XC)"; `password` "Password". Name max 64, URL max 512 chars.
- Button `save_upper` "SAVE".
- Divider `or_upper` "OR", then `scan_to_add_playlist` "Scan to add a playlist from your phone" + `scan_to_add_playlist_desc` + QR (same website QR as above).
- Validation (hard-coded): "Sorry, playlist name is required", "Sorry, playlist url is required", "Sorry, username is required", "Sorry, password is required". Server test of the Xtream login (60 s timeout); invalid/expired/banned → "Sorry, your playlist is not working. Please check it and try again".
- On success: saved to the backend (add); on backend failure it is saved locally and queued to retry on next launch (R-030). Returns to the Playlists screen with the new card. Back during saving cancels (nothing stored).

## 8. Stalker Portals screen (`portal_list_page`)
- Heading `stalker_portals` "Stalker Portals"; list of portals: name + "▶ Selected" *(hard-coded)* on the active one, URL, MAC.
- Empty: "No portals yet. Use the **+ Add Stalker Portal** button below to add one." *(hard-coded)*
- Error banner when arrived after a failed connect: "Your portal subscription has expired. Please contact your IPTV provider." / "Sorry, the portal is currently unavailable. Please contact your IPTV provider." / "Portal loading aborted by the user".
- Card `device_information` "Device Information": `device_model` "Device Model" (e.g. "Samsung Tizen TV"), `stalker_virtual_mac` "Stalker Virtual MAC" (`detecting` "Detecting..." then `00:1A:79:` + last 3 bytes of the device MAC, or a random persistent one), `software_mac` "Software MAC", `device_key` "Device Key".
- Card `stb_profile` "STB Profile": radio MAG 250 / MAG 322 / MAG 520 / IBOPlayer — saved on tap.
- Buttons: `add_portal_btn` "+ Add Portal", `remove_portal` "Remove Portal" (removes the highlighted portal, no confirmation; errors `msg_please_select_a_portal_from_the_list` "Please select a portal from the list first.", `msg_you_need_to_have_at_least_1` "You need to have at least 1 playlist.", `msg_failed_to_delete_portal` "Failed to delete portal."; removing the active portal sends the user to the Playlists screen), `portal_url_qr` "Portal URL QR" (QR modal `add_stalker_portal` "Add a Stalker Portal", `press_back_to_close`; QR = website qr-playlist page with type=stalker), `playlists_page` "Playlists Page".
- Tap a portal → it becomes active, app content reloads.
- Back → Home (focus on Portals tile), or exit dialog if reached at startup/after an error.

## 9. Add/Edit Portal screen (`portal_edit_page`)
- Title "Add Portal"/"Edit Portal" (`add_portal`), subtitle `portal_subtitle` "Connect a MAG / Stalker middleware portal".
- Fields: `portal_name` "Portal Name" (placeholder "My Portal"), `primary_url` "Primary URL" ("http://yourportal.com:8080"), `fallback_url` "Fallback URL" `optional` "(optional)", `mac_address` "MAC Address" (pre-filled with prefix + detected suffix), `mac_prefix` "MAC Prefix" buttons **00:1A:79** / **00:1C:1D** (switching rewrites the prefix).
- Buttons `save_portal` "Save Portal", `cancel` "Cancel".
- Validation: `msg_portal_name_is_required`, `msg_portal_url_is_required`, `msg_mac_address_is_required_please_wait_for`, `msg_invalid_mac_address_format_expected_xx_xx`. Save test-connects (primary, then fallback); failures: portal message, "Server not responding", `msg_portal_connection_failed` "Portal connection failed", "Portal connection failed (primary and fallback)".
- Saved to the backend like playlists (queued locally if the backend fails).

---

## 10. Live TV screen (`channel_page`)
Purpose: browse live categories and channels, preview, fullscreen, EPG, favourites.

Layout (TV, "Classic" by default; Normal/Modern variants from Channel Theme): title `live_channels` "Live Channels" (or `sports-channels` "Sports Channels" in Sports mode); **category list**; **channel list**; **preview player**; **programme info**; **action buttons**.

Category list:
- Virtual rows first (Xtream/M3U): **"Search All Channels"** (opens Live search), **"Recently Viewed"** (last 15 watched), **"Favourites"**, then custom categories (if enabled), then provider categories (with manual/Arrange order), "Uncategorized" if needed. Stalker: no "Search All Channels"; portal "All" aggregators removed.
- Each row: icon (virtual icon / custom icon / **country flag** detected from the name / generic broadcast icon), name, count + `channels` "Channels" (no count for Stalker, none for row 0).
- Adult categories (name contains xxx/adult/porn) ask for the PIN (title "Parent Control", error "Sorry, parent password does not match.") unless parental control is Off.

Channel list rows: channel number (provider `num`, or position), logo, name, custom-category badges (up to 2 icons + "+N"), star if favourite. The playing row is highlighted.

Preview + info panel: first tap on a channel = play in preview; tap the playing channel again = fullscreen. After **15 s idle** on the list while something plays → auto-fullscreen. "Now Playing..." (`now_playing`) card: channel name, `live` "LIVE" badge when a programme is on now, description, progress bar, start/end times; next up to 4 programmes "HH:mm ~ HH:mm Title" (EPG from provider short EPG, refreshed every 60 s). No EPG → blocks hidden.

Action buttons (colour-labelled on TV):
| Button | Label | Action |
|---|---|---|
| Red | `move` "Move" | re-order mode: move the selected category or channel up/down; saved per playlist. Not allowed on "Search All Channels" (`msg_you_cannot_move_search_all_channels` "You cannot Move Search All Channels."); category can't move to position 0 |
| Blue | `search` "Search" | opens Live search (hidden for Stalker) |
| Yellow | `fav` "Fav" | favourite/"Add to" chooser for the selected channel |
| Green | `switch-page` "Switch Page" | dialog: Movies / Series / Replay / Settings / Change Playlist |
| – | `arrange` "Arrange" | Arrange Categories page (hidden in Sports mode, in Favourites-only mode, and when feature off) |
| – | `epg` "EPG" | EPG Guide page (hidden for M3U playlists) |

Favourite toggle messages: `favorites` "Favorites" / "<name>`msg_added_to_favorites`" " added to Favorites." / " removed from Favorites."; adult → `parental_safety` "Parental safety" / `msg_adding_protected_content_to_favourites_is_not` "Adding protected content to favourites is not allowed."

Fullscreen: top bar (logo, number + name, app logo), clock, EPG now/next with progress, buttons EPG / Previous / Next / Audio; info auto-hides after 7.5 s. Up/Down = previous/next channel (CH+/-), number keys = direct channel number (2 s; `msg_channel_does_not_exist` "Channel does not exist"). Left/Right opens the **channel strip** (horizontal list of the category with EPG Now/Next/Later `now`/`next`/`later`) and **settings row**: `aspect_ratio` "Aspect Ratio" (Stretch / 16:9 Standard / 21:9 Ultra Widescreen / 4:3 Traditional / 1:1 Square), `subtitles` "Subtitles" (Off + tracks), `audio` "Audio" (tracks or Default), Favourite star. Strip auto-hides after 5 s. Reconnect overlay `reconnecting` "Reconnecting...".

States:
- Favourites-only entry (Home "Live Favorites"): category list hidden; empty → back to Home + "You have no favorite channels."
- Category with no channels: nothing plays; list empty.
- Stalker: channels loaded page by page when scrolling to the end; stream URL resolved per channel; failure → `msg_stream_could_not_be_started` "This stream could not be started. Please try again later."
- Back: fullscreen → list; list → Home.

### 10a. Live search dialog (legacy, inside live page)
Input "At Least 2 Characters needed To Search" *(hard-coded placeholder)*, results by name (≥2 chars, all categories, sorted A-Z), `msg_no_results_found` "No results found!". *(Blue key now goes to the Search page instead; keep one search on mobile.)*

### 10b. Switch Page dialog
`switch-page` "Switch Page": `movies`, `series`, `replay`, `settings`, `change_playlist`. Leaves Live and opens that section.

## 11. EPG Guide (`epg_guide_page`, feature)
Full-screen timeline for the **channels of the selected category**, today (00:00–24:00), 30-min ticks, now-line.
- Header "EPG · <category name>", "N channels", clock "ddd, D MMM · HH:mm", selected programme title / "channel · start - end" / description; preview player with channel number+name.
- Rows: number, logo, name; programme cells (past / live / future styles; consecutive same-title slots merged). Placeholders "Loading...", "No guide", "EPG unavailable" *(hard-coded)*.
- Hint `epg_guide_hint` "UP / DOWN change the channel · LEFT / RIGHT move along the day · OK plays".
- Tap a current/future programme: first tap = preview that channel; second = go fullscreen on the Live page. Past programme → "Sorry" / `msg_catch_up_is_not_available_from_the` "Catch-up is not available from the guide".
- Loads EPG lazily ~10 rows around the focus, max 4 parallel requests; cached per playlist for the session. If the first 8 rows have no programmes → toast `msg_no_epg_available_for_this_category` "No EPG available for this category" (or `msg_epg_could_not_be_loaded_please_try` "EPG could not be loaded. Please try again." if nothing answered, 15 s watchdog) and return to Live.
- Opening checks: M3U → `msg_epg_is_not_available_for_this_playlist` "EPG is not available for this playlist"; empty category → `msg_this_category_has_no_channels` "This category has no channels".
- Back → Live page on the focused channel (same category).

## 12. Arrange Categories (`category_arrange_page`, feature)
- Title `arrange_categories` "Arrange Categories", text `arrange_categories_desc` "Pick the categories you want at the top of the live list, in your own order."
- Left: search box (`search_categories` "Search categories"), list of all live categories except Search All/Recently Viewed/Favourites, with channel count and a position badge if picked; `no_categories_found` "No categories match your search."
- Right: `preview` "Preview" ("N picked"), ordered picked list with grip; empty `arrange_preview_empty` "Nothing picked yet. Press OK on a category to add it here."; items can be grabbed and moved.
- Actions `reset` "Reset" (toast `msg_order_cleared_press_save_to_apply` "Order cleared. Press Save to apply."), `save` "Save".
- Leaving with changes → dialog `unsaved_changes` "Unsaved changes" / `arrange_unsaved_text` "Your category order has not been saved yet. Leave now and it will be lost." with `save_and_exit` "Save", `discard` "Discard", `keep_editing` "Keep editing".
- After save: toast `msg_your_category_order_has_been_saved` "Your category order has been saved."; live list shows pinned rows (Search All, Recently Viewed, Favourites) then picked categories in order, then the rest.
- Footer hints (TV): `arrange_hint_pick`, `arrange_hint_buttons`, `arrange_hint_move`, `arrange_hint_keypad` — drop on mobile.

## 13. Movies / Series / Replay grid (`vod_series_page`)
One screen for three modes.
- Left sidebar: title ("Movies"/"Series"/"Replay"), category search box (placeholder "Category Search"; filters names, keeps "Search All" first), category list with icon and count.
  - Movies rows: **Search All Movies**, **Continue Watching** (movies with saved progress), **Favourites**, **Top Rated** (10 highest-rated), **Newly Added** (added in last 15 days), custom categories, provider categories, Uncategorized.
  - Series rows: **Search All Series**, **Recently Viewed** (series with progress), **Favourites**, **Top Rated**, **Recently Added/Updated** (modified last 15 days), custom, provider, Uncategorized.
  - Replay rows: live categories filtered to channels with archive (tv_archive ≠ 0 and duration ≠ 0).
  - Stalker: no Search All, no Top Rated/Newly Added/Recently Added; counts only on Favourites/Continue Watching; items paged from the portal.
- Top menu (icons): **Search** (red), **Sort** (blue), **Theme** (green; hidden for Replay), **Favourite** indicator (yellow; hidden for Replay).
- Hero info panel ("Modern" theme, TMDB on): backdrop (or YouTube trailer auto-playing after 5 s idle on a card), title/logo, IMDb-style rating, year, duration, genre, synopsis, `director_label` "Director:", `cast_label` "Cast:" ("Not Provided" when empty).
- Current category name above the grid; grid of posters (7 per row; Top Rated = one row with big rank numbers 1–10 and a **Refresh** shuffle button when ≥20 items share the top rating). Card: poster, title (2 lines), badge "NEW" (movies added ≤15 days / series modified ≤15 days), "S{n}EP{m}" last watched (series), star if favourite, progress bar.
- Rendered 40 at a time (infinite scroll).
- Sort dialog: `default` "Default", `added` "Added", `a_z` "A-Z", `z_a` "Z-A", `rating` "Rating" (Stalker hides Z-A; for series also Rating).
- Theme dialog `movies-theme-control`: `classic_type` / `modern_type`.
- Adult category → PIN overlay "Parent Control".
- Tap card: Movies → Movie details; Series → Series details; Replay channel → catch-up list (below).
- Replay checks: playlist not Xtream/Stalker → `msg_replay_not_available_for_current_playlist` "Replay not available for current playlist" (also when no archive channels); Stalker with no categories → `msg_no_channels_available_for_replay`.
- Replay card tap errors: `msg_no_epg_available_for_current_channel` "No Epg Available for current channel", `msg_something_went_wrong_or_no_epg_available` "Something went wrong or no EPG available for this channel", provider error text, `something_went_wrong`; Stalker: `msg_no_epg_archive_available_for_this_channel`, `msg_failed_to_load_epg_for_this_channel`.
- Back: grid → sidebar → Home.

## 14. Catch-up (Replay programme list) (`catchup_page`)
- Left: `epg` "EPG" title and a list of past days (day name "Monday", date "Sep 9") that have archived programmes.
- Right: channel logo + name, programmes of the selected day "HH:mm ⏰ Title", description of the focused one ("No Description").
- Only programmes that already ended are listed (list stops at the first programme that is current/future).
- Tap programme → player in catch-up mode (Xtream timeshift URL: start time adjusted to server time, duration in minutes).
- Back → programme list → Replay grid.

## 15. Movie details (`vod_summary_page`)
- Backdrop (TMDB/provider), poster, title or TMDB logo image, rating stars + value (x.x), release date, duration, genre, director, cast, plot.
- Buttons: `start_watching` "Start Watching" / `continue_watching` "Continue Watching" with progress bar and "NN%" when progress > 0; `watch_trailer` "Watch Trailer" (only if the provider has a YouTube trailer, not on Samsung/LG); favourite star.
- `cast` "Cast" row: TMDB cast photos and names (TMDB on).
- Favourite on a protected (adult) category → "Parental Safety" / adult message. Favourite change is committed when leaving the page.
- Loading: loader until provider info arrives; error → page still shows list data.
- Stalker: info from the portal, enriched with TMDB by title search.

## 16. Series details (`series_summary_page`)
- Backdrop, poster, title/logo (scrolls if >25 chars), rating, release date, genre, cast, plot, favourite star (`toggle_favorite`).
- Seasons list ("Season N" + episode count), sorted by number, empty seasons removed.
- Episodes of the selected season: thumbnail (series cover), title or "Episode N", duration "NNmin", progress bar + "NN%".
- Tap episode → player (series mode, with next/previous episode).
- Errors: `msg_no_seasons_available` "No seasons available" (goes back), `msg_no_episodes_available` "No episodes available".
- M3U series: seasons/episodes parsed from names like "Show S01E02".

## 17. Trailer player (`trailer_page`)
YouTube player full screen; OK = play/pause, left/right = ±5 s; error or YouTube unavailable → "Sorry" / `msg_no_trailer_video_available` "No trailer video available".

## 18. Search page (`search_page`)
Two modes:
- **Global ("all")**, from Home search icon: input on top; three horizontal result rows: `live_tv` "Live TV", `movies` "Movies", `series` "Series". Search runs 0.4 s after typing (any length ≥1), case-insensitive "contains" on names; results skip adult categories and the duplicate rows (Top Rated / Newly Added / Recently Added). Rows render 50 at a time. Empty row → "No results found!".
- **Scoped** (from Live "Search"/"Search All Channels", Movies/Series top Search or "Search All …" row, Replay search): keyboard + suggestions list (first 25 names) + results grid (3 columns for live/replay, 4 for movies/series); needs ≥3 characters; `msg_type_to_start_searching` "Type to start searching...". Stalker: search asks the portal (movies/series only; live search not available).
- Tap result: live channel → Live page on that channel's category and plays it; movie → Movie details; series → Series details; replay channel → Replay grid on that channel.

## 19. "Add to" chooser (`collection_modal`)
Opens instead of a direct favourite toggle when Custom Categories are enabled (and in Sports mode always, reduced).
- Title `add_to_collection` "Add to". Rows: "New category" (+ icon; not in reduced mode) → Custom Categories page, then back here with the new category focused; "Favorites" (star, checked if favourite); "My Sports Channels" (live only, when Sports on); each custom category (checked = member). Tap toggles membership. Close = Back. Adult → favourites blocked with the parental-safety toast.

## 20. Custom Categories page (`custom_categories_page`)
- Title `custom_categories`, text `custom_categories_desc` "Create your own collections and add channels, movies and series to them."
- Toggle `enable_custom_categories` "Enable Custom Categories". When off: overlay `custom_categories_disabled_title` "Custom Categories are turned off" / `custom_categories_disabled_desc` "Turn on the switch above to create and manage your own collections."
- List: icon, name, total member count (live+movies+series of the current playlist); empty `custom_categories_empty` "No custom categories yet. Create one to get started."; `create_new_category` "Create New Category".
- Create: name ("New Category Name", max 32; empty → `name_required` "Name required" / `msg_please_enter_a_category_name`) → icon picker (`choose_an_icon` "Choose an icon", 12 icons).
- Per category actions: `rename` "Rename", `change_icon` "Change Icon", `delete` "Delete" → confirm `delete_category_confirm` "Delete this category?" + name, `yes`/`no` (default No).

## 21. Settings page
See `settings.md` (16 items).

## 22. Account page (`account_page`)
Read-only.
- `device_info` "DEVICE INFO": `mac_address` "MAC Address" (upper case), `device_key` "Device Key", `platform` "Platform" (e.g. SAMSUNG).
- `app_info` "APP INFO": `status` "Status" (`msg_active` "Active" if license type 2 or 3, else `msg_trial` "Trial"), `expiration_date` "Expiration Date" (app license), `app_version` "App Version".
- `playlist_info` "PLAYLIST INFO": `username` "Username" (Stalker: portal MAC), `status` "Status" (provider status e.g. Active/Expired; Stalker: Active), `expiration_date` "Expiration Date" (provider expiry or `msg_unlimited`; Stalker: portal expiry).
- Back → Home.

## 23. Stararcs Proxy page (`stararcs_page`)
Paid smart-proxy service (third party "Stararcs").
- Description `smart_proxy_desc`.
- Loading `proxy-loading` "Checking your subscription...".
- Not subscribed: `proxy-sub-instructions` "This device does not have an active stararcs proxy subscription. Scan the QR code to make an account and subscribe to this service." + QR (subscription URL from Stararcs) + `continue` "Continue" (re-check, disabled 5 s). Error variant: message (e.g. "Couldn't reach Stararcs.") + technical detail + button "Try again".
- Active (Subscribed or Guest): badge `msg_subscribed` "Subscribed" / `guest_user` "Guest User", quota "x.xx GB remaining of N GB" + bar, plan + "YYYY/MM - YYYY/MM - Active"; rows `toggle-connection` "Toggle Connection" (switch), `region` "Region" and `country` "Country" (left/right cycle; `nearest` "Nearest" default label), server "Server N"; guest not connected: `stararcs_subscribe_text` + QR.
- `keep-connection` "Keep Connection" toggle; `logout` "Logout" (subscribers only) → dialog `logout_confirm_title` "Log out?" / `logout_confirm_desc` "This will unlink this device from Stararcs. You can register it again at any time by reopening this page." `cancel` / `logout`. Results: `msg_this_device_has_been_unlinked_from_stararcs`, `couldn_t_log_out` + `msg_stararcs_refused_the_request_access_denied` or server text.
- Status toasts (after Continue): `success` / `msg_you_are_now_subscribed_to_the_service`; `guest_access` / `msg_you_re_using_free_guest_access`; `expired` / `msg_your_subscription_has_expired`; `quota_limit` / `msg_you_ve_used_all_your_quota`; `failed` / `msg_we_couldn_t_find_an_active_subscription`; `not_registered` / "This app is not registered with Stararcs."
- May show the device verification dialog first (with Cancel) if the device has no Stararcs token.

## 24. Exit (`turn_off_page`)
The exit confirmation dialog (see §0). Opened by Back on Home, and on Playlists/Portals screens when there is no loaded content, and on the welcome/terms/captcha screens.

## 25. Player page
Full description in `player.md`. Entry points: Live preview/fullscreen (live), Movie details "Start/Continue Watching" (movie), Series episode (series), Catch-up programme (epg/timeshift). Includes resume dialog (`resume` "Continue from where you left" / `resume_video` "Do you want to resume the playback from the last position?" + time, Yes/No, auto-dismiss 15 s), autoplay toggle, subtitles/audio, next/previous item.

---

## Things the mobile app should drop (TV-only)
- Colour-key labels and all remote-key navigation (focus rows, "hover" behaviour, Up/Down channel zapping by key, number-key channel entry).
- On-screen keyboards (static keyboard, keyboard overlay) — native keyboard.
- Exit dialog on Back from Home → use Android convention: Back on the Home tab exits (optionally "Press back again to exit" toast); keep the dialog only if the product owner wants parity.
- Channel Theme layouts (Classic/Normal/Modern) and Movies Theme Control (Classic/Modern) — mobile has one Netflix-style layout.
- Idle auto-fullscreen after 15 s (replace with tap-to-fullscreen / rotate-to-landscape).
- "Scan QR with your phone" parts (you *are* the phone) → replace with "Open website" buttons / direct in-app forms.
- The "shrinking device info block" and TV clock/weather header (optional on mobile; can live in Account).
- Aspect-ratio names can stay (player).

## Notes / uncertainties
- `login_operation.js` sets `mac_address = "52:54:00:12:34:57"` before platform detection; on Samsung/LG/VIDAA/Zeasn/TitanOS it is overwritten by the real id, on other platforms (Windows/browser) the constant stays. Looks like a debug default; the mobile app needs its own stable device id (see backend docs).
- The playlist "CURRENT" badge, portal "▶ Selected", and several validation messages are hard-coded English (not in en.json). Add keys on mobile.
- The global search in "all" mode has no minimum length; scoped search needs 3 characters; the legacy live search dialog needs 2. Pick one rule on mobile (suggest ≥2).
- On Stalker, the Movies/Series top "Search" button is skipped by remote navigation, but the Search page supports Stalker VOD/series search — search is effectively reachable only by mouse. Suggest enabling VOD/series search for Stalker on mobile.
- Series details has no parental check for favourites (movies do).
