// The bundled locale files, copied unchanged from 05-reference/locales (en.json also holds the
// new `mobile_*` keys, listed in docs/new-strings.md).
import type { Resource } from "i18next";

import ar from "./locales/ar.json";
import da from "./locales/da.json";
import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fa from "./locales/fa.json";
import fi from "./locales/fi.json";
import fr from "./locales/fr.json";
import hi from "./locales/hi.json";
import it from "./locales/it.json";
import nl from "./locales/nl.json";
import no from "./locales/no.json";
import pl from "./locales/pl.json";
import pt from "./locales/pt.json";
import ru from "./locales/ru.json";
import sv from "./locales/sv.json";
import tr from "./locales/tr.json";
import ur from "./locales/ur.json";

import type { LanguageCode } from "./languages";

const files: Record<LanguageCode, Record<string, string>> = {
  ar,
  da,
  de,
  en,
  es,
  fa,
  fi,
  fr,
  hi,
  it,
  nl,
  no,
  pl,
  pt,
  ru,
  sv,
  tr,
  ur,
};

export const resources: Resource = Object.fromEntries(
  Object.entries(files).map(([code, translation]) => [code, { translation }]),
);
