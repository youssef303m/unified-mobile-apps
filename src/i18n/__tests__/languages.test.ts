import { readdirSync } from "fs";
import { join } from "path";

import { LANGUAGES, isRtlLanguage, isSupportedLanguage, resolveLanguage } from "../languages";

describe("languages", () => {
  it("lists the 18 TV languages, one per bundled locale file", () => {
    const files = readdirSync(join(__dirname, "..", "locales"))
      .map((f) => f.replace(".json", ""))
      .sort();
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(files);
    expect(LANGUAGES).toHaveLength(18);
  });

  it("marks ar, fa and ur as right-to-left, and only those", () => {
    const rtl = LANGUAGES.filter((l) => isRtlLanguage(l.code)).map((l) => l.code);
    expect(rtl.sort()).toEqual(["ar", "fa", "ur"]);
  });

  it("rejects unknown codes", () => {
    expect(isSupportedLanguage("xx")).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
    expect(isSupportedLanguage("fr")).toBe(true);
  });
});

describe("resolveLanguage", () => {
  it("prefers a valid saved language over the device language", () => {
    expect(resolveLanguage("de", "fr")).toBe("de");
  });

  it("uses the device language when nothing valid is saved", () => {
    expect(resolveLanguage(undefined, "ar")).toBe("ar");
    expect(resolveLanguage("zz", "tr")).toBe("tr");
  });

  it("falls back to English when the device language has no file", () => {
    expect(resolveLanguage(undefined, "ja")).toBe("en");
    expect(resolveLanguage(undefined, null)).toBe("en");
  });
});
