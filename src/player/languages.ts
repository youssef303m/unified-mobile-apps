// Language names for audio and subtitle tracks (01-product/player.md §5.1: codes mapped to names;
// the TV's `language_codes` table is not in the kit, so the device's Intl data is used, with a
// small table of the codes IPTV streams carry as the fallback).

const NAMES: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  tr: "Turkish",
  ru: "Russian",
  nl: "Dutch",
  pl: "Polish",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
  nb: "Norwegian",
  fi: "Finnish",
  el: "Greek",
  he: "Hebrew",
  hi: "Hindi",
  ur: "Urdu",
  fa: "Persian",
  ku: "Kurdish",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ro: "Romanian",
  hu: "Hungarian",
  cs: "Czech",
  bg: "Bulgarian",
  sr: "Serbian",
  hr: "Croatian",
  sq: "Albanian",
  uk: "Ukrainian",
};

/** ISO 639-2 codes (what MKV and TS streams usually carry) → ISO 639-1. */
const THREE_TO_TWO: Record<string, string> = {
  eng: "en",
  ara: "ar",
  fre: "fr",
  fra: "fr",
  ger: "de",
  deu: "de",
  spa: "es",
  ita: "it",
  por: "pt",
  tur: "tr",
  rus: "ru",
  dut: "nl",
  nld: "nl",
  pol: "pl",
  swe: "sv",
  dan: "da",
  nor: "no",
  nob: "nb",
  fin: "fi",
  gre: "el",
  ell: "el",
  heb: "he",
  hin: "hi",
  urd: "ur",
  per: "fa",
  fas: "fa",
  kur: "ku",
  jpn: "ja",
  kor: "ko",
  chi: "zh",
  zho: "zh",
  rum: "ro",
  ron: "ro",
  hun: "hu",
  cze: "cs",
  ces: "cs",
  bul: "bg",
  srp: "sr",
  hrv: "hr",
  alb: "sq",
  sqi: "sq",
  ukr: "uk",
};

/** "eng", "en-US", "EN" → "en"; "und" and empty → undefined. */
export function languageCode(value: string | undefined): string | undefined {
  const code = (value ?? "").trim().toLowerCase().split(/[-_]/)[0] ?? "";
  if (!code || code === "und" || code === "unknown") return undefined;
  return THREE_TO_TWO[code] ?? code;
}

function intlName(code: string, uiLanguage: string): string | undefined {
  try {
    const names = new Intl.DisplayNames([uiLanguage], { type: "language" });
    const name = names.of(code);
    return name && name.toLowerCase() !== code ? name : undefined;
  } catch {
    return undefined;
  }
}

/** A display name for a language code; the code itself when nothing is known. */
export function languageName(value: string | undefined, uiLanguage = "en"): string | undefined {
  const code = languageCode(value);
  if (!code) return undefined;
  return intlName(code, uiLanguage) ?? NAMES[code] ?? code.toUpperCase();
}
