// The app's strings: English and Arabic (docs/decisions.md D-020), each file complete (D-077).
import type { Resource } from "i18next";

import ar from "./locales/ar.json";
import en from "./locales/en.json";

import type { LanguageCode } from "./languages";

const files: Record<LanguageCode, Record<string, string>> = { ar, en };

export const resources: Resource = Object.fromEntries(
  Object.entries(files).map(([code, translation]) => [code, { translation }]),
);
