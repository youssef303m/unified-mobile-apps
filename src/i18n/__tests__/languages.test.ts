import { readdirSync } from "fs";
import { join } from "path";

import { LANGUAGES, isRtlLanguage, isSupportedLanguage, resolveLanguage } from "../languages";

describe("languages", () => {
  it("lists one language per bundled locale file (English and Arabic)", () => {
    const files = readdirSync(join(__dirname, "..", "locales"))
      .map((f) => f.replace(".json", ""))
      .sort();
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(files);
    expect(LANGUAGES).toHaveLength(2);
  });

  it("marks Arabic as right-to-left, and only Arabic", () => {
    const rtl = LANGUAGES.filter((l) => isRtlLanguage(l.code)).map((l) => l.code);
    expect(rtl).toEqual(["ar"]);
  });

  it("rejects unknown codes", () => {
    expect(isSupportedLanguage("xx")).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
    expect(isSupportedLanguage("fr")).toBe(false);
    expect(isSupportedLanguage("ar")).toBe(true);
  });
});

describe("resolveLanguage", () => {
  it("prefers a valid saved language over the device language", () => {
    expect(resolveLanguage("ar", "en")).toBe("ar");
  });

  it("uses the device language when nothing valid is saved", () => {
    expect(resolveLanguage(undefined, "ar")).toBe("ar");
    expect(resolveLanguage("zz", "en")).toBe("en");
  });

  it("falls back to English when the device language has no file", () => {
    expect(resolveLanguage(undefined, "fr")).toBe("en");
    expect(resolveLanguage(undefined, null)).toBe("en");
  });
});
