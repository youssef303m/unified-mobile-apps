import { M3U_HOST } from "../../__fixtures__/hosts";
import { bigM3u, M3U_BIG_COUNT } from "../../__fixtures__/m3u";
import { ParseError } from "../../errors";
import { classifyPlaylistUrl, loadM3u } from "../client";
import { classifyAttributed, groupSeries, M3uParser, parseM3uText } from "../parser";

const url = (path: string) => `http://${M3U_HOST}${path}`;

describe("M3U download + parse (m3u.md)", () => {
  it("splits the small playlist into live, movies and series", async () => {
    const result = await loadM3u(url("/playlist.m3u"));
    expect(result.live.items.map((i) => i.name)).toEqual(["Fixture News HD", "Fixture Sport"]);
    expect(result.live.categories.map((c) => c.category_id)).toEqual([
      "UK | General",
      "UK | Sports",
    ]);
    expect(result.vod.items[0]).toMatchObject({
      name: "Dune Part Two (2024)",
      category_id: "Movies | 2024",
      stream_id: "Dune Part Two (2024)",
    });
    expect(result.series.items).toHaveLength(1);
    const bear = result.series.items[0];
    expect(bear?.name).toBe("The Bear");
    expect(bear?.seasons.map((s) => [s.name, s.episodes.map((e) => e.id)])).toEqual([
      ["Season 01", ["01", "02"]],
      ["Season 02", ["01"]],
    ]);
  });

  it("handles every attribute variant (quotes kept, CRLF, commas, '=', directives)", async () => {
    const result = await loadM3u(url("/attributes.m3u"));
    const movie = result.vod.items.find((i) => i.stream_id === "greys");
    expect(movie?.name).toBe("Grey's Anatomy");
    expect(movie?.stream_icon).toBe(`http://${M3U_HOST}/logo.png?w=100&h=100`);
    expect(movie?.url.endsWith("\r")).toBe(false);

    const live = result.live.items;
    expect(live.find((i) => i.stream_id === "empty.group")).toMatchObject({
      name: "Empty Group Channel",
      category_id: "Uncategorized",
    });
    // No group-title: "All", renamed and merged into the existing "Uncategorized".
    expect(live.find((i) => i.stream_id === "no.group")?.category_id).toBe("Uncategorized");
    expect(result.live.categories.filter((c) => c.category_id === "Uncategorized")).toHaveLength(1);
    // The #EXTVLCOPT line between #EXTINF and the URL no longer drops the entry.
    expect(live.find((i) => i.stream_id === "vlc")?.url).toBe(`http://${M3U_HOST}/u/p/4`);
    // No http(s) URL: skipped.
    expect([...live, ...result.vod.items].some((i) => i.stream_id === "rtmp")).toBe(false);
    // "vod" anywhere in the URL: classified as a movie (TV rule kept).
    expect(result.vod.items.some((i) => i.stream_id === "vodafone")).toBe(true);
    expect(live.find((i) => i.stream_id === "single")?.name).toBe("Single Quoted");
    // No space before SNN: dropped from series, as on TV.
    expect(result.series.items).toHaveLength(0);
  });

  it("uses the plain parser when the file has no tvg- attributes", async () => {
    const result = await loadM3u(url("/plain.m3u"));
    expect(result.live.categories).toEqual([{ category_id: "all", category_name: "All" }]);
    expect(result.live.items[0]).toMatchObject({
      name: "Plain Channel",
      stream_id: "Plain Channel",
      num: 1,
    });
    expect(result.vod.items[0]?.name).toBe("Plain Movie");
    expect(result.series.items[0]?.name).toBe("Plain Show");
  });

  it("a reply that is not an M3U file is a ParseError", async () => {
    await expect(loadM3u(url("/broken.m3u"))).rejects.toBeInstanceOf(ParseError);
  });

  it("parses the 20,000-entry playlist in under 3 s", async () => {
    const text = bigM3u();
    const started = Date.now();
    const { isM3u, result } = await parseM3uText(text);
    const elapsed = Date.now() - started;
    expect(isM3u).toBe(true);
    expect(result.live.items.length + result.vod.items.length).toBe(M3U_BIG_COUNT * 0.9);
    expect(result.series.items.reduce((n, s) => n + (s.seasons[0]?.episodes.length ?? 0), 0)).toBe(
      M3U_BIG_COUNT * 0.1,
    );
    expect(elapsed).toBeLessThan(3000);
  });

  it("the big playlist also downloads through the fixture server", async () => {
    const result = await loadM3u(url("/big.m3u"));
    expect(result.live.items).toHaveLength(M3U_BIG_COUNT * 0.7);
  });

  it("parses the same result whatever the chunk boundaries", () => {
    const text = bigM3u(300);
    const whole = new M3uParser();
    whole.push(text);
    const chunked = new M3uParser();
    for (let i = 0; i < text.length; i += 7) chunked.push(text.slice(i, i + 7));
    expect(chunked.finish()).toEqual(whole.finish());
  });
});

describe("classification helpers", () => {
  it("URL rules: /movie/, vod, =movie → vod; /series/ wins", () => {
    expect(classifyAttributed("http://h/live/1")).toBe("live");
    expect(classifyAttributed("http://h/movie/1.mp4")).toBe("vod");
    expect(classifyAttributed("http://h/get?type=movie")).toBe("vod");
    expect(classifyAttributed("http://vod.h/series/1.mp4")).toBe("series");
  });

  it("groupSeries keeps playlist order and 'Season NN' names", () => {
    const series = groupSeries([
      {
        stream_id: "1",
        name: "Show S02 E01",
        stream_icon: "c",
        url: "u1",
        num: 1,
        category_id: "g",
      },
      {
        stream_id: "2",
        name: "Show S01 E03 Title",
        stream_icon: "",
        url: "u2",
        num: 2,
        category_id: "g",
      },
      { stream_id: "3", name: "NoSeason", stream_icon: "", url: "u3", num: 3, category_id: "g" },
    ]);
    expect(series).toHaveLength(1);
    expect(series[0]?.seasons.map((s) => s.name)).toEqual(["Season 02", "Season 01"]);
    expect(series[0]?.seasons[1]?.episodes[0]).toMatchObject({
      id: "03 Title",
      title: "Episode 03 Title",
    });
  });

  it("a pasted URL with username= and password= is Xtream", () => {
    expect(
      classifyPlaylistUrl("http://h:8080/get.php?username=u1&password=p1&type=m3u_plus"),
    ).toEqual({
      playlist_type: "xc",
      url: "http://h:8080",
      username: "u1",
      password: "p1",
    });
    expect(classifyPlaylistUrl("http://h/list.m3u")).toEqual({
      playlist_type: "general",
      url: "http://h/list.m3u",
    });
  });
});
