// The locale files (D-077): flat maps of strings, Arabic as complete as English (with all six
// Arabic plural forms), the same placeholders, and no key the app does not use.
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

import ar from "../locales/ar.json";
import en from "../locales/en.json";

const english = en as Record<string, string>;
const arabic = ar as Record<string, string>;

const PLURAL = /_(zero|one|two|few|many|other)$/;
const ENGLISH_FORMS = ["one", "other"];
const ARABIC_FORMS = ["zero", "one", "two", "few", "many", "other"];
const isPlural = (key: string) => PLURAL.test(key) && `${key.replace(PLURAL, "")}_other` in english;
const base = (key: string) => (isPlural(key) ? key.replace(PLURAL, "") : key);

const placeholders = (text: string) =>
  [...text.matchAll(/\{\{(\w+)\}\}/g)]
    .map((m) => m[1])
    .filter((p) => p !== "count")
    .sort();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "locales" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("locale files", () => {
  it("are flat maps of strings", () => {
    for (const file of [english, arabic])
      for (const value of Object.values(file)) expect(typeof value).toBe("string");
  });

  it("Arabic has every English key; plural keys have all six Arabic forms", () => {
    const expected = new Set(
      Object.keys(english).flatMap((key) =>
        isPlural(key) ? ARABIC_FORMS.map((f) => `${base(key)}_${f}`) : [key],
      ),
    );
    expect([...expected].filter((k) => !(k in arabic))).toEqual([]);
    expect(Object.keys(arabic).filter((k) => !expected.has(k))).toEqual([]);
  });

  it("English plural keys come in pairs", () => {
    for (const key of Object.keys(english).filter(isPlural))
      for (const form of ENGLISH_FORMS) expect(english).toHaveProperty([`${base(key)}_${form}`]);
  });

  it("Arabic keeps the English placeholders", () => {
    for (const [key, value] of Object.entries(arabic)) {
      const source = english[key] ?? english[`${base(key)}_other`] ?? "";
      expect([key, placeholders(value)]).toEqual([key, placeholders(source)]);
    }
  });

  it("has no key the app does not use", () => {
    const root = join(__dirname, "..", "..", "..");
    const code = [...sourceFiles(join(root, "src")), ...sourceFiles(join(root, "app"))]
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    // Keys built in code, like t(`mobile_color_${name}`).
    const prefixes = [...code.matchAll(/t\(\s*`([\w-]+)\$\{/g)].map((m) => m[1] ?? "");
    const used = (key: string) =>
      new RegExp(`["'\`]${base(key).replace(/[-.]/g, "\$&")}["'\`]`).test(code) ||
      prefixes.some((p) => p && key.startsWith(p));
    expect(Object.keys(english).filter((key) => !used(key))).toEqual([]);
  });
});
