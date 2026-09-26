# Device identity, registration and encryption

This file covers how the IBOPlayer TV app identifies a device to the IBO backend, how it registers and authenticates (the "V4" device flow), the obfuscation/encryption it applies to requests and responses, and the account states the backend returns.

Constants referenced here are in [config.json](config.json). Endpoint details (URL, body, response) are in [ibo-api-reference.md](ibo-api-reference.md).

---

## 1. The identity triple

The backend identifies a device by three values that travel together in almost every call:

| Field | What it is | Where it comes from on TV | Persisted on TV? |
|---|---|---|---|
| `mac_address` | A MAC-formatted string `xx:xx:xx:xx:xx:xx`. It is the device's public ID: the user types it (with the device key) on the website to manage playlists. | Read from the TV platform at every boot (section 2). | **No.** Re-derived each boot. |
| `app_type` | The TV platform name: `samsung`, `lg`, `vidaa`, `zeasn`, `titanos`, `windows` (dev), `vegaos`. It is also a path segment in every V4 URL. | User-agent sniffing at boot. | No. |
| `u_id` | A 6-character random device id, created by the app. It lets the backend tell apart two installs that report the same MAC. | Generated on first registration (section 4). | Yes: `gz3rYzUIC7_v4_uid` |

Plus, after registration:

| Field | What it is | Persisted |
|---|---|---|
| V4 session token | Bearer token from `device_login`. Sent as `Authorization: Bearer <token>` on protected V4 calls. | `gz3rYzUIC7_v4_token` |
| `device_key` | A short key the backend assigns. Shown to the user next to the MAC ("Device key: ..."). The user needs MAC + device key to log in on the website. | Inside `gz3rYzUIC7_api_data` (the last `device_info` reply). |

`version` (the app version string per platform, e.g. `1.1.6` on Samsung) is sent in the registration and device-info payloads.

Source: `core/js/login_operation.js` (`_continueGetPlayListDetail`), `core/js/v4_auth.js`, `core/js/common.js` (`getHostVersion`).

---

## 2. How the TV obtains the MAC, per platform

The boot code first sets a default, then tries the platform API. Whatever the platform code produces is used as is (no lower/upper-casing, except where noted).

```
mac_address = "52:54:00:12:34:57"        // default, see note below
```

| Platform | Method | Transformation |
|---|---|---|
| Samsung (Tizen) | `tizen.systeminfo.getPropertyValue("ETHERNET_NETWORK")` → `macAddress`. If missing, empty or `"00:00:00:00:00:00"`, try `"WIFI_NETWORK"` → `macAddress` with the same validity rule. | Used verbatim. If both fail, the default stays. |
| LG (webOS) | Luna service `luna://com.webos.service.sm`, method `deviceid/getIDs`, parameters `{ idType: ["LGUDID"] }` → `idList[0].idValue`. | Remove every `'` and `-` character, take the first 12 characters, split into 6 pairs, join with `:`. Example: UDID `a1b2c3d4-e5f6-...` → `a1:b2:c3:d4:e5:f6`. On failure the default stays. |
| Hisense VIDAA | `Hisense_GetDeviceID()` | If it already matches `/^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i`, use it verbatim. Otherwise take the **last** 12 characters, split into 6 pairs, join with `:`. If the function does not exist, the default stays. |
| Zeasn (Philips/Whale) | SDK callback `onDeviceInfoReady(DeviceInfo)` → `DeviceInfo.Product.WhaleAdID` | Walk the string, skip `-`, collect the first 12 other characters, split into 6 pairs, join with `:`. Zeasn never reads the hardware MAC (kept on purpose: changing it would give every installed Zeasn TV a new identity). |
| TitanOS | Same SDK → `DeviceInfo.Product.mac` if it is a non-empty value (not `"undefined"` / `"null"`); otherwise the Zeasn WhaleAdID rule. | Verbatim MAC, or WhaleAdID-derived. |
| VegaOS (WebView wrapper) | Intended: `mac_address` query parameter of the page URL. **Unreachable today** (the platform is never detected, `URL_PARAMS` is never defined). | — |
| Windows / unknown | Nothing. | Default stays. |

Notes:

- **The shared default MAC is intentional** (product decision, 2026-09-25). Every TV whose detection fails registers as `52:54:00:12:34:57` and shares playlists, expiry and PIN with every other such TV. **The mobile app must not copy this.**
- There is a second, unrelated MAC used only for Stalker portals (`00:1A:79:` + last 3 octets of the device MAC, or a persisted random one). That belongs to the Stalker docs, not to IBO identity.
- The TV also collects `device_info` (`modelName`, `version` (firmware), `sdkVersion`, `screenWidth`, `screenHeight`, `uhd`) for analytics only. It is not sent to the IBO panel.

