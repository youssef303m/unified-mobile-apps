import {
  decodeBase64Title,
  epgClock,
  formatYmdHm,
  getLocalChannelTime,
  getNextProgrammes,
  groupFinishedByDay,
  normalizeGuide,
  parseWallClock,
  programmeProgress,
  serverOffsetMinutes,
  type EpgProgramme,
} from "../epgTime";

const local = (s: string) => parseWallClock(s) as Date;

describe("time parsing (epg-and-catchup.md §1)", () => {
  it("parses wall-clock strings explicitly as device-local time", () => {
    const d = local("2024-09-25 20:00:00");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([
      2024, 8, 25, 20, 0,
    ]);
    expect(parseWallClock("2024-09-25 20:00")).toEqual(d);
    expect(parseWallClock("garbage")).toBeUndefined();
  });

  it("Q-behaviour-fixes #9: the offset applies to wall-clock strings only", () => {
    expect(formatYmdHm(getLocalChannelTime("2024-09-25 20:00:00", 120) as Date)).toBe(
      "2024-09-25 22:00",
    );
    const unix = 1727290800;
    expect(getLocalChannelTime(String(unix), 120)?.getTime()).toBe(unix * 1000);
    expect(getLocalChannelTime(String(unix * 1000), 120)?.getTime()).toBe(unix * 1000);
  });

  it("zoned XMLTV times are absolute", () => {
    expect(getLocalChannelTime("20240925200000 +0100", 999)?.toISOString()).toBe(
      "2024-09-25T19:00:00.000Z",
    );
  });

  it("server offset = device offset − server offset (xtream.md §8)", () => {
    const serverNow = new Date(2024, 8, 26, 12, 26, 40);
    // The server's wall clock equals the device's: offset 0.
    expect(serverOffsetMinutes("2024-09-26 12:26:40", serverNow.getTime() / 1000)).toBe(0);
    // The server's wall clock is 2 hours behind the device's: +120.
    expect(serverOffsetMinutes("2024-09-26 10:26:40", serverNow.getTime() / 1000)).toBe(120);
    expect(serverOffsetMinutes("bad", 1)).toBe(0);
  });

  it("epgClock takes HH:mm", () => {
    expect(epgClock("2024-09-25 20:05:00")).toBe("20:05");
  });
});

describe("base64 titles (§1.4)", () => {
  it("decodes UTF-8 base64 and returns non-base64 text unchanged", () => {
    expect(decodeBase64Title("UHJlbWllciBMZWFndWUgTGl2ZQ==")).toBe("Premier League Live");
    expect(decodeBase64Title("2YLZhtin2Kk=")).toBe("قناة");
    expect(decodeBase64Title("Hello World")).toBe("Hello World");
    expect(decodeBase64Title("")).toBe("");
  });
});

describe("now / next and progress (§2)", () => {
  const list: EpgProgramme[] = [
    { start: "2024-09-25 18:00", stop: "2024-09-25 19:00", title: "Past" },
    { start: "2024-09-25 19:00", stop: "2024-09-25 20:00", title: "Now" },
    { start: "2024-09-25 20:00", stop: "2024-09-25 21:00", title: "Next" },
  ];
  const now = local("2024-09-25 19:30");

  it("picks the running programme and the next one", () => {
    const result = getNextProgrammes(list, now);
    expect(result.currentExists).toBe(true);
    expect(result.current?.title).toBe("Now");
    expect(result.next?.title).toBe("Next");
  });

  it("without a running programme, next is the first upcoming", () => {
    const result = getNextProgrammes(list.slice(2), now);
    expect(result.current).toBeUndefined();
    expect(result.next?.title).toBe("Next");
  });

  it("progress is clamped to 0-100", () => {
    expect(programmeProgress(list[1] as EpgProgramme, now)).toBe(50);
    expect(programmeProgress(list[0] as EpgProgramme, now)).toBe(100);
    expect(programmeProgress({ start: "x", stop: "y", title: "" }, now)).toBe(0);
  });
});

describe("catch-up grouping (§3.3) and guide normalisation (§4)", () => {
  it("groups finished programmes by day and stops at the first unfinished one", () => {
    const days = groupFinishedByDay(
      [
        { start: "2024-09-24 23:00", stop: "2024-09-25 00:00", title: "A" },
        { start: "2024-09-25 08:00", stop: "2024-09-25 09:00", title: "B" },
        { start: "2024-09-25 19:00", stop: "2024-09-25 20:00", title: "Running" },
        { start: "2024-09-25 10:00", stop: "2024-09-25 11:00", title: "Lost" },
      ],
      local("2024-09-25 19:30"),
    );
    expect(days.map((d) => [d.date, d.programmes.map((p) => p.title)])).toEqual([
      ["2024-09-24", ["A"]],
      ["2024-09-25", ["B"]],
    ]);
  });

  it("clamps overlaps, drops empty slots and merges back-to-back repeats", () => {
    const at = (h: number, m = 0) => new Date(2024, 8, 25, h, m);
    const out = normalizeGuide([
      { start: at(20), stop: at(21), title: "News", description: "" },
      { start: at(19), stop: at(20, 30), title: "Film", description: "" },
      { start: at(21), stop: at(22), title: " news ", description: "Late" },
      { start: at(22), stop: at(22), title: "Empty", description: "" },
    ]);
    expect(
      out.map((p) => [p.title.trim(), p.start.getHours(), p.start.getMinutes(), p.stop.getHours()]),
    ).toEqual([
      ["Film", 19, 0, 20],
      ["News", 20, 30, 22],
    ]);
    expect(out[1]?.description).toBe("Late");
  });
});
