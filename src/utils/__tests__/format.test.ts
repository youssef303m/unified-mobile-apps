// Style A titles (docs/decisions.md D-085): a trailing "(2021)" moves to the year line.
import { titleAndYear } from "../format";

describe("titleAndYear", () => {
  it("splits a trailing year in brackets", () => {
    expect(titleAndYear("Fixture Movie 2 (2021)")).toEqual({
      title: "Fixture Movie 2",
      year: "2021",
    });
    expect(titleAndYear("EN - Dune  (2024) ")).toEqual({ title: "EN - Dune", year: "2024" });
  });

  it("keeps any other title as it is", () => {
    expect(titleAndYear("Blade Runner 2049")).toEqual({ title: "Blade Runner 2049" });
    expect(titleAndYear("(2021)")).toEqual({ title: "(2021)" });
    expect(titleAndYear("Show (2021) S01")).toEqual({ title: "Show (2021) S01" });
  });
});
