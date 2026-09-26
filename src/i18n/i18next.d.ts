// Typed translation keys: `t()` only accepts keys that exist in en.json.
import "i18next";

import type en from "./locales/en.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    keySeparator: false;
    nsSeparator: false;
    resources: { translation: typeof en };
  }
}
