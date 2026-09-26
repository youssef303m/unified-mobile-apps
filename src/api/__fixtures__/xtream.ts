// Xtream fixture server (02-backend/xtream.md examples, fake values). Two hosts: the normal
// one (~50 items per type) and a "big" one with 20,000 generated live channels.
import { base64EncodeUtf8 } from "../crypto";

import { XTREAM_BIG_HOST, XTREAM_HOST, XTREAM_PASS, XTREAM_USER } from "./hosts";
import { json, params, type FixtureRequest, type FixtureResponse } from "./types";

export const XTREAM_BIG_COUNT = 20_000;
/** The big host's first VOD category holds this many movies (the M4 scrolling check). */
export const XTREAM_BIG_VOD_CATEGORY = 5_000;
const PER_TYPE = 50;
const CATEGORIES = 5;

const LIVE_CATEGORY_NAMES = ["UK | SPORTS", "UK | NEWS", "FR | GENERAL", "KIDS", "XXX ADULTS"];
const VOD_CATEGORY_NAMES = [
  "EN | ACTION",
  "EN | DRAMA",
  "AR | MOVIES",
  "DOCUMENTARY",
  "ADULT MOVIES",
];
const SERIES_CATEGORY_NAMES = [
  "EN | DRAMA SERIES",
  "EN | COMEDY",
  "AR | SERIES",
  "ANIME",
  "KOREAN",
];

const categories = (names: string[], base: number) =>
  names.map((name, i) => ({ category_id: String(base + i), category_name: name, parent_id: 0 }));

export const liveCategories = categories(LIVE_CATEGORY_NAMES, 10);
export const vodCategories = categories(VOD_CATEGORY_NAMES, 40);
export const seriesCategories = categories(SERIES_CATEGORY_NAMES, 70);

const nowS = () => Math.floor(Date.now() / 1000);

export function liveStreams(count = PER_TYPE) {
  return Array.from({ length: count }, (_, i) => ({
    num: i + 1,
    name: `Fixture Channel ${i + 1}`,
    stream_type: "live",
    stream_id: 10_000 + i,
    stream_icon: `http://logo.fixture.test/${i + 1}.png`,
    epg_channel_id: `ch${i + 1}.fixture`,
    added: String(1_690_000_000 + i),
    // One uncategorized channel ("null") to exercise the Uncategorized row.
    category_id: i === count - 1 ? "null" : String(10 + (i % CATEGORIES)),
    custom_sid: "",
    tv_archive: i % 3 === 0 ? 1 : 0,
    direct_source: "",
    tv_archive_duration: i % 3 === 0 ? 7 : 0,
  }));
}

export function vodStreams(count = PER_TYPE, oneCategory = false) {
  return Array.from({ length: count }, (_, i) => ({
    num: i + 1,
    name: `EN - Fixture Movie ${i + 1} (${2000 + (i % 25)})`,
    stream_type: "movie",
    stream_id: 55_000 + i,
    stream_icon: `http://img.fixture.test/movie${i + 1}.jpg`,
    rating: String(5 + (i % 50) / 10),
    rating_5based: 2.5,
    // The first 5 were added within the last 15 days ("Newly Added").
    added: String(i < 5 ? nowS() - i * 86_400 : 1_700_000_000 + i),
    category_id: oneCategory ? "40" : String(40 + (i % CATEGORIES)),
    container_extension: i % 4 === 0 ? "m3u8" : i % 2 === 0 ? "mp4" : "mkv",
    custom_sid: null,
    direct_source: "",
  }));
}

export function seriesList() {
  return Array.from({ length: PER_TYPE }, (_, i) => ({
    num: i + 1,
    name: `Fixture Series ${i + 1}`,
    series_id: 3_300 + i,
    cover: `http://img.fixture.test/series${i + 1}.jpg`,
    plot: "A fixture series plot.",
    cast: "Fixture Actor",
    director: "",
    genre: "Drama / Comedy",
    releaseDate: "2022-06-23",
    last_modified: String(i < 3 ? nowS() - i * 86_400 : 1_700_000_000 + i),
    rating: "8.6",
    rating_5based: 4.3,
    backdrop_path: [`http://img.fixture.test/series${i + 1}_bd.jpg`],
    youtube_trailer: "",
    episode_run_time: "30",
    category_id: String(70 + (i % CATEGORIES)),
  }));
}

export const vodInfo = (vodId: string) => ({
  info: {
    name: `Fixture Movie ${Number(vodId) - 55_000 + 1}`,
    tmdb_id: "693134",
    movie_image: "http://img.fixture.test/movie.jpg",
    backdrop_path: ["http://img.fixture.test/movie_bd.jpg"],
    youtube_trailer: "Way9Dexny3w",
    genre: "Science Fiction, Adventure",
    plot: "A fixture movie plot.",
    description: "A fixture movie plot.",
    cast: "Fixture Actor, Fixture Actress",
    director: "Fixture Director",
    releasedate: "2024-02-27",
    duration: "02:46:00",
    duration_secs: 9960,
    rating: "8.2",
    age: "PG-13",
  },
  movie_data: { stream_id: Number(vodId), name: "Fixture Movie", container_extension: "mkv" },
});

