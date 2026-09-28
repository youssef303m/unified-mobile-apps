// TMDB, IBO image cache and subtitle fixtures (02-backend/services.md examples).
import { config } from "@/config";

import { json, notFound, type FixtureRequest, type FixtureResponse } from "./types";

const tmdbHost = new URL(config.tmdb.apiBase).host;
const cacheHost = new URL(config.imageCache.url).host;
const ibosubSearch = new URL(config.subtitles.searchUrl);
const ibosubContent = new URL(config.subtitles.contentUrl);

const CRLF = String.fromCharCode(13, 10);

/** A short SRT with CRLF line ends and the TV's tags, for the subtitle overlay. */
export const FIXTURE_SRT = [
  "1",
  "00:00:01,000 --> 00:00:04,000",
  "<i>Fixture</i> subtitle one",
  "",
  "2",
  "00:00:05,500 --> 00:00:09,000",
  "Line two<br>second line",
  "",
  "3",
  "00:00:10,000 --> 00:10:00,000",
  "<b>Fixture</b> subtitle three",
  "",
].join(CRLF);

/** The fixture movie's TMDB id (vodInfo) and the fixture series' (seriesInfo). */
export const SUBTITLED_TMDB_IDS = ["693134", "136315"];

export const CACHED_TMDB_ID = "603";

const images = (id: number) => ({
  id,
  backdrops: [{ file_path: "/backdrop.jpg", width: 1920, height: 1080 }],
  logos: [{ file_path: "/logo.png", width: 500, height: 200 }],
  posters: [{ file_path: "/poster.jpg", width: 500, height: 750 }],
});

export function servicesServer(request: FixtureRequest): FixtureResponse | undefined {
  const { host, pathname } = request.url;
  const q = request.url.searchParams;
  if (host === tmdbHost) {
    if (q.get("api_key") === null) return json({ status_message: "Invalid API key" }, 401);
    const search = /^\/3\/search\/(movie|tv)$/.exec(pathname);
    if (search) {
      const kind = search[1];
      return json({
        page: 1,
        results: [
          kind === "movie"
            ? {
                id: 693134,
                title: "Dune: Part Two",
                release_date: "2024-02-27",
                overview: "…",
                poster_path: "/poster.jpg",
              }
            : {
                id: 136315,
                name: "The Bear",
                first_air_date: "2022-06-23",
                overview: "…",
                poster_path: "/poster.jpg",
              },
        ],
        total_results: 1,
      });
    }
    const imgs = /^\/3\/(movie|tv)\/(\d+)\/images$/.exec(pathname);
    if (imgs) return json(images(Number(imgs[2])));
    if (/^\/3\/movie\/\d+\/credits$/.test(pathname)) {
      return json({ cast: [{ name: "Fixture Actor", order: 0, profile_path: "/actor.jpg" }] });
    }
    return notFound();
  }
  if (host === cacheHost) {
    const m = /^\/api\/(movies|series)\/images\/show\/(\d+)$/.exec(pathname);
    if (m?.[2] === CACHED_TMDB_ID) return json({ data: { tmdbId: 603, ...images(603) } });
    return json({ message: "Not cached" }, 404);
  }
  if (host === ibosubSearch.host && pathname === ibosubSearch.pathname) {
    const form = new URLSearchParams(request.body ?? "");
    const id = form.get("tmdb_id") ?? "";
    if (!SUBTITLED_TMDB_IDS.includes(id)) return json({ status: "success", subtitles: [] });
    return json({
      status: "success",
      subtitles: [
        { file_id: 11, language: "en" },
        { file_id: 12, language: "en" },
        { file_id: 21, language: "ar" },
        { file_id: 31, language: "fr" },
      ],
      srt_map: { "11": FIXTURE_SRT },
      movie_list_id: 42,
    });
  }
  if (host === ibosubContent.host && pathname === ibosubContent.pathname) {
    const form = new URLSearchParams(request.body ?? "");
    if (form.get("movie_list_id") !== "42") return json({ status: "error" });
    return json({
      status: "success",
      content: FIXTURE_SRT.replace(/Fixture/g, form.get("file_id") ?? ""),
    });
  }
  return undefined;
}
