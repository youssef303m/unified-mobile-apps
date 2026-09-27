// M5 EPG guide and catch-up on the fixtures (R-095, R-096, R-097).
import { fixturePlaylists } from "@/api/__fixtures__/ibo";
import { base64EncodeUtf8 } from "@/api/crypto";
import { ParseError } from "@/api/errors";
import { parsePlaylist } from "@/api/ibo/playlists";
import type { Playlist } from "@/api/ibo/types";
import { memoryStore } from "@/api/store";
import type { ContentSource } from "@/content/ContentSource";
import { CatalogueSession, login } from "@/content/catalogue";
import { toggleHiddenCategory } from "@/content/rules/live";
import type { CatalogueItem } from "@/content/types";
import { openTestDb } from "@/db/testing/testDb";
import { formatYmdHm, stalkerGuide, xtreamGuide, type GuideProgramme } from "@/utils/epgTime";

import {
  clearGuideCache,
  GuideLoader,
  guideDays,
  loadCatchup,
  mobileGuideTap,
  replayCategories,
  replayChannels,
  startOfDay,
} from "../guide";

const [xtream, m3u, portal] = fixturePlaylists.map(parsePlaylist) as [Playlist, Playlist, Playlist];

const channel = (id: string, extra: Partial<CatalogueItem> = {}): CatalogueItem => ({
  kind: "live",
  item_id: id,
  name: `Channel ${id}`,
  icon: "",
  category_id: "10",
  tv_archive: 0,
  tv_archive_duration: 0,
  ...extra,
});

const programme = (startMin: number, stopMin: number, archive = false): GuideProgramme => {
  const now = Date.now();
  return {
    start: new Date(now + startMin * 60_000),
    stop: new Date(now + stopMin * 60_000),
    title: "P",
    description: "",
    archive,
  };
};

/** Resolves once `loader.probe` leaves "pending" or every requested row is loaded. */
function settle(loader: GuideLoader, channels: CatalogueItem[]): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (channels.every((c) => loader.row(c).status !== "loading")) resolve();
      else setTimeout(check, 5);
    };
    check();
  });
}

beforeEach(() => clearGuideCache());

describe("R-095 / R-096 EPG guide", () => {
  it("R-095: the Xtream table is parsed with base64 titles and the archive flag", async () => {
    const { source } = await login(xtream, memoryStore());
    const rows = await source.guide?.(channel("10000"));
    expect(rows?.length).toBeGreaterThan(20);
    expect(rows?.[0]?.title).toBe("Programme 1 – Café");
    expect(rows?.[0]?.archive).toBe(true);
    expect(rows?.at(-1)?.archive).toBe(false);
  });

  it("R-095: Stalker titles stay plain text; M3U has no guide", async () => {
    const parsed = stalkerGuide([
      { time: "2026-09-27 10:00:00", time_to: "2026-09-27 11:00:00", name: "News" },
      { start_timestamp: "1830000000", stop_timestamp: "1830003600", title: "VGVzdA==" },
    ]);
    expect(parsed.map((p) => p.title)).toEqual(["News", "VGVzdA=="]);
    expect(parsed.every((p) => !p.archive)).toBe(true);
    const { source } = await login(m3u, memoryStore());
    expect(source.guide).toBeUndefined();
  });

  it("R-096: back-to-back programmes with the same title merge (gap ≤ 1 minute)", () => {
    const listing = (start: string, end: string, title: string) => ({
      start,
      end,
      title: base64EncodeUtf8(title),
      description: "",
    });
    const rows = xtreamGuide(
      [
        listing("2026-09-27 10:00:00", "2026-09-27 11:00:00", "News"),
        listing("2026-09-27 11:01:00", "2026-09-27 12:00:00", "news "),
        listing("2026-09-27 12:00:00", "2026-09-27 12:00:00", "Empty slot"),
        listing("2026-09-27 12:00:00", "2026-09-27 13:00:00", "Film"),
      ],
      0,
    );
    expect(rows.map((r) => [formatYmdHm(r.start).slice(11), r.title])).toEqual([
      ["10:00", "News"],
      ["12:00", "Film"],
    ]);
  });

  it("R-096: at most 4 rows load at once, the rows on screen first, cached for the session", async () => {
    let running = 0;
    let peak = 0;
    const order: string[] = [];
    const source = {
      guide: async (c: CatalogueItem) => {
        order.push(c.item_id);
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 10));
        running -= 1;
        return [programme(-30, 30)];
      },
    } as unknown as ContentSource;
    const channels = Array.from({ length: 10 }, (_, i) => channel(String(i)));
    const loader = new GuideLoader(source, "pid", () => undefined);
    loader.request(channels.slice(0, 6));
    loader.request(channels.slice(6));
    await settle(loader, channels);
    expect(peak).toBe(4);
    // 0-3 had started; the newly visible rows 6-9 jump ahead of the queued 4 and 5.
    expect(order).toEqual(["0", "1", "2", "3", "6", "7", "8", "9", "4", "5"]);
    expect(loader.probe).toBe("ok");
    loader.dispose();
    // A second guide on the same playlist reuses the rows.
    const again = new GuideLoader(source, "pid", () => undefined);
    expect(again.row(channels[0] as CatalogueItem).status).toBe("done");
    again.dispose();
  });

  it("R-096: gives up when the first 8 rows are empty; failed rows retry on the next visit", async () => {
    let calls = 0;
    const empty = { guide: async () => [] } as unknown as ContentSource;
    const channels = Array.from({ length: 9 }, (_, i) => channel(String(i)));
    const loader = new GuideLoader(empty, "a", () => undefined);
    loader.request(channels);
    await settle(loader, channels);
    expect(loader.probe).toBe("no_epg");
    loader.dispose();

    const failing = {
      guide: async () => {
        calls += 1;
        throw new Error("down");
      },
    } as unknown as ContentSource;
    const first = new GuideLoader(failing, "b", () => undefined);
    first.request(channels.slice(0, 8));
    await settle(first, channels.slice(0, 8));
    expect(first.probe).toBe("failed");
    expect(first.row(channels[0] as CatalogueItem).status).toBe("error");
    first.dispose();
    const second = new GuideLoader(failing, "b", () => undefined);
    expect(second.row(channels[0] as CatalogueItem).status).toBe("loading");
    second.dispose();
    expect(calls).toBe(8);
  });

  it("R-096 (mobile): now plays live, the future shows details, the past plays its archive", () => {
    expect(mobileGuideTap(programme(-10, 20), true)).toBe("play_live");
    expect(mobileGuideTap(programme(10, 20), true)).toBe("details");
    expect(mobileGuideTap(programme(-60, -30, true), true)).toBe("catchup");
    expect(mobileGuideTap(programme(-60, -30, true), false)).toBe("no_archive");
    expect(mobileGuideTap(programme(-60, -30, false), true)).toBe("no_archive");
  });

  it("the day picker lists today and every day with programmes", () => {
    const today = startOfDay(new Date());
    const days = guideDays([
      { status: "done", programmes: [programme(-26 * 60, -25 * 60), programme(0, 60)] },
      { status: "loading" },
    ]);
    expect(days.some((d) => d.getTime() === today.getTime())).toBe(true);
    expect(days[0]?.getTime()).toBeLessThan(today.getTime());
  });
});

