// The phone's Arabic (D-077): every English string has an Arabic one, with the same
// placeholders, and the phone file only adds what the TV file lacks.
import ar from "../locales/ar.json";
import en from "../locales/en.json";
import arPhone from "../phone/ar.json";

// Only the phone keys use i18next plurals; a TV key may end in "_one" by chance.
const PLURAL = /^mobile_.*_(zero|one|two|few|many|other)$/;
const ARABIC_FORMS = ["zero", "one", "two", "few", "many", "other"];
const placeholders = (text: string) =>
  [...text.matchAll(/\{\{(\w+)\}\}/g)]
    .map((m) => m[1])
    .filter((p) => p !== "count")
    .sort();

const english = en as Record<string, string>;
const merged: Record<string, string> = { ...ar, ...arPhone };

describe("Arabic", () => {
  it("has every English key; plural keys have all six Arabic forms", () => {
    const missing: string[] = [];
    for (const key of Object.keys(english)) {
      if (PLURAL.test(key)) {
        const base = key.replace(/_(zero|one|two|few|many|other)$/, "");
        for (const form of ARABIC_FORMS)
          if (!(`${base}_${form}` in merged)) missing.push(`${base}_${form}`);
      } else if (!(key in merged)) missing.push(key);
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  it("keeps the English placeholders", () => {
    for (const [key, value] of Object.entries(arPhone as Record<string, string>)) {
      const source =
        english[key] ?? english[key.replace(/_(zero|one|two|few|many|other)$/, "_other")] ?? "";
      expect([key, placeholders(value)]).toEqual([key, placeholders(source)]);
    }
  });

  it("only adds keys the TV file lacks, and only keys English has", () => {
    for (const key of Object.keys(arPhone)) {
      expect([key, key in ar]).toEqual([key, false]);
      const base = key.replace(/_(zero|one|two|few|many|other)$/, "");
      expect([key, key in english || `${base}_other` in english]).toEqual([key, true]);
    }
  });
});
