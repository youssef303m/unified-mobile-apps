import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const dir = join(__dirname, "..", "locales");
const load = (code: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(dir, `${code}.json`), "utf8")) as Record<string, unknown>;

describe("locale files", () => {
  const en = load("en");
  const codes = readdirSync(dir).map((f) => f.replace(".json", ""));

  it("are flat maps of strings", () => {
    for (const code of codes) {
      for (const value of Object.values(load(code))) expect(typeof value).toBe("string");
    }
  });

  it("keep the TV master list in en.json: 470 TV keys plus mobile_* keys", () => {
    const tvKeys = Object.keys(en).filter((k) => !k.startsWith("mobile_"));
    expect(tvKeys).toHaveLength(470);
  });

  it("add mobile_* keys to en.json only", () => {
    for (const code of codes.filter((c) => c !== "en")) {
      expect(Object.keys(load(code)).some((k) => k.startsWith("mobile_"))).toBe(false);
    }
  });

  it("have no key that is missing from en.json", () => {
    for (const code of codes) {
      for (const key of Object.keys(load(code))) expect(en).toHaveProperty([key]);
    }
  });
});
