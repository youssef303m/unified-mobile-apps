# EPG and catch-up (replay)

How programme guides are fetched, parsed, timed and displayed, and how catch-up (replay)
works for Xtream Codes and Stalker. M3U playlists have **no EPG and no catch-up** in this app.

Source: `core/js/channel_operation.js` (`getEpgProgrammes`, `showNextProgrammes`,
`_programmeProgress`), `core/js/Models/LiveModel.js` (`getNextProgrammes`,
`getProgrammeVideoUrl`), `core/js/time_helper.js`, `core/js/utils.js` (`epgClock`,
`parseEpgTime`), `core/js/common.js` (`getAtob`, `getMinute`), `core/js/catchup.js`,
`core/js/vod_series_page.js` (replay), `core/js/stalker_integration.js`
(`afterLivePlayStart`, `loadStalkerCatchupEPG`, `prepareStalkerVodPlayerUrl`),
`core/js/vod_series_player.js`, `features/epg_guide/js/epg_guide_page.js`.

---

## 1. Sources and time handling

| use | XC | Stalker |
|---|---|---|
| Now / next in the live player | `get_short_epg&stream_id=<id>&limit=30` | `get_short_epg&type=itv&ch_id=<id>&size=2` |
| Catch-up programme list | `get_simple_data_table&stream_id=<id>` | `get_simple_data_table&type=itv&ch_id=<id>&size=100` |
| EPG guide grid | `get_simple_data_table&stream_id=<id>` | `get_simple_data_table&type=itv&ch_id=<id>&size=400` |

There is no XMLTV / bulk EPG: always **one request per channel**. `epg_channel_id`,
`tvg-id` and M3U `url-tvg` are never used. Request details: `xtream.md` §9, `stalker.md` §4.8.

### 1.1 Server offset (XC only)

`time_difference_with_server` (minutes, default 0) is set at XC login:
`trunc((server_info.timestamp_now*1000 − Date(server_info.time_now as device-local)) / 60000)`
= device UTC offset − server UTC offset.

### 1.2 `getLocalChannelTime(value)` → moment (device-local)

```ts
function getLocalChannelTime(value: string | number, timeDiffMin: number): moment.Moment {
  const s = String(value).trim();
  let m: moment.Moment;
  if (/^\d{10}$/.test(s)) m = moment.unix(parseInt(s, 10));          // unix seconds
  else if (/^\d{13}$/.test(s)) m = moment(parseInt(s, 10));           // unix ms
  else if (/^\d{14}/.test(s)) m = moment(s, 'YYYYMMDDHHmmss Z');      // XMLTV style "20240925200000 +0100"
  else m = moment(s);                                                 // "YYYY-MM-DD HH:mm:ss" as device-local wall clock
  return m.add(timeDiffMin, 'minute');
}
```

The idea: XC `start`/`end` strings are the **server's wall clock**; parsing them as
device-local and adding the offset gives device-local wall clock. (It is also applied to
unix timestamps, which is wrong when the offset ≠ 0 — see Notes.)

### 1.3 Display helpers

```ts
const epgClock = (v: string) => String(v || '').substring(11, 16);   // "YYYY-MM-DD HH:mm[:ss]" -> "HH:mm"
const parseEpgTime = (v: string) => moment(String(v || ''), ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm']);
```

Programme strings inside the app are always `"YYYY-MM-DD HH:mm"` (XC, catch-up) or
`"YYYY-MM-DD HH:mm:ss"` (Stalker now/next).

### 1.4 Base64 titles

XC returns `title` and `description` **base64-encoded UTF-8**. Decoder:

```ts
function getAtob(text: string): string {
  try {
    // atob -> bytes -> percent-encode each byte -> decodeURIComponent = UTF-8 decode
    return decodeURIComponent(atob(text).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  } catch { return text; }   // not base64 / not UTF-8: return as-is
}
```

Stalker titles are **plain text** and must never be decoded (a short word like `News`
is valid base64). Exception: the Stalker catch-up list deliberately **base64-encodes** its
titles (`btoa(unescape(encodeURIComponent(s)))`) so it can reuse the XC catch-up screen,
which decodes them.

---

## 2. Live player: current and next programme

**When:** 300 ms after the focused channel changes in the channel list or the full-screen
channel bar (debounced), the programme list is cleared and re-fetched. No cache — every
focus change refetches. The now/next display is recomputed every 60 s from the last list.

### XC

```
GET {base}/player_api.php?username=U&password=P&action=get_short_epg&stream_id=10231&limit=30
```

```json
{ "epg_listings": [
  { "id": "90112", "epg_id": "33", "title": "UHJlbWllciBMZWFndWUgTGl2ZQ==", "lang": "en",
    "start": "2024-09-25 20:00:00", "end": "2024-09-25 22:00:00",
    "description": "QXJzZW5hbCB2IFNwdXJz", "channel_id": "SkySpMainEvHD.uk",
    "start_timestamp": "1727290800", "stop_timestamp": "1727298000" } ] }
```

