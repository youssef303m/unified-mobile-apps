# M3U ("general") playlists

How a plain M3U playlist (`playlist_type: "general"`) is downloaded, parsed and split into
Live / Movies / Series. This parser is deliberately simple and lossy; the quirks are listed
so the phone app can decide whether to copy them (recommended: reproduce the
classification rules, but fix the lossy attribute parsing — see Notes).

Source: `core/js/login_operation.js` (`proceed_login`, general branch),
`core/js/common.js` (`parseM3uResponse`, `parseSeries`, `splitStrings`),
`core/js/series_summary.js` (general branch), `core/js/vod_series_player.js`.

---

## 1. Download

```
GET {playlist.url}              (trailing "/" stripped)
Accept: application/json        (sic — sent even though the reply is text)
no timeout, no proxy prefix (plain $.ajax, not the api() wrapper)
```

- The reply must be a **string starting with `#EXTM3U`** (no leading BOM/whitespace
  tolerated). Anything else → error "Sorry, there is a problem with your playlist. Please
  contact your IPTV provider. IBOPlayer does not manage or sell playlist subscriptions".
- HTTP error → generic playlist error.
- Parsing throws → generic playlist error.
- M3U is always loaded **in full at login** (no load-on-demand), and nothing is cached
  between sessions.
- The same path is used as the automatic fallback for an XC playlist whose API failed
  (`url` replaced by `origin_url`, i.e. the `get.php` URL).

Example input:

```
#EXTM3U url-tvg="http://epg.example.tv/guide.xml"
#EXTINF:-1 tvg-id="bbc1.uk" tvg-name="BBC One HD" tvg-logo="http://logo.example.tv/bbc1.png" group-title="UK | General",BBC One HD
http://line.example.tv:8080/demo123/pass456/10001
#EXTINF:-1 tvg-id="" tvg-name="Dune Part Two (2024)" tvg-logo="http://img.example.tv/dune2.jpg" group-title="Movies | 2024",Dune Part Two (2024)
http://line.example.tv:8080/movie/demo123/pass456/55012.mkv
#EXTINF:-1 tvg-name="The Bear S01 E01" tvg-logo="http://img.example.tv/bear.jpg" group-title="Series | Drama",The Bear S01 E01
http://line.example.tv:8080/series/demo123/pass456/880011.mp4
```

## 2. Parsing algorithm (exact)

```ts
function parseM3u(text: string) {
  // 1. Remove EVERY single and double quote in the whole file.
  text = text.replace(/['"]+/g, '');
  // 2. Split on the #EXTINF marker; the marker, its duration and any spaces/commas after it are consumed.
  const blocks = text.split(/#EXTINF:-{0,1}[0-9]{1,} {0,},{0,}/gm);
  blocks.shift();                                   // the header before the first #EXTINF
  const hasTvg = text.includes('tvg-');             // decides between two parsers
  return hasTvg ? parseAttributed(blocks) : parsePlain(blocks);
}
```

### 2a. Attributed parser (file contains `tvg-` anywhere)

For each block (`num` = 1-based running counter of blocks, **including skipped ones**):

1. `lines = block.split("\n")`.
2. `url = lines[1]` if its length > 1, else `""`. If `url` does not contain `http:` or
   `https:` (regex `/https?:/`) → skip the block. (So an `#EXTVLCOPT`/`#EXTGRP` line between
   `#EXTINF` and the URL makes the entry disappear.)
3. **Type from the URL** (substring tests, first match order as below, later overrides):
   - `live` by default;
   - `vod` if url contains `/movie/` or `vod` or `=movie` or `==movie==`;
   - `series` if url contains `/series/` (overrides vod).
4. `head = lines[0].trim()`, `parts = head.split(",")`; display `name = parts[1] ?? ""`
   (only the text between the first and second comma).
5. Attribute tokens: `parts[0]` is split on the literals `tvg-`, then `channel-`, then
   `group-` (recursively), dropping blank pieces. Each piece is split on `=`; `key = [0]`,
   `value = [1]` (untrimmed; anything after a second `=` is lost). Recognised keys:
   - `id` → `stream_id`
   - `name` → `name` (if `value.trim() != ""`, else keep the display name)
   - `logo` → `stream_icon`
   - `title` (from `group-title`) → `category_name = value.split(",")[0]`; empty →
     `"Uncategorized"`
   Default `category_name = "All"`. `channel-id`, `channel-number`, `tvg-chno`,
   `tvg-shift`, `catchup*`, `url-tvg` are ignored.
6. `stream_id` blank → `stream_id = name`.
7. Item: `{ stream_id, name, stream_icon, title: "", url, num, category_id: category_name }`.
8. Categories are created per type in first-seen order:
   `{ category_id: category_name, category_name }` (the **name is the id**).

### 2b. Plain parser (no `tvg-` anywhere)

- One category per type: `{ category_id: "all", category_name: "All" }`.
- For block `i`: `name = lines[0].trim()`, `url = lines[1]`; type `movie` if url contains
  `/movie/`, `series` if `/series/`, else `live` (note: no `vod` substring test here).
