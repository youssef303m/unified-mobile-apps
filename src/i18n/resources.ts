// The bundled locale files, copied unchanged from 05-reference/locales (en.json also holds the
// new `mobile_*` keys, listed in docs/new-strings.md). Only English and Arabic for now
// (docs/decisions.md D-020); the other 16 files stay in the kit.
import type { Resource } from "i18next";

import ar from "./locales/ar.json";
import en from "./locales/en.json";

import type { LanguageCode } from "./languages";

const files: Record<LanguageCode, Record<string, string>> = { ar, en };

export const resources: Resource = Object.fromEntries(
  Object.entries(files).map(([code, translation]) => [code, { translation }]),
);