describe("R-097 catch-up", () => {
  it("R-097: finished Xtream programmes with an archive, grouped by day", async () => {
    const { source } = await login(xtream, memoryStore());
    const result = await loadCatchup(
      source,
      channel("10000", { tv_archive: 1, tv_archive_duration: 7 }),
    );
    expect(result.kind).toBe("ok");
    const days = result.kind === "ok" ? result.days : [];
    const all = days.flatMap((d) => d.programmes);
    expect(all.length).toBeGreaterThan(10);
    expect(all[0]?.title).toBe("Programme 1 – Café");
    // Q-behaviour-fixes #5: the description is kept.
    expect(all[0]?.description).toBe("Description 1");
  });

  it("R-097: no catch-up for Stalker (blocked, parity) or M3U", async () => {
    for (const playlist of [portal, m3u]) {
      const { source } = await login(playlist, memoryStore());
      expect(source.capabilities.replay).toBe(false);
      expect((await loadCatchup(source, channel("1"))).kind).toBe("empty");
    }
  });

  it("R-097: a reply without listings and a failed request give the TV's two messages", async () => {
    const bad = {
      catchup: async () => {
        throw new ParseError("No epg_listings");
      },
    } as unknown as ContentSource;
    expect(await loadCatchup(bad, channel("1"))).toEqual({ kind: "error", reason: "bad_reply" });
    const down = {
      catchup: async () => {
        throw new Error("HTTP 500");
      },
    } as unknown as ContentSource;
    expect(await loadCatchup(down, channel("1"))).toEqual({
      kind: "error",
      reason: "request_failed",
    });
  });
});

describe("R-097 Replay lists", () => {
  async function context(playlist: Playlist) {
    const store = memoryStore();
    const db = await openTestDb();
    const { source } = await login(playlist, store);
    const catalogue = new CatalogueSession(db, source, playlist);
    await catalogue.ensureSection("live");
    return { db, store, catalogue };
  }

  it("R-097: categories with archive channels (hidden ones left out); only those channels", async () => {
    const ctx = await context(xtream);
    const result = await replayCategories(ctx);
    const ids = result.kind === "ok" ? result.categories.map((c) => c.category_id) : [];
    expect(ids.length).toBeGreaterThan(0);
    const first = ids[0] ?? "";
    const channels = await replayChannels(ctx, first, "default");
    expect(channels.length).toBeGreaterThan(0);
    expect(channels.every((c) => c.tv_archive !== 0 && c.tv_archive_duration !== 0)).toBe(true);
    toggleHiddenCategory(ctx.store, ctx.catalogue.playlistId, "live", first);
    const after = await replayCategories(ctx);
    expect(after.kind === "ok" && after.categories.some((c) => c.category_id === first)).toBe(
      false,
    );
  });

  it("R-097: no Replay for Stalker or M3U", async () => {
    for (const playlist of [portal, m3u]) {
      const ctx = await context(playlist);
      expect((await replayCategories(ctx)).kind).toBe("none");
    }
  });
});