Each listing →

```ts
{ start: getLocalChannelTime(item.start).format('YYYY-MM-DD HH:mm'),
  stop:  getLocalChannelTime(item.end).format('YYYY-MM-DD HH:mm'),
  title: getAtob(item.title), description: getAtob(item.description) }
```

No `epg_listings` or an HTTP error → empty list (no message).

### Stalker

`get_short_epg … size=2`, each item →
`title: name || title`, `description: descr || description`, and
`start/stop = time/time_to` if both exist, else `moment.unix(start_timestamp/stop_timestamp)
.format('YYYY-MM-DD HH:mm:ss')`, else `""`. No offset is applied.

### Now / next selection (`getNextProgrammes`)

```ts
function getNextProgrammes(list: EpgProgramme[]) {
  const now = moment().unix();
  let currentExists = false; const out: EpgProgramme[] = [];
  for (const p of list) {                 // list order as returned (assumed chronological)
    if (moment(p.stop).unix() >= now) {
      if (moment(p.start).unix() <= now) currentExists = true;
      out.push(p);
      if (out.length >= 4) break;
    }
  }
  return { currentExists, programmes: out };
}
// current = currentExists ? out[0] : none;  next = currentExists ? out[1] : out[0]
// progress % = clamp(round((now - start)/(stop - start)*100), 0, 100), 0 if invalid span
```

UI (TV): up to 4 rows "HH:mm ~ HH:mm Title" (first marked current if it is running); the
full-screen bar shows current and next with "HH:mm - HH:mm" and a progress bar; a
"Now Playing" card shows the current description.

---

## 3. Catch-up (Replay)

### 3.1 Which channels have archive

Replay page (XC): categories = live categories without Favourites/Recent/hidden, each
filtered to channels where `tv_archive != 0 && tv_archive_duration != 0` (loose equality,
so `"0"` counts as 0); empty categories dropped. None left → "Replay not available for
current playlist". Channels are sorted with the `live_sort` setting.
M3U → "Replay not available for current playlist". Stalker: all real categories, channels
paged from the portal (but the iboplayer home blocks Replay for Stalker, see
`stalker.md` §6).

`tv_archive_duration` (days) is **not** used to limit which programmes are offered.

### 3.2 Programme list

**XC:**

```
GET {base}/player_api.php?username=U&password=P&action=get_simple_data_table&stream_id=10231
```

```json
{ "epg_listings": [
  { "id": "90001", "title": "TmV3cw==", "start": "2024-09-24 18:00:00", "end": "2024-09-24 18:30:00",
    "description": "RXZlbmluZyBuZXdz", "start_timestamp": "1727197200", "stop_timestamp": "1727199000",
    "now_playing": 0, "has_archive": 1 } ] }
```

Keep items with `has_archive != 0`; each →
`{ start: getLocalChannelTime(start).format('YYYY-MM-DD HH:mm'), stop: …(end)…, title: item.title
(still base64), description: item.description (base64) }`.
`epg_listings` missing: show `data.error` if present, else "Something went wrong"; empty
result → "No Epg Available for current channel"; HTTP error → "Something went wrong or no
EPG available for this channel".

**Stalker** (`loadStalkerCatchupEPG`): `get_simple_data_table size=100`; for each item,
`time`/`time_to` are unix seconds if numeric (or all digits), else parsed as local
`"YYYY-MM-DD HH:mm:ss"`. Keep only programmes that have **ended** (`stop <= now`) with valid
times. Each → `{ start: 'YYYY-MM-DD HH:mm', stop: 'YYYY-MM-DD HH:mm', title: base64(name),
desc: base64(descr), _raw: item }`. Empty → "No EPG archive available for this channel".

### 3.3 Grouping by day (`sortProgrammesByDate`)

```ts
function groupByDay(list: EpgProgramme[]) {
  const nowStr = moment().format('YYYY-MM-DD HH:mm:ss');
  const days: Record<string, { day_string: string; date_string: string; programmes: EpgProgramme[] }> = {};
  for (const p of list) {
    if (p.start >= nowStr || p.stop >= nowStr) break;   // STRING compare; stops at the first non-finished programme
    const key = p.start.substr(0, 10);                  // "YYYY-MM-DD"
    (days[key] ??= { day_string: moment(p.start).format('dddd'), date_string: moment(p.start).format('MMM D'), programmes: [] })
      .programmes.push(p);
  }
  return Object.values(days);        // insertion order = oldest day first
}
```

Only finished programmes are playable. Each row shows `HH:mm` + decoded title; the
description is decoded (`getAtob(desc)`; XC items carry `description` rather than `desc`,
so XC rows show "No Description"/empty — see Notes).

### 3.4 Playing a programme

**XC** (`xtream.md` §7):

