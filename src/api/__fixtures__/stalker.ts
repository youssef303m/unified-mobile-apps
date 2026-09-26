// Stalker portal fixture (02-backend/stalker.md examples, fake values). The loader lives at
// /stalker_portal/server/load.php, so discovery has to probe past /portal.php first.
import { STALKER_HOST } from "./hosts";
import { onScenarioReset, scenario } from "./scenario";
import { json, notFound, params, text, type FixtureRequest, type FixtureResponse } from "./types";

export const STALKER_LOADER_PATH = "/stalker_portal/server/load.php";
export const STALKER_CHANNEL_TOTAL = 35;
export const STALKER_PAGE_SIZE = 14;

interface PortalState {
  handshakes: number;
  validTokens: Set<string>;
  contentCalls: number;
  requests: { method: string; action: string; headers: Record<string, string> }[];
}

export const portalState: PortalState = {
  handshakes: 0,
  validTokens: new Set(),
  contentCalls: 0,
  requests: [],
};
onScenarioReset(() => {
  portalState.handshakes = 0;
  portalState.validTokens = new Set();
  portalState.contentCalls = 0;
  portalState.requests = [];
});

const channel = (i: number) => ({
  id: String(1_200 + i),
  name: `Portal Channel ${i + 1}`,
  number: String(100 + i),
  cmd: `ffmpeg http://localhost/ch/${1_200 + i}_`,
  logo: `/stalker_portal/misc/logos/320/${1_200 + i}.png`,
  tv_archive: i % 4 === 0 ? "1" : "0",
  tv_archive_duration: i % 4 === 0 ? "7" : "0",
  epg_id: "",
  censored: "0",
  use_http_tmp_link: "1",
});

const movie = (i: number) => ({
  id: String(7_700 + i),
  name: `EN - Portal Movie ${i + 1} (2024)`,
  screenshot_uri: `/stalker_portal/screenshots/${7_700 + i}.jpg`,
  rating_imdb: "8.2",
  description: "A portal movie.",
  cmd: `/media/file_${7_700 + i}.mpg`,
  series: [],
  storage_id: "",
  added: `2024-09-${String((i % 28) + 1).padStart(2, "0")} 10:00:00`,
  tmdb_id: "693134",
  director: "Fixture Director",
  actors: "Fixture Actor",
  genres_str: "Sci-Fi",
  year: "2024",
  time: "166",
});

const seriesItem = (i: number) => ({
  id: String(3_300 + i),
  name: `Portal Series ${i + 1}`,
  screenshot_uri: `/stalker_portal/screenshots/s${3_300 + i}.jpg`,
  rating_imdb: "8.6",
  description: "A portal series.",
  genres_str: "Drama",
  actors: "Fixture Actor",
  director: "",
  year: "2022",
  added: "2024-09-01 10:00:00",
  tmdb_id: "136315",
});

function page<T>(items: T[], p: number) {
  const start = (p - 1) * STALKER_PAGE_SIZE;
  return {
    js: {
      total_items: items.length,
      max_page_items: STALKER_PAGE_SIZE,
      selected_item: 0,
      cur_page: p,
      data: items.slice(start, start + STALKER_PAGE_SIZE),
    },
  };
}

const channels = Array.from({ length: STALKER_CHANNEL_TOTAL }, (_, i) => channel(i));
const movies = Array.from({ length: 20 }, (_, i) => movie(i));
const seriesItems = Array.from({ length: 10 }, (_, i) => seriesItem(i));

