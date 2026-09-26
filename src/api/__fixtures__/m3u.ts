// M3U fixture server (02-backend/m3u.md examples, fake values).
import { M3U_HOST, TEST_STREAMS } from "./hosts";
import { text, type FixtureRequest, type FixtureResponse } from "./types";

const H = `http://${M3U_HOST}`;

export const smallM3u = [
  '#EXTM3U url-tvg="http://epg.fixture.test/guide.xml"',
  `#EXTINF:-1 tvg-id="news.fixture" tvg-name="Fixture News HD" tvg-logo="${H}/logo/news.png" group-title="UK | General",Fixture News HD`,
  TEST_STREAMS.hls,
  `#EXTINF:-1 tvg-id="sport.fixture" tvg-name="Fixture Sport" tvg-logo="${H}/logo/sport.png" group-title="UK | Sports",Fixture Sport`,
  `${H}/fixture_user/fixture_pass/10002`,
  `#EXTINF:-1 tvg-id="" tvg-name="Dune Part Two (2024)" tvg-logo="${H}/img/dune2.jpg" group-title="Movies | 2024",Dune Part Two (2024)`,
  `${H}/movie/fixture_user/fixture_pass/55012.mp4`,
  `#EXTINF:-1 tvg-name="The Bear S01 E01" tvg-logo="${H}/img/bear.jpg" group-title="Series | Drama",The Bear S01 E01`,
  `${H}/series/fixture_user/fixture_pass/880011.mp4`,
  `#EXTINF:-1 tvg-name="The Bear S01 E02" tvg-logo="${H}/img/bear.jpg" group-title="Series | Drama",The Bear S01 E02`,
  `${H}/series/fixture_user/fixture_pass/880012.mp4`,
  `#EXTINF:-1 tvg-name="The Bear S02 E01" tvg-logo="${H}/img/bear.jpg" group-title="Series | Drama",The Bear S02 E01`,
  `${H}/series/fixture_user/fixture_pass/880021.mp4`,
  "",
].join("\n");

/** Every attribute variant and broken line the parser must handle (CRLF line endings). */
export const attributesM3u = [
  "#EXTM3U",
  // Apostrophe in the name, comma in the display name, "=" in the logo query string.
  `#EXTINF:-1 tvg-id="greys" tvg-name="Grey's Anatomy" tvg-logo="${H}/logo.png?w=100&h=100" group-title="Drama",Grey's Anatomy, Season Special`,
  `${H}/movie/u/p/1.mkv`,
  // Empty group-title → "Uncategorized"; no tvg-name → display name.
  `#EXTINF:-1 tvg-id="empty.group" group-title="",Empty Group Channel`,
  `${H}/u/p/2`,
  // No group-title at all → "All", renamed "Uncategorized" (merged with the empty group).
  `#EXTINF:-1 tvg-id="no.group",No Group Channel`,
  `${H}/u/p/3`,
  // A directive line between #EXTINF and the URL.
  `#EXTINF:-1 tvg-id="vlc" group-title="Drama",With VLC Option`,
  "#EXTVLCOPT:http-user-agent=Fixture",
  `${H}/u/p/4`,
  // No http URL → skipped.
  `#EXTINF:-1 tvg-id="rtmp" group-title="Drama",RTMP Channel`,
  "rtmp://example.fixture.test/live",
  // "vod" substring in the URL → classified as a movie (TV rule kept).
  `#EXTINF:-1 tvg-id="vodafone" group-title="Drama",Vodafone Sports`,
  `http://vodafone.fixture.test/live/5`,
  // Single-quoted attributes and a series without a space before SNN (dropped from series).
  `#EXTINF:-1 tvg-id='single' tvg-name='Single Quoted' group-title='Drama',Single Quoted`,
  `${H}/u/p/6`,
  `#EXTINF:-1 tvg-name="The.Bear.S01E01" group-title="Series",The.Bear.S01E01`,
  `${H}/series/u/p/7.mp4`,
  "",
].join("\r\n");

export const plainM3u = [
  "#EXTM3U",
  "#EXTINF:-1,Plain Channel",
  `${H}/u/p/1`,
  "#EXTINF:-1,Plain Movie",
  `${H}/movie/u/p/2.mp4`,
  "#EXTINF:-1,Plain Show S01 E01",
  `${H}/series/u/p/3.mp4`,
  "",
].join("\n");

export const brokenM3u = "<html><body>502 Bad Gateway</body></html>";

export const M3U_BIG_COUNT = 20_000;

/** 20,000 entries: 70% live, 20% movies, 10% episodes, across 50 groups. */
export function bigM3u(count = M3U_BIG_COUNT): string {
  const lines = ["#EXTM3U"];
  for (let i = 0; i < count; i++) {
    const group = `Group ${i % 50}`;
    const kind = i % 10;
    if (kind < 7) {
      lines.push(
        `#EXTINF:-1 tvg-id="ch${i}" tvg-name="Channel ${i}" tvg-logo="${H}/l/${i}.png" group-title="${group}",Channel ${i}`,
      );
      lines.push(`${H}/u/p/${i}`);
    } else if (kind < 9) {
      lines.push(
        `#EXTINF:-1 tvg-name="Movie ${i}" tvg-logo="${H}/m/${i}.jpg" group-title="${group}",Movie ${i}`,
      );
      lines.push(`${H}/movie/u/p/${i}.mp4`);
    } else {
      const show = Math.floor(i / 100);
      lines.push(
        `#EXTINF:-1 tvg-name="Show ${show} S01 E${String(i % 100).padStart(2, "0")}" group-title="${group}",Show ${show}`,
      );
      lines.push(`${H}/series/u/p/${i}.mp4`);
    }
  }
  return lines.join("\n");
}

let bigCache: string | undefined;

export function m3uServer(request: FixtureRequest): FixtureResponse | undefined {
  if (request.url.host !== M3U_HOST) return undefined;
  switch (request.url.pathname) {
    case "/playlist.m3u":
      return text(smallM3u, 200, "audio/x-mpegurl");
    case "/attributes.m3u":
      return text(attributesM3u, 200, "audio/x-mpegurl");
    case "/plain.m3u":
      return text(plainM3u, 200, "audio/x-mpegurl");
    case "/big.m3u":
      bigCache ??= bigM3u();
      return text(bigCache, 200, "audio/x-mpegurl");
    case "/broken.m3u":
      return text(brokenM3u, 200, "text/html");
    default:
      return text("Not found", 404);
  }
}
