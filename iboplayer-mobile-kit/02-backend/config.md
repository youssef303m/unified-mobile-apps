# config.json explained

Every constant the mobile app needs to talk to the IBO backends and the third-party services the TV app uses. Values are copied verbatim from the TV app (`apps/iboplayer/app.json`, `core/js/constants.js`, `core/js/common.js`, `core/boot/host.js.tpl`).

Keys and tokens are an accepted risk for this project: they already ship inside every TV build. Treat all of them as public. Do not add new secrets that rely on being hidden in the APK.

Keys marked **[decision]** are not in the TV app. They are proposals that the backend owner must confirm.

## app

| Key | Meaning |
|---|---|
| `id` | Internal app id (`iboplayer`). Not sent to any backend. |
| `brandName`, `brandShort` | Display names. `brandName` appears in error text ("IBOPlayer does not manage or sell playlist subscriptions"). |
| `websiteUrl` | The customer website. The user adds playlists here (MAC + device key login). The QR codes point here (`/qr-playlist`, `/device/verify`). Shown on screen as text. |
| `storagePrefix` | Prefix of every localStorage key on the TV (`gz3rYzUIC7_`). The mobile app can reuse it as a namespace for its own AsyncStorage/MMKV keys. It has no meaning on the server. |
| `tvVersions` | The version string each TV platform sends as `version` in the V4 payloads (`getHostVersion()`). |
| `mobileAppType` **[decision]** | The `app_type` value the Android app should send. On TV `app_type` is the platform name (`samsung`, `lg`, `vidaa`, `zeasn`, `titanos`, `windows`, `vegaos`). It is also a URL path segment of every V4 call (`/api/<app_type>/v4/...`), so the backend must know it. `android` is a placeholder. |
| `mobileVersion` **[decision]** | The `version` value to send. |

## iboBackend

| Key | Meaning |
|---|---|
| `domainPolicy` | `"server"`: the list of panel servers is fetched at startup from the agent servers. |
| `agentUrls` | The agent servers. `POST <agent>/playlist_info` returns the list of panel domains. They are tried in random order, one after another, until one answers. |
| `agentPath`, `agentTimeoutMs` | Path and timeout of that call. |
| `fallbackDomains` | Used when every agent server fails. `domains` are bare hosts that become `https://<host>/api`. `main_domain` is stored but not used for any request. |
| `staticPanelUrls` | `runtime.panelUrls` in app.json. On TV these are the initial value of `panel_urls`, but under `domainPolicy "server"` they are **replaced** by the agent's (or fallback) list before the first V4 call. In practice they are never contacted. Keep them only as a last-resort list (see Notes in overview.md). |
| `mainDomain` | Initial value of the `main_domain` global. Never used in a request. |
| `v4PathTemplate` | V4 API URL: `https://<domain>/api` + `/` + app_type + `/v4/` + path. Example: `https://app.ibo-dev.com/api/samsung/v4/device_login`. |
| `v4TimeoutMs` | Per-server timeout of V4 calls. |
| `legacyPanelPaths` | Two older, non-V4 endpoints that are still called: `/changeParentPin` (parental PIN) and `/edit_playlist` (playlist expiry report). |
| `webVerifyPath` | `WEBSITE_URL + /device/verify?d=...`: the QR shown in the device-verification captcha. |
| `qrPlaylistPath`, `qrPlaylistFormat` | `WEBSITE_URL + /qr-playlist?identifier=<AES(mac)>&type=<type>`: the "add playlist from your phone" QR. |
| `backgroundImagePath` | Background images from the backend live at `<working panel host>/images/upload/<file>`. |

## crypto

| Key | Meaning |
|---|---|
| `obfuscationAlphabet` | The 62-character alphabet used by the request/response obfuscation (`encryptRequest` / `decryptResponse`). A character's index in this string encodes a number. |
| `qrAesPassphrase` | `ANDROID_AES_NEW_SECRET`. The CryptoJS AES passphrase used to encrypt the MAC in the playlist QR code. |
| `uidAlphabet`, `uidLength` | Alphabet and length of the random 6-character device `u_id`. |
| `legacyUidAlphabet` | Alphabet of the legacy `u_id` derived from SHA-256(mac). Frozen, do not change. |

## defaults

| Key | Meaning |
|---|---|
| `parentalPin` | Parental PIN used when the backend sends none and nothing is stored. |
| `parentalPinOffValue` | The literal string `"off"` means "parental control disabled". It is stored and sent to the server like a PIN. |
| `tvFallbackMac` | The MAC the TV uses when it cannot read one. Many TVs share it on purpose (product decision). **Do not use it on mobile.** Listed so the mobile team knows it exists. |

## analytics

Event upload to the IBO analytics backend. `appName` is `analyticsAppName`. `apiKey` goes in the `x-api-key` header. The thresholds reproduce the TV batching.

## stararcs

Stararcs "smart proxy" (a paid VPN-like proxy for IPTV streams).

| Key | Meaning |
|---|---|
| `baseUrl` | Primary Stararcs API. |
| `mirrorListUrl` | CDN JSON `{ "domain_list": ["https://...", ...] }` with mirror domains, used when the primary is unreachable. |
| `appName` | `stararcsAppName`, sent as `DeviceAppName`. |
| `attemptTimeoutMs` | Timeout per Stararcs attempt. |
| `proxyGateTimeoutMs` | How long startup waits for the Stararcs `general` call when "keep connection" is on. |
| `proxyToken` | `MIMO_PROXY_TOKEN`, put in the proxy URL query string. |
| `proxyUrlTemplate` | Every proxied request URL is `proxyUrlTemplate + <original URL>` (the original URL is appended as is, not encoded). Plain http. |
| `discoveryUrlTemplate` | A GET fired once when a proxy server is selected. The response is ignored. |
| `tvAssetToken` | Used only by the TV boot loader (`/api/tv/server/asset`). Not needed on mobile. |
| `paths` | Endpoint paths, appended to the working Stararcs base. |

## tmdb, imageCache

TMDB v3 key and URLs for artwork, credits and search. The image cache is IBO's TMDB image mirror, used only for Xtream (XC) playlists. `token` is a Bearer token.

## weather

weatherapi.com forecast for the home screen and for the analytics location fields.

## subtitles

IBO's subtitle service (ibosub.com). The player docs cover how subtitles are shown; the request shapes are in services.md.

## store

The ibosol store backend. On TV it only decides whether to load the app code from a remote host (`is_remote`). **Not needed on mobile.** Listed for completeness.

## tvBootOnly

TV boot loader values (where to download the web app from). **Do not port.** `exitUrl` is how the VegaOS WebView wrapper learns to close the app; a native app exits natively.