function content(q: URLSearchParams): FixtureResponse {
  const action = q.get("action");
  const type = q.get("type");
  const p = Number(q.get("p") ?? "1");
  switch (action) {
    case "get_genres":
      return json({
        js: [
          { id: "*", title: "All", alias: "*" },
          { id: "5", title: "UK | Sports", alias: "uk_sports", censored: 0 },
          { id: "6", title: "UK | News", alias: "uk_news", censored: 0 },
          { id: "9", title: "XXX Adults", alias: "adult", censored: 1 },
        ],
      });
    case "get_categories":
      return json({
        js: [
          { id: "*", title: "All", alias: "*" },
          {
            id: type === "vod" ? "20" : "30",
            title: type === "vod" ? "Action" : "Drama",
            alias: "a",
          },
        ],
      });
    case "get_ordered_list":
      if (type === "itv") return json(page(channels, p));
      if (type === "vod") return json(page(movies, p));
      if (q.get("movie_id")) {
        return json({
          js: {
            total_items: 2,
            data: [
              {
                id: `${q.get("movie_id")}:1`,
                name: "Season 1",
                series_num: 1,
                cmd: "eyJ0eXBlIjoic2VyaWVzIiwic2Vhc29uX2lkIjoxfQ==",
                series: [1, 2, 3, 4],
                storage_id: "",
              },
              {
                id: `${q.get("movie_id")}:2`,
                name: "Season 2",
                series_num: 2,
                cmd: "eyJ0eXBlIjoic2VyaWVzIiwic2Vhc29uX2lkIjoyfQ==",
                series: [1, 2, 3],
                storage_id: "",
              },
            ],
          },
        });
      }
      return json(page(seriesItems, p));
    case "create_link": {
      const cmd = q.get("cmd") ?? "";
      if (type === "itv") {
        const id = /ch\/(\d+)/.exec(cmd)?.[1] ?? cmd;
        return json({
          js: {
            id,
            cmd: `ffmpeg http://cdn.stalker.fixture.test/live/play/${id}?stream=${id}&play_token=Xyz123&sn2=`,
          },
        });
      }
      if (type === "vod")
        return json({
          js: {
            url: `http://cdn.stalker.fixture.test/media/${cmd.replace(/\D/g, "")}.mkv?play_token=AbC987`,
          },
        });
      if (type === "series")
        return json({
          js: {
            url: `http://cdn.stalker.fixture.test/series/ep${q.get("series")}.mkv?play_token=Ser456`,
          },
        });
      return json({ js: { error: "no cmd" } });
    }
    case "get_short_epg":
      return json({
        js: {
          data: [
            {
              name: "Now on Portal",
              descr: "Live now",
              time: "2024-09-25 20:00:00",
              time_to: "2024-09-25 22:00:00",
            },
          ],
        },
      });
    case "get_simple_data_table":
      return json({
        js: {
          data: [
            {
              id: "1727290800_1284",
              real_id: "1284_1727290800",
              ch_id: "1284",
              name: "Premier League Live",
              descr: "Arsenal v Spurs",
              time: "2024-09-25 20:00:00",
              time_to: "2024-09-25 22:00:00",
              start_timestamp: 1727290800,
              stop_timestamp: 1727298000,
              mark_archive: 1,
            },
          ],
        },
      });
    case "get_events":
      return json({ js: { data: { event: "" } } });
    default:
      return json({ js: null });
  }
}

export function stalkerServer(request: FixtureRequest): FixtureResponse | undefined {
  if (request.url.host !== STALKER_HOST) return undefined;
  if (request.url.pathname !== STALKER_LOADER_PATH) return notFound();
  const q = params(request);
  const action = q.get("action") ?? "";
  portalState.requests.push({ method: request.method, action, headers: request.headers });
  const auth = request.headers.authorization?.replace("Bearer ", "");

  if (action === "handshake") {
    portalState.handshakes++;
    const token = `tok-${portalState.handshakes}`;
    portalState.validTokens.add(token);
    return json({ js: { token, random: "b1c2d3e4f5a6b7c8", not_valid: 0 } });
  }
  if (!auth || !portalState.validTokens.has(auth)) return text("Unauthorized", 401);
  if (action === "get_profile") {
    return json({
      js: {
        id: "10452",
        name: q.get("sn"),
        status: 1,
        phone: "2099-03-01 00:00:00",
        end_date: null,
        msg: "",
      },
    });
  }
  if (scenario.stalkerPostOnly && request.method === "GET") return text("Method Not Allowed", 405);
  portalState.contentCalls++;
  // Token expiry: after the first content call, the first token stops working.
  if (scenario.stalkerTokenExpires && portalState.contentCalls > 1 && auth === "tok-1") {
    portalState.validTokens.delete("tok-1");
    return text("Unauthorized", 401);
  }
  return content(q);
}