- Item: `{ stream_id: name, name, stream_icon: "", num: i+1, category_id: "all", url }`.

### 2c. Post-processing

- For each of live/vod/series: if there is more than one category, the category whose
  `category_id === "All"` (capital A — items with no `group-title`) is renamed to
  `"Uncategorized"`. (The plain parser's lowercase `"all"` is never renamed.)
- Live and VOD go straight into the models (`setCategories`, `setMovies`,
  `insertMoviesToCategories` — see `data-models.md`).
- Series items are grouped by `parseSeries` (below).

```ts
interface M3uItem { stream_id: string; name: string; stream_icon: string; url: string; num: number; category_id: string; title?: string }

function classify(url: string): 'live' | 'vod' | 'series' {
  let t: 'live' | 'vod' | 'series' = 'live';
  if (url.includes('/movie/') || url.includes('vod') || url.includes('=movie') || url.includes('==movie==')) t = 'vod';
  if (url.includes('/series/')) t = 'series';
  return t;
}
```

## 3. Series grouping (`parseSeries`)

For each series item (items that fail any step are silently dropped):

```ts
function groupSeries(items: M3uItem[]): Series[] {
  const map: Record<string, any> = {};
  for (const item of items) {
    try {
      const pieces = item.name.split(/ S[0-9]{2}/);        // " S01" splits name / rest
      const sTag = item.name.match(/S[0-9]{2}/)![0];       // throws when there is no SNN → dropped
      const seasonName = 'Season ' + sTag.trim().replace('S', '');   // "Season 01" (keeps leading zero)
      const seriesName = pieces[0].trim();
      const episodeName = pieces[1].trim().replace('E', ''); // "E01" -> "01"; " E05 Title" -> "05 Title"
      const entry = map[seriesName] ??= {
        series_id: seriesName, name: seriesName, cover: item.stream_icon, youtube_trailer: '',
        category_id: item.category_id, rating: '', rating_5based: '', genre: '', director: '',
        cast: '', plot: '', season_map: {}, episodes: {},
      };
      if (!entry.season_map[seasonName]) {
        entry.season_map[seasonName] = { name: seasonName, cover: '<bundled series.png>' };
        entry.episodes[seasonName] = [];
      }
      entry.episodes[seasonName].push({
        id: episodeName, name: episodeName, url: item.url, info: {}, title: 'Episode ' + episodeName,
      });
    } catch { /* dropped */ }
  }
  // series in first-seen order; num = 1..n; seasons in first-seen order
  return Object.values(map).map((e: any, i) => {
    const seasons = Object.values(e.season_map);
    delete e.season_map;
    return { ...e, num: i + 1, seasons };
  });
}
```

- Series identity is the **name** (`series_id = name`), first item's logo is the cover,
  first item's group is the category.
- Seasons/episodes keep playlist order (no sorting). Season name keys are like
  `"Season 01"`.
- Series summary for M3U: `season.episodes = series.episodes[season.name]`; no network call.
- Name must contain a space before `SNN` (e.g. `"The Bear S01 E01"`, `"The Bear S01E01"`).
  `"The.Bear.S01E01"` has no space → `pieces[1]` undefined → throws → dropped.

## 4. Playback

M3U items play their own `url` as-is (live, movie and episode). No catch-up, no EPG
(the Live page hides the EPG-guide button for general playlists; Replay says "Replay not
available for current playlist").

## 5. Fields that M3U items lack

No `rating`, `added`, `last_modified`, `container_extension`, `tv_archive`. Consequences:
Top Rated / Newly Added / Recently Added rows are empty; "rating"/"added" sort leaves order
unchanged (`getSortedMovies` returns the list untouched when the first item lacks the key);
"number" sort uses `num`.

## Notes / uncertainties

- **All quotes are stripped from the entire file before parsing**, so channel names and
  URLs lose apostrophes (`Grey's Anatomy` → `Greys Anatomy`), and URLs containing quotes
  change.
- Lines are split on `\n` only; with CRLF files every value (including the URL) keeps a
  trailing `\r`. Values other than the last attribute keep a trailing space
  (e.g. `stream_icon = "http://…png "`). The TV players tolerate this; a phone app should
  trim.
- A comma inside `tvg-name` or the display name truncates the display name; a comma in
  `group-title` truncates the category.
- A `=` inside `tvg-logo` (query strings) truncates the logo URL.
- The `vod` substring test matches any URL containing "vod" anywhere (host names like
  `vodafone…` or paths like `/vod-live/`) and misclassifies live channels as movies.
- `num` counts all blocks, including skipped ones, so numbers can have gaps.
- Episode ids are the episode label (`"01"`), unique only within a season; watch progress
  is keyed by season/episode **index** anyway (see `data-models.md`).
- `url-tvg`/`x-tvg-url` headers are ignored: M3U playlists have no EPG in this app.
- Recommended for mobile: a real attribute parser (`key="value"` regex), CRLF handling,
  keep quotes inside names — but keep the same live/vod/series URL rules and the
  `Season NN` grouping so behaviour matches the TV app.
