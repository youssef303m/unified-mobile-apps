// The app languages. The TV app has 18 (01-product/settings.md §2.2); the owner narrowed the
// phone app to English and Arabic for now (docs/decisions.md D-020). Add a language by copying
// its file from 05-reference/locales and adding it here.

export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ar", name: "العربية" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

const RTL_LANGUAGES: readonly LanguageCode[] = ["ar"];

export function isSupportedLanguage(code: string | null | undefined): code is LanguageCode {
  return LANGUAGES.some((l) => l.code === code);
}

export function isRtlLanguage(code: LanguageCode): boolean {
  return RTL_LANGUAGES.includes(code);
}

// The saved language if valid, else the device language if the app has it, else English.
// The device language is the first part of its primary locale (`fr-FR` → `fr`), as on TV.
export function resolveLanguage(
  saved: string | undefined,
  deviceLanguageCode: string | null | undefined,
): LanguageCode {
  if (isSupportedLanguage(saved)) return saved;
  if (isSupportedLanguage(deviceLanguageCode)) return deviceLanguageCode;
  return DEFAULT_LANGUAGE;
}
