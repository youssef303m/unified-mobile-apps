// The TV app's 18 languages (01-product/settings.md §2.2, 05-reference/translations.md).

export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ar", name: "العربية" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "tr", name: "Türkçe" },
  { code: "it", name: "Italiano" },
  { code: "pt", name: "Português" },
  { code: "nl", name: "Nederlands" },
  { code: "ru", name: "Русский" },
  { code: "pl", name: "Polski" },
  { code: "sv", name: "Svenska" },
  { code: "da", name: "Dansk" },
  { code: "no", name: "Norsk" },
  { code: "fi", name: "Suomi" },
  { code: "ur", name: "اردو" },
  { code: "hi", name: "हिन्दी" },
  { code: "fa", name: "فارسی" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

const RTL_LANGUAGES: readonly LanguageCode[] = ["ar", "fa", "ur"];

export function isSupportedLanguage(code: string | null | undefined): code is LanguageCode {
  return LANGUAGES.some((l) => l.code === code);
}

export function isRtlLanguage(code: LanguageCode): boolean {
  return RTL_LANGUAGES.includes(code);
}

// The saved language if valid, else the device language if it is one of the 18, else English.
// The device language is the first part of its primary locale (`fr-FR` → `fr`), as on TV.
export function resolveLanguage(
  saved: string | undefined,
  deviceLanguageCode: string | null | undefined,
): LanguageCode {
  if (isSupportedLanguage(saved)) return saved;
  if (isSupportedLanguage(deviceLanguageCode)) return deviceLanguageCode;
  return DEFAULT_LANGUAGE;
}
