# Testing

You will not have access to a real IBO account, playlist or portal while building. Everything
must be testable against **fixtures**, and the app must have a **demo mode**.

## 1. Fixtures (build first, milestone M1)

Create `src/api/__fixtures__/` from the example requests and responses in 02-backend/:

| Fixture set | Contents |
|---|---|
| `ibo/` | registration responses for every account state (active, trial, expired, not activated, …); a playlist list with one Xtream playlist, one M3U and one Stalker portal; an empty playlist list; server-selection failures |
| `xtream/` | categories and streams for live, VOD and series (about 50 each, plus one "big" set generated with 20,000 channels); `get_vod_info`; `get_series_info` with 2 seasons; short EPG with base64 titles; an auth failure |
| `m3u/` | a small playlist, a playlist with every attribute variant, a 20,000-entry generated one, and a broken one |
| `stalker/` | handshake, get_profile, genres, a paged ordered list (3 pages), create_link for live, VOD and episode, token expiry (to trigger re-handshake), and 405 |
| `tmdb/` | movie and TV search results with images |

Serve them with **MSW** in tests. In the app, a dev menu toggle **"Use fixtures"** routes every
request to them, which is how you run and screenshot the whole app without real servers.

For playback, use public test streams in fixtures (for example the HLS test streams of the
Media3/ExoPlayer demo app, and a public MP4) so the player can be exercised end to end. Never
commit real playlist credentials.

## 2. Unit tests (Jest)

Required coverage:
- **Every business rule R-xxx** in 01-product/business-rules.md: at least one test named
  `R-xxx: <rule>`. This is the definition of "done" for the rules.
- The crypto and encoding of backend payloads: known input → known output vectors, taken from
  02-backend/device-and-auth.md.
- The URL builders (Xtream live, VOD, series and catch-up; Stalker create_link handling), the M3U
  parser (every attribute case and the broken lines), EPG time parsing (timezones, base64 titles),
  the Sports category detection keyword lists, sorting, and the recent-list limits.
- Resume logic: saving, the "finished" threshold, continue-watching ordering.
- Download manager state machine: queued → downloading → paused → done / error / resumed.

## 3. Component tests (React Native Testing Library)

Every component in 03-design/design-system.md §5 in its states: loading (skeleton), empty,
error, normal, pressed/selected, RTL.

## 4. End-to-end (Maestro, on an emulator, with the fixtures on)

One flow file per flow in 01-product/user-flows.md, at least:
1. First launch → terms → captcha verify → the trial Welcome screen shows the device id, device
   key and website → Continue → Home. With the expired fixture, the same flow ends on the
   blocked Expired screen; after the fixture switches to active, "Check again" → Home.
2. Home → movie details → Play → seek → back → Continue Watching shows the movie at that position.
3. Series → season 2 → episode 3 → play → next-episode card.
4. Live → category → channel → zap next/previous → EPG guide → catch-up programme (Xtream) /
   no Replay entry (Stalker).
5. Parental: a locked category asks for the PIN; a wrong PIN shakes; the right PIN opens; change PIN.
6. Search finds a channel, a movie and a series; an empty query shows recent searches.
7. Switch playlist → catalogue re-syncs → Home shows the new content.
8. Settings: change language to Arabic → RTL layout → back to English.
9. Download (fixture MP4) → airplane mode → play offline.
10. Expired account → expiry screen → no content reachable.

## 5. Manual device checklist (before each release)

- A 2020-2021 mid-range phone (4GB RAM, Android 10-11) and a current flagship.
- Real playlists provided by the owner: at least one of each type, one with 20,000+ channels.
- Streams: HLS live, MPEG-TS live, MP4 movie, MKV movie with AC3 audio, HEVC. Check picture,
  audio and track switching on each.
- Poor network: use throttling to simulate 3G. Airplane mode mid-playback, then network back.
- Rotation, PiP, background audio, the notification controls, and incoming calls pausing playback.
- TalkBack on the main screens: every control has a label.