### 2.1 Proposal for Android — DECISION FOR THE BACKEND OWNER

Android does not expose a hardware MAC to apps (Android 10+ returns `02:00:00:00:00:00` or a randomized one). The app still needs a MAC-formatted, stable id, because:
- the backend keys the device by `mac_address`,
- the user must type it on the website together with the device key,
- the legacy endpoints (`changeParentPin`, `edit_playlist`, `qr-playlist`) identify the device only by MAC.

Proposed scheme (needs sign-off):

1. Read `Settings.Secure.ANDROID_ID` (via `react-native-device-info` `getAndroidId()`). Since Android 8 it is stable per device + signing key + user, survives reinstall, and resets on factory reset.
2. `hex = SHA-256("iboplayer-mobile:" + androidId)` as lowercase hex.
3. Take the first 12 hex characters. Force the first octet to be a *locally administered, unicast* address: `octet0 = (octet0 & 0xFC) | 0x02`. This guarantees it never collides with a real vendor MAC from a TV.
4. Format as `xx:xx:xx:xx:xx:xx` (lowercase, colon separated).
5. Persist the result in secure storage (Keystore-backed, e.g. `react-native-keychain` or `expo-secure-store`) the first time, and read it from there afterwards, so a future change in step 1 cannot silently change the identity.
6. If `ANDROID_ID` is unavailable, generate 6 random bytes (apply step 3) and persist them.

Questions for the backend owner:
- Which `app_type` should Android send? It becomes part of every V4 URL (`/api/<app_type>/v4/...`). `android` is proposed.
- Does the backend accept locally administered MACs (first octet `x2`, `x6`, `xA`, `xE`)? Does it validate MAC format at all?
- Should the phone and the user's TV be able to share one account (same MAC)? The TV flow cannot do that today; a phone would need to "log in" with the TV's MAC + device key, which no current endpoint supports.

---

## 3. Request / response obfuscation ("encryptRequest" / "decryptResponse")

This is **not encryption**: it is Base64 with a random filler string spliced in, plus two marker characters that tell the receiver where the filler is. There is no key. It must still be reproduced byte-exactly because the server expects it.

Alphabet (62 characters, index = value):

```
abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890
```
(`a`=0 … `z`=25, `A`=26 … `Z`=51, `1`=52 … `9`=60, `0`=61)

### 3.1 Encrypt a request (client → server)

Pseudo-code, exactly as the TV does it:

```
function encryptRequest(data):
    s = base64( JSON.stringify(data) )          // standard Base64 with + / and = padding
    keyLen = floor(random() * 30)               // 0..29
    if keyLen < 20: keyLen = 20                 // so 20..29
    pos = floor(random() * length(s))           // 0..len-1
    if pos >= 42: pos = 42                      // so 0..42
    key = keyLen random characters from ALPHABET
    body = s[0:pos] + key + s[pos:]
    return ALPHABET[pos] + ALPHABET[keyLen] + body
```

So the output is: 1 char encoding the insert position, 1 char encoding the filler length, then the Base64 text with the filler inserted at that position.

Notes:
- `JSON.stringify` drops keys whose value is `undefined`. The agent call sends `{mac_address, app_type: undefined, version: undefined}`, so on the wire it is only `{"mac_address":"..."}`.
- The TV uses `btoa()` on the JSON string. `btoa` throws on any character above U+00FF, so the TV cannot send non-Latin-1 text (for example an Arabic playlist name) through an encrypted call — the call crashes client-side. The mobile app should Base64 the **UTF-8 bytes** of the JSON. For ASCII input this is byte-identical to the TV. Whether the server accepts UTF-8 in the decoded JSON has not been verified (see Notes).

### 3.2 Decrypt a response (server → client)

Responses use a **different layout**: the two marker characters are at the **end**.

The response body is JSON `{ "data": "<string>" }`.

```
function decryptResponse(envelope):
    raw = envelope.data
    pos = indexOf(ALPHABET, raw[len-2])      // second-to-last char
    len = indexOf(ALPHABET, raw[len-1])      // last char
    raw = raw[0 : len(raw)-2]                // drop the two markers
    b64 = raw[0:pos] + raw[pos+len:]         // drop the filler
    text = utf8Decode( base64Decode(b64) )   // TV: atob + percent-decoding = UTF-8 decode
    return JSON.parse(text)
```