const episode = (season: number, n: number) => ({
  id: String(880_000 + season * 100 + n),
  episode_num: n,
  title: `Fixture Series - S0${season}E0${n} - Episode ${n}`,
  container_extension: "mp4",
  info: {
    duration_secs: 1800,
    duration: "00:30:00",
    movie_image: "http://img.fixture.test/ep.jpg",
    plot: "Episode plot.",
  },
  season,
});

export const seriesInfo = () => ({
  seasons: [
    { season_number: 1, name: "Season 1", episode_count: 4, cover: "", air_date: "2022-06-23" },
    { season_number: 2, name: "Season 2", episode_count: 4, cover: "", air_date: "2023-06-22" },
  ],
  info: {
    name: "Fixture Series",
    releaseDate: "2022-06-23",
    plot: "…",
    cast: "…",
    genre: "Drama",
    rating: "8.6",
    backdrop_path: ["…"],
    tmdb: "136315",
  },
  episodes: {
    "1": [1, 2, 3, 4].map((n) => episode(1, n)),
    "2": [1, 2, 3, 4].map((n) => episode(2, n)),
  },
});

const pad = (n: number) => String(n).padStart(2, "0");
/** Server wall clock "YYYY-MM-DD HH:mm:ss" in UTC (the fixture server's zone). */
const wallUtc = (unix: number) => {
  const d = new Date(unix * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};

/** Hourly programmes around now, titles and descriptions base64-encoded as Xtream sends them. */
function listings(fromHours: number, toHours: number, withArchive: boolean) {
  const hour = Math.floor(nowS() / 3600) * 3600;
  return Array.from({ length: toHours - fromHours }, (_, k) => {
    const start = hour + (fromHours + k) * 3600;
    return {
      id: String(90_000 + k),
      epg_id: "33",
      title: base64EncodeUtf8(`Programme ${k + 1} – Café`),
      lang: "en",
      start: wallUtc(start),
      end: wallUtc(start + 3600),
      description: base64EncodeUtf8(`Description ${k + 1}`),
      channel_id: "ch.fixture",
      start_timestamp: String(start),
      stop_timestamp: String(start + 3600),
      ...(withArchive ? { now_playing: 0, has_archive: start + 3600 <= nowS() ? 1 : 0 } : {}),
    };
  });
}

function account(username: string, password: string) {
  if (username === "expired_user")
    return { user_info: { username, password, auth: 1, status: "Expired" } };
  if (username !== XTREAM_USER || password !== XTREAM_PASS) return { user_info: { auth: 0 } };
  return {
    user_info: {
      username,
      password,
      auth: 1,
      status: "Active",
      exp_date: String(nowS() + 30 * 86_400),
      is_trial: "0",
      active_cons: "0",
      max_connections: "1",
      allowed_output_formats: ["m3u8", "ts"],
    },
    server_info: {
      url: "xtream.fixture.test",
      port: "8080",
      timezone: "UTC",
      timestamp_now: nowS(),
      time_now: wallUtc(nowS()),
    },
  };
}

export function xtreamServer(request: FixtureRequest): FixtureResponse | undefined {
  const { host, pathname } = request.url;
  const big = host === XTREAM_BIG_HOST;
  if ((host !== XTREAM_HOST && !big) || pathname !== "/player_api.php") return undefined;
  const q = params(request);
  const login = account(q.get("username") ?? "", q.get("password") ?? "");
  const action = q.get("action");
  if (!action) return json(login);
  if (login.user_info.auth === 0) return json({ user_info: { auth: 0 } });
  switch (action) {
    case "get_live_categories":
      return json(liveCategories);
    case "get_live_streams":
      return json(liveStreams(big ? XTREAM_BIG_COUNT : PER_TYPE));
    case "get_vod_categories":
      return json(vodCategories);
    case "get_vod_streams":
      return json(big ? vodStreams(XTREAM_BIG_VOD_CATEGORY, true) : vodStreams());
    case "get_series_categories":
      return json(seriesCategories);
    case "get_series":
      return json(seriesList());
    case "get_vod_info":
      return json(vodInfo(q.get("vod_id") ?? "55000"));
    case "get_series_info":
      return json(seriesInfo());
    case "get_short_epg":
      return json({ epg_listings: listings(-1, 3, false) });
    case "get_simple_data_table":
      return json({ epg_listings: listings(-24, 6, true) });
    default:
      return json([], 200);
  }
}
