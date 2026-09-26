# IBO backend API reference

Every call the IBOPlayer TV app makes to IBO-owned servers (agent + panel). Third-party and auxiliary services are in [services.md](services.md).

Conventions used below:

- `enc(x)` = `encryptRequest(x)`; `dec(r)` = `decryptResponse(r)`. Algorithms in [device-and-auth.md §3](device-and-auth.md#3-request--response-obfuscation-encryptrequest--decryptresponse).
- `<panel>` = a panel base URL such as `https://app.ibo-dev.com/api` (chosen by the failover in [overview.md §4](overview.md#4-server-selection-in-detail)).
- `<app_type>` = platform name (`samsung`, `lg`, ...; Android value to be agreed).
- `<version>` = app version string for the platform (e.g. `1.1.6`).
- Example values are fake.

## Summary

| # | Endpoint | Method | Body | Auth | Response |
|---|---|---|---|---|---|
| 1 | `<agent>/playlist_info` | POST | form `data=enc(...)` | — | encrypted |
| 2 | `<panel>/<app_type>/v4/recaptcha` | POST | JSON plain | — | plain JSON |
| 3 | `<panel>/<app_type>/v4/device_login` | POST | JSON `{data: enc}` | — | encrypted |
| 4 | `<panel>/<app_type>/v4/device_info` | POST | JSON `{data: enc}` | Bearer | encrypted |
| 5 | `<panel>/<app_type>/v4/manage/add_playlist` | POST | JSON `{data: enc}` | Bearer | plain JSON (errors may be encrypted) |
| 6 | `<panel>/<app_type>/v4/manage/update_playlist` | POST | same | Bearer | same |
| 7 | `<panel>/<app_type>/v4/manage/delete_playlist` | POST | same | Bearer | same |
| 8 | `<panel>/<app_type>/v4/device/add` | POST | JSON `{data: enc}` | Bearer | encrypted |
| 9 | `<panel>/changeParentPin` | POST | form `data=enc(...)` | — | encrypted |
| 10 | `<panel>/edit_playlist` | PUT | form, plain fields | — | ignored |
| — | Website links: `/device/verify`, `/qr-playlist`, `/images/upload/<file>` | GET (browser/image) | — | — | — |

## Common rules for V4 calls (#2–#8)

- URL: `<panel>/<app_type>/v4/<path>` (plus the TV-only `hostProxiedPrefix` in front when the boot used the Stararcs asset proxy).
- Headers: `Content-Type: application/json`; `Accept: application/json` (jQuery `dataType: "json"`); `Authorization: Bearer <v4_token>` for protected calls.
- Body: `{"data":"<enc(payload)>"}` for encrypted calls, or the payload itself as JSON for plain calls.
- Timeout 15 s per server; failover to the next panel on transport failure only.
- Response decoding:
  - encrypted calls: body is `{"data":"..."}` → `dec(body)`;
  - plain calls: body used as is;
  - "plain with encrypted errors" (manage/*): if the body has a string `data` and **no** `status` key, it is decrypted; if that fails it becomes `{status:"error", error_code:401, message:"Invalid device login token"}`.
- HTTP error with a JSON body: the body (decrypted if it is an envelope; if decryption fails → `{status:"error", error_code:403, message:"Invalid device login token"}`) is handed to the success logic as the server's answer.
- Auth failure detection and re-login: see [device-and-auth.md §4.3](device-and-auth.md#43-session-expiry--401-handling).

---

## 1. Agent: get panel domains — `POST <agent>/playlist_info`

**Purpose.** Get the current list of panel domains. First network call of every boot.

**When.** At startup, before anything else. Not repeated during the session.

**Request.**
```
POST https://babyeducate.com/api/playlist_info
Content-Type: application/x-www-form-urlencoded; charset=UTF-8

data=<enc({"mac_address":"a1:b2:c3:d4:e5:f6"})>
```
The TV builds `{mac_address, app_type: undefined, version: undefined}`; the undefined keys vanish in `JSON.stringify`. The encrypted string is form-urlencoded (so `+`, `/`, `=` are percent-encoded on the wire). Timeout 15 s.

**Response.** Encrypted envelope; decrypted:
```json
{
  "domains": ["app.ibo-dev.com", "iboapp.mimocodes.com"],
  "main_domain": "api.ibo-dev.com"
}
```
- `domains`: bare hosts; entries may also carry `https://` and/or `/api`, which are stripped. Each becomes `https://<host>/api`.
- `main_domain`: stored, unused.

**Errors.** Any failure (network, HTTP error, timeout) → next agent (random order, no repeats). All fail → `fallbackDomains` from config. A decryption failure of a 200 reply throws on TV (uncaught) — mobile should treat it as a failure and continue to the next agent.

**Persist.** `domain_lists` = decrypted reply.

Source: `login_operation.js` `fetchDomains`.

---

## 2. V4 `recaptcha` — start device verification

**Purpose.** Get a captcha for a device that has no session token, or learn that the device is already verified.

**When.** At boot when no V4 token is stored; after a 404 from `device_info`; after any auth failure; when the user presses "New Code"; after a captcha-related `device_login` failure.

**Request.** Plain JSON (not encrypted), no auth.
```
POST https://app.ibo-dev.com/api/samsung/v4/recaptcha
Content-Type: application/json

{"mac_address":"a1:b2:c3:d4:e5:f6","app_type":"samsung"}
```

**Response.** Plain JSON. Either:
```json
{ "status": "already_verified" }
```
→ call `device_login` immediately (no codes). Or:
```json
{
  "status": "success",
  "captcha": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"150\" height=\"50\">...</svg>",
  "token": "c1f0e2a4b6d8..."
}
```
- `captcha`: SVG markup, rendered as HTML. If it has no `viewBox` but has numeric `width`/`height`, the TV injects `viewBox="0 0 <w> <h>"` so it scales.
- `token`: the recaptcha token; sent back as `recaptcha_token` in `device_login`.

**Errors.** Any other shape → "Couldn't start device verification. Please try again." Network failure on every server → "Server URLs failed" screen (or, in the Stararcs sub-flow, an error message).

---

## 3. V4 `device_login` — register / log in the device

**Purpose.** Exchange device identity (+ captcha answer) for a V4 session token.

**When.** After `recaptcha` says `already_verified`; when the user submits a captcha; when the user presses "Continue" after verifying on the website; when refreshing a uid captcha.

**Request.** Encrypted, no auth.
```
POST https://app.ibo-dev.com/api/samsung/v4/device_login
Content-Type: application/json

{"data":"<enc(payload)>"}
```
Payload:
```json
{
  "mac_address": "a1:b2:c3:d4:e5:f6",
  "app_type": "samsung",
  "u_id": "K7MQ3X",
  "version": "1.1.6",
  "recaptcha_code": "x7fk2",
  "recaptcha_token": "c1f0e2a4b6d8..."
}
```
| Field | Source |
|---|---|
| `mac_address` | device MAC |
| `app_type` | platform |
| `u_id` | stored `v4_uid`, else a freshly generated pending one |
| `version` | app version for the platform |
| `recaptcha_code` + `recaptcha_token` | only when the user typed the recaptcha; `recaptcha_token` from step 2 |
| `uid_captcha_code` + `uid_captcha_token` | only in uid-captcha mode; code is uppercased; token from the `uid_mismatch_captcha` reply |

**Response.** Encrypted; decrypted:

Success:
```json
{ "status": "success", "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkIjoiYTFiMiJ9.sig" }
```
→ persist the pending `u_id`, persist the token, then `device_info` (or `device/add` in the Stararcs sub-flow).

Ownership challenge:
```json
{
  "status": "uid_mismatch_captcha",
  "captcha": "<svg ...>K7MQ3X</svg>",
  "captcha_token": "9a8b7c...",
  "message": "Device ID mismatch. Enter the code shown to verify ownership."
}
```
→ show the uid captcha (the image shows the u_id the backend has on file).

Failure:
```json
{ "status": "error", "error_code": 401, "message": "Invalid captcha" }
```
→ if `error_code == 401` or the message contains "captcha": show the message and fetch a new captcha (from "Continue": show "Not verified yet. Finish entering the code on your phone, then press Continue again." instead). Other errors: show `message` or "Verification failed.". Network failure: "Network error. Please try again."

---

## 4. V4 `device_info` — account and playlists {#device_info}

**Purpose.** The main account call: licence state, device key, playlists, parental PIN, backgrounds.

**When.** At every boot once a token exists (and right after `device_login`). Not polled during a session; the playlist page's "Reload the app" button restarts the whole boot.

**Request.** Encrypted, `Authorization: Bearer <v4_token>`.
```json
{
  "mac_address": "a1:b2:c3:d4:e5:f6",
  "app_type": "samsung",
  "u_id": "K7MQ3X",
  "version": "1.1.6"
}
```

**Response.** Encrypted; decrypted (every field the app reads):
```json
{
  "mac_registered": true,
  "expire_date": "2027-03-14",
  "is_trial": 2,
  "trial_days": 7,
  "device_key": "482913",
  "ip_address": "203.0.113.42",
  "parent_pin": "0000",
  "tmdb_api_key": "a3c79068cd6961a3526ba1b516c50c39",
  "themes": [
    { "name": "Future", "url": "https://app.ibo-dev.com/images/upload/125984.png" }
  ],
  "languages": [],
  "notification": {},
  "urls": [
    {
      "id": "65f1c0ffee1234567890abcd",
      "playlist_name": "My IPTV",
      "url": "http://line.example-iptv.tv:8080",
      "playlist_type": "xc",
      "username": "john",
      "password": "s3cret",
      "is_protected": 0,
      "pin": "",
      "expiration_date": "1767139200",
      "status": "Active",
      "auth": "Active",
      "fetched_at": "2026-09-20T10:00:00.000Z"
    },
    {
      "id": "65f1c0ffee1234567890abce",
      "playlist_name": "M3U list",
      "url": "http://example-iptv.tv/get.php?username=a&password=b&type=m3u_plus&output=ts",
      "playlist_type": "general"
    },
    {
      "id": "65f1c0ffee1234567890abcf",
      "playlist_name": "Portal",
      "playlist_type": "stalker",
      "portal_name": "Portal",
      "url": "http://portal.example.tv/c/",
      "portal_address": "http://portal.example.tv/c/",
      "portal_fallback_address": "",
      "stalker_mac_address": "00:1A:79:12:34:56"
    }
  ]
}
```

| Field | Used for |
|---|---|
| `status`, `error_code`, `message` | Only present on errors / challenges: `uid_mismatch_captcha` → uid captcha; `error` + 404 → forget token, re-verify; other `error` → "Server URLs failed" screen. |
| `mac_registered` | falsy → trial welcome screen (with Continue); truthy → auto-login. |
| `expire_date` | `YYYY-MM-DD`. If `< today` → blocked "expired" screen. Displayed as app expiry on the account page. |
| `is_trial` | `2` or `3` → account page shows "Active", else "Trial". |
| `trial_days` | Shown in "your complimentary trial ends in N days" (trial screen only). |
| `device_key` | Shown next to the MAC everywhere the user is told how to log in on the website. If missing, the previously cached value is kept. |
| `ip_address` | Used as the weather lookup location and in analytics sessions. |
| `parent_pin` | If truthy, overwrites the local parental PIN (`parent_account_password`). `"off"` = disabled. If absent, the local/default `0000` stays. |
| `tmdb_api_key` | If present, replaces the built-in TMDB key for the session. Only applied in the normal (`automatic`) start path. |
| `themes[]` | Background choices. `url` is a full URL; the app stores only the file name (`url.split("/").pop()`) and builds `<working panel host>/images/upload/<file>`. If absent, the built-in list of file names is used. First theme is the default background. |
| `urls[]` | The device's playlists (see below). |
| `languages`, `notification` | Stored but **not used** by IBOPlayer (language packs from the panel are only honoured by apps configured with `i18nSource: "panel"`; the notification object is never rendered). |

`urls[]` entries (fields the app reads or round-trips):

| Field | Meaning |
|---|---|
| `id` | Server id (string). `"demo"` = the sample playlist the backend returns for a device without playlists; removed when there is more than one entry. |
| `playlist_name` | Display name. |
| `url` | Server URL. For `xc` the host base; for `general` the full M3U URL. **Special form:** a URL containing `/playlist/` is parsed with `/(.*?)\/playlist\/(.*?)\/(.*?)\/(.*?)(?:\/(.*?))?\/?$/` into host, username, password, type, output, and converted to an `xc` entry (`url = host`, `origin_url = host + "/get.php?username=U&password=P&type=T&output=O"`). |
| `playlist_type` | `xc`, `general` (M3U), `stalker`, `code` (not enabled for IBOPlayer). Missing → treated as `general`. |
| `username`, `password` | Xtream credentials. |
| `is_protected`, `pin` | Round-tripped on save; not enforced by the TV code. |
| `expiration_date`, `status`, `auth`, `fetched_at` | Provider account info last reported by a device via `edit_playlist` (#10). Shown on the playlist page. |
| `portal_name`, `portal_address`, `portal_fallback_address`, `stalker_mac_address` | Stalker portal fields. |
| `logo`, `whatsapp`, `email` | Provider contact info; only shown by apps with the `playlist_provider_info` flag (off for IBOPlayer). |

**Errors.** See table above. Transport failure on every server: if `api_data` is cached, start offline with it; else "Server URLs failed" screen.

**Persist.** `api_data` = whole decrypted reply; `parent_account_password` if `parent_pin` present; `bg_img_file` default.

---

## 5–7. V4 `manage/add_playlist`, `manage/update_playlist`, `manage/delete_playlist`

**Purpose.** Create, edit and delete the device's playlists on the server.

**When.**
- Add/update: user saves the "Add playlist" form (after the app has validated the playlist against the provider: for `xc`, `GET <url>/player_api.php?username=&password=` must return a `user_info` with `auth != 0` and status not `Expired`/`Banned`; for `general`, the URL must answer), or saves a Stalker portal.
- Delete: user deletes a playlist or portal (refused locally if it is the only playlist: "You need to have 1 playlist at least").
- Replay at boot: failed add/updates are queued in `local_data` and replayed one by one during startup.

**Operation choice.**
```
op = entry.is_created is boolean ? (is_created ? "add" : "update")
   : (String(entry.id) starts with "non_saved_" ? "add" : "update")
```
New local entries get the id `non_saved_<unix seconds>`.

**Request.** Encrypted, Bearer. `mac_address` and `app_type` are always added to the payload.

Add / update payload:
```json
{
  "playListName": "My IPTV",
  "playListURL": "http://line.example-iptv.tv:8080",
  "username": "john",
  "password": "s3cret",
  "playlist_type": "xc",
  "is_protected": 0,
  "playlistId": "65f1c0ffee1234567890abcd",
  "mac_address": "a1:b2:c3:d4:e5:f6",
  "app_type": "samsung"
}
```
| Field | Source |
|---|---|
| `playListName` | `playlist_name` or `portal_name` or `""` |
| `playListURL` | `origin_url` or `url` or `""` (for M3U: the URL exactly as typed; for XC: the server URL) |
| `username`, `password` | or `""` |
| `playlist_type` | `playlist_type` or `origin_type` or `""` |
| `is_protected` | `1` / `0` |
| `pin` | only if the entry has one |
| `playlistId` | **update only**: the server id |
| Stalker only: `portal_name`, `portal_address`, `portal_fallback_address`, `stalker_mac_address` | from the portal form |
| Code only: `code`, `playlist_code` (same value) | not used by IBOPlayer |

Delete payload:
```json
{ "playlistId": "65f1c0ffee1234567890abcd", "mac_address": "a1:b2:c3:d4:e5:f6", "app_type": "samsung" }
```

**Response.** Plain JSON on success:
```json
{
  "status": "success",
  "playlist": {
    "_id": "65f1c0ffee1234567890abcd",
    "playlist_name": "My IPTV",
    "url": "http://line.example-iptv.tv:8080",
    "username": "john",
    "password": "s3cret",
    "playlist_type": "xc",
    "is_protected": 0,
    "pin": ""
  }
}
```
Merge rule (`mergeSavedPlaylist`): start from the local entry; if `playlist` exists: `id = String(_id || id)`; `url` → both `url` and `origin_url`; copy `playlist_name`, `playlist_type`, `portal_name`, `portal_address`, `portal_fallback_address`, `stalker_mac_address` when truthy; copy `username`, `password`, `code`, `is_protected`, `pin` when defined. If the id changed (a `non_saved_` entry got a real id), every local storage key containing the old id is renamed to the new id (favourites, resume positions etc. are keyed by playlist id), and the selected playlist id is updated.

**Errors.** `status != "success"` → error message `msg` or `message` or "Sorry, the request could not be processed."; network → "Network error. Please try again.". A failed add/update is queued in `local_data.playlist_urls` and the entry is still added locally, so the user sees it immediately. A failed delete during boot replay is kept in `local_data.remove_ids`. A failed interactive delete shows "Failed to delete playlist." and changes nothing.

---

## 8. V4 `device/add` — get the Stararcs token

**Purpose.** Register the device with Stararcs through the IBO backend and receive the Stararcs `X-Secret-Token`.

**When.** When the user opens the Stararcs (smart proxy) page and no Stararcs token is stored; when a Stararcs call returns HTTP 401 (one retry with a fresh token).

**Request.** Encrypted, Bearer.
```json
{ "mac_address": "a1:b2:c3:d4:e5:f6", "app_type": "samsung" }
```

**Response.** Encrypted; decrypted. The token is taken from the first present of `Response.Device.Token`, `Response.Token`, `Token`, `response.device.Token`, `response.device.token`, `response.token`:
```json
{ "Success": true, "Response": { "Device": { "Token": "st_4f1d2c9e8b7a..." } } }
```

**Errors.** No token in reply → logged, flow ends with no token (Stararcs calls then go without `X-Secret-Token`). Network: "Couldn't reach the server. Check your connection and try again."; other: "The server couldn't register this device with Stararcs.".

**Persist.** `stararcs_secret_token`.

---

## 9. Legacy: `POST <panel>/changeParentPin` — save parental PIN

**Purpose.** Store the parental PIN on the server so it survives reinstall (it comes back as `parent_pin` in `device_info`).

**When.** Settings → Parental control: turning it off (PIN becomes `"off"`), turning it on (new PIN via PIN pad), or "Change PIN" (new + confirm, at least 4 characters, must match).

**Request.** Not V4: no app_type in path, no Bearer.
```
POST https://app.ibo-dev.com/api/changeParentPin
Content-Type: application/x-www-form-urlencoded; charset=UTF-8

data=<enc({"mac_address":"a1:b2:c3:d4:e5:f6","pin_code":"1234"})>
```
`pin_code` is the new PIN or the string `"off"`. The panel URL is picked at random from the current `panel_urls`, retrying other ones on error until all have been tried. No timeout set.

**Response.** Encrypted; decrypted e.g. `{"status":"success"}`. Accepted unless decryption fails or `status == "error"`.

**Errors.** The PIN is already saved locally before the call. On rejection or when every server fails: toast "The PIN was saved on this device only. Please check your connection and try again." Success: "Parental control PIN changed successfully!" or "Parental control turned off.".

---

## 10. Legacy: `PUT <panel>/edit_playlist` — report provider account info

**Purpose.** Tell the backend the expiry/status of a playlist's provider account, so the website (and other devices, via `device_info` → `urls[].expiration_date/status/auth`) can show it.

**When.** On the playlists page, when the user highlights an **Xtream** playlist and the locally cached info is older than 5 minutes: the app calls the provider (`player_api.php`, 10 s timeout), stores the result, then sends it here. Not sent for M3U or Stalker.

**Request.** Form-encoded, plain (not encrypted), no auth. Sent with a custom header `Custom-Proxy-Mode: 1` (an internal flag telling the app's own proxy wrapper not to route it through the Stararcs proxy; it does reach the server as a real header). Random panel URL, no retry, no timeout.
```
PUT https://app.ibo-dev.com/api/edit_playlist
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Custom-Proxy-Mode: 1

mac_address=a1%3Ab2%3Ac3%3Ad4%3Ae5%3Af6&id=65f1c0ffee1234567890abcd&expiration_date=1767139200&status=Active&auth=Active&fetched_at=2026-09-26T08%3A15%3A00.000Z
```
| Field | Source |
|---|---|
| `id` | playlist server id |
| `expiration_date` | `user_info.exp_date` (Unix seconds as the provider sends it) or empty (null) |
| `status` | `user_info.status` or `"Unknown"` |
| `auth` | `"Active"` if `user_info.auth == 1`, `"Inactive"` if another truthy value, `"Unknown"` if missing |
| `fetched_at` | ISO timestamp of the provider check |

**Response.** Ignored (only logged).

Mobile note: the custom header `Custom-Proxy-Mode` is an artefact of the TV's request wrapper. Keep sending it only if the backend owner says the server relies on it; it was probably never meant to leave the device.

---

## Website links (not API calls)

| URL | Built as | Use |
|---|---|---|
| Web device verification | `https://iboplayer.com/device/verify?d=<toUrlSafe(enc({mac_address, app_type, u_id, version, mode}))>` | QR in the captcha modal; `mode` = `recaptcha` or `uid`. |
| QR playlist upload | `https://iboplayer.com/qr-playlist?identifier=<AES(JSON(mac))>&type=<xc|general|stalker>` | Playlist page QR (`type=xc` for IBOPlayer), add-playlist page QR (current tab type), portal page QR (`stalker`). Details in services.md. |
| Background images | `<working panel host>/images/upload/<file>` | App background (e.g. `https://app.ibo-dev.com/images/upload/125984.png`). |

---

## Notes / uncertainties

1. Response shapes are reconstructed from the fields the TV reads; the backend may return more. Confirm against the backend source or a staging server.
2. `edit_playlist` sends plain, unauthenticated data identified only by MAC; `changeParentPin` likewise (obfuscated, no token). Anyone who knows a MAC can call them. The mobile app should use them as is but the backend owner may want V4 equivalents.
3. The playlist `pin`/`is_protected` fields are stored but not enforced anywhere in the TV code.
4. `device_info.languages` / `notification` are ignored by IBOPlayer; their shape is unknown (`languages` is `[{code, name, words}]` for panel-driven apps).
5. When the boot replay (`syncFailedWithServer`) runs offline it writes `local_data` **without** the storage prefix (TV bug), so queued deletes are never cleared from the real key. The mobile app should just use one correctly-namespaced key.
6. On the TV, only failed add/updates are queued. Nothing in the current code ever adds to `local_data.remove_ids`; the boot replay still processes it (left over from older versions). A failed interactive delete is not queued. The mobile app may choose to queue deletes.
7. `auth` in `edit_playlist`: a provider `auth` of `0` is falsy and is therefore reported as `"Unknown"`, not `"Inactive"` (TV quirk).