### 3.3 URL-safe variant

When the blob goes into a URL (`/device/verify?d=` and the `encrypted_d` QR format, which IBOPlayer does not use), the TV then replaces `+` with `-`, `/` with `_`, and strips trailing `=`.

### 3.4 AES used for the playlist QR code

Only one place uses real encryption: the "add playlist" QR code (`qrPlaylistFormat: "identifier"`).

```
identifier = CryptoJS.AES.encrypt( JSON.stringify(mac_address), ANDROID_AES_NEW_SECRET ).toString()
```

- Library: crypto-js 3.1.9 (`CryptoJS.AES.encrypt(string, passphrase)`).
- `JSON.stringify(mac_address)` **includes the double quotes**: the plaintext is `"a1:b2:c3:d4:e5:f6"` (19 characters with quotes), not the bare MAC.
- Passphrase mode: crypto-js derives key and IV with OpenSSL `EVP_BytesToKey` (MD5, 1 iteration) from the passphrase and a random 8-byte salt; cipher AES-256-CBC, PKCS#7 padding. `.toString()` returns Base64 of `"Salted__" + salt(8) + ciphertext`, so it starts with `U2FsdGVkX1`. The output is different every time.
- Passphrase (verbatim): `3R%6R2FJ*b5)Vmt84$^eWf0r@r?szdw*fwf*ewd&VXmne$%`
- The Base64 is put in the query string **without URL-encoding** (`+`, `/`, `=` appear raw).

### 3.5 TypeScript implementation sketch (React Native)

Dependencies: `crypto-js` (^4, compatible output for these calls), `buffer` (Base64 of UTF-8), and a secure random source (`react-native-get-random-values`, imported once at app start so `crypto.getRandomValues` exists).

```ts
import 'react-native-get-random-values';
import CryptoJS from 'crypto-js';
import { Buffer } from 'buffer';

const ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
const QR_AES_PASSPHRASE = '3R%6R2FJ*b5)Vmt84$^eWf0r@r?szdw*fwf*ewd&VXmne$%';

function randomInt(maxExclusive: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % maxExclusive;
}

function randomFiller(length: number): string {
  let s = '';
  while (s.length < length) s += ALPHABET.charAt(randomInt(62));
  return s;
}

/** Same wire format as the TV's encryptRequest(). */
export function encryptRequest(data: unknown): string {
  const json = JSON.stringify(data);
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  let keyLen = randomInt(30);          // 0..29
  if (keyLen < 20) keyLen = 20;        // 20..29
  let pos = b64.length > 0 ? randomInt(b64.length) : 0;
  if (pos >= 42) pos = 42;             // 0..42
  const body = b64.slice(0, pos) + randomFiller(keyLen) + b64.slice(pos);
  return ALPHABET.charAt(pos) + ALPHABET.charAt(keyLen) + body;
}

/** Same as the TV's decryptResponse(): envelope is the parsed JSON body { data }. */
export function decryptResponse<T = any>(envelope: { data: string }): T {
  const raw = envelope.data;
  const pos = ALPHABET.indexOf(raw.charAt(raw.length - 2));
  const len = ALPHABET.indexOf(raw.charAt(raw.length - 1));
  if (pos < 0 || len < 0) throw new Error('Bad envelope markers');
  const trimmed = raw.slice(0, -2);
  const b64 = trimmed.slice(0, pos) + trimmed.slice(pos + len);
  const json = Buffer.from(b64, 'base64').toString('utf8');
  return JSON.parse(json) as T;
}

export function toUrlSafe(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** QR "identifier": AES of the JSON-quoted MAC, OpenSSL/"Salted__" format. */
export function qrIdentifier(macAddress: string): string {
  return CryptoJS.AES.encrypt(JSON.stringify(macAddress), QR_AES_PASSPHRASE).toString();
}

/** Legacy u_id (only for migrating installs that registered before random ids). */
const LEGACY_UID_ALPHABET =
  'abcdefghjkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789';
export function legacyUid(macAddress: string): string {
  const hex = CryptoJS.SHA256(String(macAddress || '').toLowerCase()).toString(CryptoJS.enc.Hex);
  let uid = '';
  for (let i = 0; i < 6; i++) {
    const byte = parseInt(hex.substr(i * 2, 2), 16) || 0;
    uid += LEGACY_UID_ALPHABET.charAt(byte % LEGACY_UID_ALPHABET.length);
  }
  return uid;
}

const UID_ALPHABET = 'ACDEFHJKMNPQRTUVWXY13479';
export function generateUid(): string {
  let uid = '';
  for (let i = 0; i < 6; i++) uid += UID_ALPHABET.charAt(randomInt(UID_ALPHABET.length));
  return uid;
}
```