```
{base}/streaming/timeshift.php?username=U&password=P&stream=<stream_id>&start=<YYYY-MM-DD:HH-mm server time>&duration=<minutes>
```

`start` = programme start − `time_difference_with_server` minutes; `duration` =
`floor(stop_ms/60000) − floor(start_ms/60000)`. Player title: decoded title +
`"HH:mm~HH:mm"`. Catch-up playback does not save resume positions.

**Stalker**: `arcStart/arcStop = moment(start|stop, 'YYYY-MM-DD HH:mm').unix()` →
`createCatchupUrl(cmd, arcStart, arcStop, programme._raw)` (`stalker.md` §4.9); if every
shape fails, the live stream is played instead.

### 3.5 Time math example (XC)

Server in UTC+1 (`time_now` "2024-09-25 21:00:00", `timestamp_now` 1727294400), device in
UTC+3 → offset = +120 min. EPG item `start "2024-09-25 20:00:00"` → shown as `22:00`.
Timeshift `start` = 22:00 − 120 min = `2024-09-25:20-00` (server wall clock again).

---

## 4. EPG guide (full-page grid, feature `epg_guide`, XC and Stalker)

- Opened for the channels of the current live category. Rows are fetched lazily around the
  focused row (±10 rows rendered), **max 4 concurrent requests**, 15 s timeout each,
  focused row first.
- Cache: in memory, per playlist, `stream_id → { status: "done"|"error", programmes }`,
  kept for the session; failed rows are dropped when the guide is reopened.
- Probe: if the first 8 requested rows all come back empty → "No EPG available for this
  category" (or "EPG could not be loaded. Please try again." if none answered); 15 s probe
  timeout.
- XC parse: `start` (or `start_timestamp`) and `end` (or `stop`, `stop_timestamp`) through
  `getLocalChannelTime`; drop invalid or `stop <= start`; `title = getAtob(title) || "No Title"`,
  `description = getAtob(description)`.
- Stalker parse: `time` (or `start_timestamp`), `time_to` (or `stop_timestamp`) through
  `getLocalChannelTime`; title plain `name || title || "No Title"`, `descr || description`.
- Normalise: sort by start; clamp overlaps (start = previous stop); drop empty slots; merge
  back-to-back slots (gap ≤ 1 min) with the same title (case-/space-insensitive), keeping
  the first non-empty description.
- Catch-up is not offered from the guide ("Catch-up is not available from the guide").

```ts
function normalizeGuide(arr: { start: moment.Moment; stop: moment.Moment; title: string; description: string }[]) {
  arr.sort((a, b) => a.start.valueOf() - b.start.valueOf());
  const out: typeof arr = []; let prevEnd = 0;
  for (const p of arr) {
    if (p.start.valueOf() < prevEnd) p.start = moment(prevEnd);
    if (p.stop.valueOf() <= p.start.valueOf()) continue;
    prevEnd = p.stop.valueOf();
    const last = out[out.length - 1];
    if (last && last.title.trim().toLowerCase() === p.title.trim().toLowerCase()
        && p.start.valueOf() - last.stop.valueOf() <= 60000) {
      last.stop = p.stop; if (!last.description && p.description) last.description = p.description; continue;
    }
    out.push(p);
  }
  return out;
}
```

---

## Notes / uncertainties

- `getLocalChannelTime` adds the XC server offset to unix timestamps too (10/13-digit
  input), which is only correct when the offset is 0. The EPG guide uses the timestamp
  fields only as a fallback, so it mostly receives strings; the guide also applies the
  (XC-only) offset to Stalker times — it is 0 for a Stalker session unless an XC playlist was
  used earlier in the same session (global not reset). Recommended: treat unix timestamps as
  absolute and apply the offset only to wall-clock strings.
- Stalker portals send wall-clock strings in the portal's timezone; the app parses them as
  device-local with no correction (cookie says `timezone=UTC`). Times will be off when the
  portal and phone zones differ.
- `moment(string)` without a format (used in `getNextProgrammes`, `getLocalChannelTime`,
  catch-up day grouping) falls back to `new Date()`, which is engine-dependent for
  `"YYYY-MM-DD HH:mm"`. Use explicit formats on mobile. Same for `getMinute()` in the
  timeshift duration.
- `sortProgrammesByDate` assumes chronological order and compares
  `"YYYY-MM-DD HH:mm"` with `"YYYY-MM-DD HH:mm:ss"` as strings; it stops at the first
  unfinished programme (items after it are lost even if earlier-dated).
- XC catch-up rows store `description` but the catch-up screen reads `desc`, so XC
  descriptions are never shown in the catch-up list (Stalker ones are). Probably a bug.
- `tv_archive_duration` is not used to hide programmes older than the archive window;
  the server's `has_archive` flag is trusted.
- The `time_format` 12 h option is dead code (setting never loaded), so EPG strings are always
  24 h.
