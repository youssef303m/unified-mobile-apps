// TMDB, IBO image cache and analytics fixtures (02-backend/services.md examples).
import { config } from "@/config";

import { json, notFound, type FixtureRequest, type FixtureResponse } from "./types";

const tmdbHost = new URL(config.tmdb.apiBase).host;
const cacheHost = new URL(config.imageCache.url).host;
const analyticsUrl = new URL(config.analytics.url);

export const CACHED_TMDB_ID = "603";

const images = (id: number) => ({
  id,
  backdrops: [{ file_path: "/backdrop.jpg", width: 1920, height: 1080 }],
  logos: [{ file_path: "/logo.png", width: 500, height: 200 }],
  posters: [{ file_path: "/poster.jpg", width: 500, height: 750 }],
});

export const analyticsReceived: unknown[] = [];

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
  if (host === analyticsUrl.host && pathname === analyticsUrl.pathname) {
    analyticsReceived.push(JSON.parse(request.body || "{}"));
    return json({ success: true });
  }
  return undefined;
}