A quick self-test: `decryptResponse({ data: X })` where `X` is built as `b64[0:pos] + filler + b64[pos:] + ALPHABET[pos] + ALPHABET[len]` must return the original object. Note that `encryptRequest` output cannot be fed to `decryptResponse` (markers are at opposite ends).

---

## 4. The V4 device registration and login flow

All V4 calls go to `https://<panel-domain>/api/<app_type>/v4/<path>` with JSON bodies, and are retried across all panel domains in order on network failure (details in [overview.md](overview.md#server-failover)).

### 4.1 The `u_id`

- Stored under `gz3rYzUIC7_v4_uid`.
- If none is stored, a candidate is generated: 6 characters from `ACDEFHJKMNPQRTUVWXY13479` (uppercase, no look-alike pairs). It is kept in memory as `pending_uid` and **only persisted after the backend accepts it** (a successful `device_login` or a non-error `device_info`).
- Why the odd alphabet: when the backend rejects a u_id it shows the *stored* u_id as the captcha image, and the user has to read it back.
- Legacy migration (TV only): if a token exists but no u_id is stored, the u_id is set to `legacyUid(mac)` (SHA-256 of the lowercased MAC, first 6 bytes mod 57 into the legacy alphabet). A new mobile app has no legacy installs and can skip this.

### 4.2 Flow

```
begin():
    if a V4 token is stored:  fetchDeviceInfo()
    else:                     getCaptcha()

getCaptcha():   POST recaptcha  (plain JSON in, plain JSON out, no auth)
    status == "already_verified"               -> deviceLogin()
    status == "success" and captcha present    -> show captcha image (SVG) + web-verify QR
    anything else / network failure            -> "Server URLs failed" screen

deviceLogin(extra):   POST device_login  (encrypted in/out, no auth)
    payload = { mac_address, app_type, u_id, version }
             + { recaptcha_code, recaptcha_token }   if the user typed the recaptcha
             + { uid_captcha_code, uid_captcha_token } if the user typed the uid captcha
    status == "success" and token              -> persist u_id, persist token, fetchDeviceInfo()
    status == "uid_mismatch_captcha"           -> show data.captcha (SVG of the stored uid),
                                                  keep data.captcha_token, mode = "uid"
    error_code == 401 or message contains "captcha" (case-insensitive)
                                               -> show message, request a new captcha
                                                  (from the "Continue" button: show
                                                   "Not verified yet..." instead)
    anything else                              -> show data.message or "Verification failed."
    network failure                            -> "Network error. Please try again."

fetchDeviceInfo():   POST device_info  (encrypted in/out, Bearer token)
    status == "uid_mismatch_captcha"           -> uid captcha (as above)
    status == "error" and error_code == 404    -> delete token, getCaptcha()
    status == "error" (other)                  -> "Server URLs failed" screen
    otherwise                                  -> persist u_id, onDeviceInfo(data)  (account data)
    network failure on every server            -> if a cached reply exists: start offline with it
                                                  else "Server URLs failed" screen
```

Captcha screen actions:
- **Verify**: sends the typed text. In uid mode the text is uppercased first. → `deviceLogin({recaptcha_code})` or `deviceLogin({uid_captcha_code})`.
- **New Code** (recaptcha mode only): `getCaptcha()` again. In uid mode "refresh" clears `uid_captcha_token` and calls `deviceLogin()` again.
- **Continue** (next to the QR): the user verified on the website instead; calls `deviceLogin({fromContinue: true})` with no codes. The backend answers `success` if the web verification happened.
- The QR encodes `https://iboplayer.com/device/verify?d=<toUrlSafe(encryptRequest({ mac_address, app_type, u_id, version, mode }))>`, where `mode` is `"recaptcha"` or `"uid"`. The user opens it on a phone and types the code there.

On a phone the captcha + "scan with your phone" QR makes little sense (the user is already on the phone). Suggested mobile UX: show the SVG captcha with a normal text input, and offer "Verify in browser" that opens the same `/device/verify?d=...` URL in the system browser, then call `deviceLogin({})` when the app returns to the foreground. Confirm with the backend owner that the website flow works from the same device.

### 4.3 Session expiry / 401 handling

For any call marked "auth", the reply counts as an auth failure when:
- HTTP status is 401 or 403, or
- the decoded body has `error_code` 401 or 403, or
- the body has `status: "error"` and `message` matches `/token is required|invalid device login token|token does not match/i`, or
- the body is an encrypted envelope (`{data: "..."}` without `status`) that fails to decrypt (treated as 401/403 "Invalid device login token").

On auth failure the TV deletes the token and restarts at `getCaptcha()` (once; a guard prevents loops). If the token is missing before a protected call, the same happens.

Known TV bug: after triggering re-auth the original caller never gets a success or error callback, so a waiting operation hangs. The mobile app should reject the original request (e.g. throw `AuthExpiredError`) and let the UI route to the verification screen.

### 4.4 Stararcs device token

The Stararcs proxy needs its own token. It is obtained through the IBO backend: `POST device/add` (V4, encrypted, Bearer). The reply contains the Stararcs token at one of these paths, first match wins: `Response.Device.Token`, `Response.Token`, `Token`, `response.device.Token`, `response.device.token`, `response.token`. It is stored under `gz3rYzUIC7_stararcs_secret_token` and sent to Stararcs as `X-Secret-Token`. If there is no V4 token yet, the captcha flow runs first (with a Cancel button). See [services.md](services.md#stararcs).

---

## 5. Account states and what the app does

After `device_info` succeeds the reply drives everything. Fields and their meaning are in [ibo-api-reference.md](ibo-api-reference.md#device_info). The decision order is:

| # | Condition | App behaviour |
|---|---|---|
| 1 | `status == "uid_mismatch_captcha"` | Device ownership check: show the uid captcha. |
| 2 | `status == "error"`, `error_code == 404` | Device unknown to the backend: forget the token, restart verification. |
| 3 | `status == "error"`, other | "Server URLs failed" screen (manual server input). |
| 4 | `expire_date < today` (string compare of `YYYY-MM-DD`, device local date) | **Expired.** Show the "Notice: Trial Period Expired!" screen: explanation, "Activate your device and subscribe with a variety of payment methods", the website URL, MAC and device key. **No Continue button** — the app is blocked. The user must pay on the website and restart. |
| 5 | `mac_registered` is falsy | **Unregistered / trial.** Show the welcome screen: "Trial period notice your complimentary trial ends in *`trial_days`* days.", instructions to add a playlist on the website (URL, MAC, device key), and a **Continue** button that enters the app with whatever playlists the backend returned (usually the demo playlist). |
| 6 | `mac_registered` truthy, not expired | **Active.** Go straight in: pick the saved playlist (by id) or the first one and load it. |

Other fields:
- `is_trial`: the account page shows **"Active"** when `is_trial` is `2` or `3`, otherwise **"Trial"**. The meaning of the other values (0, 1) is not documented in the code.
- `expire_date` is shown on the account page as the app licence expiry.
- The backend returns a `demo` entry (id `"demo"`) as the first playlist when the device has no playlists. If there is more than one playlist and the first has id `"demo"`, it is removed. A playlist with no `url` shows "This playlist has no server address, so there is nothing to load. Please add your playlist to get started."
- Offline start (every server unreachable, cached reply present): the cached `device_info` reply is used. If its `expire_date` is past, the displayed expiry is replaced by `2438-01-02`, but the expiry check in row 4 still uses the original date, so an expired device stays blocked offline.

"Not activated" is not a separate backend state in this code: a device is either unregistered (`mac_registered` false, trial), active, or expired.

The IPTV provider's own account state (Xtream `user_info.status` Expired/Banned/Disabled) is separate and belongs to the Xtream docs.

---

## Notes / uncertainties

1. **UTF-8 in encrypted requests.** The TV uses `btoa`, so it never sends non-Latin-1 characters encrypted (it crashes instead). It is unverified whether the server decodes the Base64 as UTF-8. Test a playlist name like `قناة` against a staging server before relying on it.
2. **`app_type` for Android** is unknown to the backend; the V4 URL contains it. Must be agreed.
3. **MAC case.** The TV sends MACs in whatever case the platform returns (Samsung/LG are typically lowercase). The account page displays it uppercased. Whether the backend compares case-insensitively is unknown; `legacyUid` lowercases before hashing, which suggests the backend normalizes to lowercase. Recommend always sending lowercase.
4. **`is_trial` values** other than 2/3 are undocumented.
5. `device_info` without `parent_pin` logs a warning ("backend needs the PORT_08 patch"); older servers may omit it.
6. The expired check uses the device's local date, not server time. A phone with a wrong clock can pass or fail it incorrectly.
7. The recaptcha endpoint is plain JSON (not encrypted) while every other V4 endpoint is encrypted; this is how the TV does it.
