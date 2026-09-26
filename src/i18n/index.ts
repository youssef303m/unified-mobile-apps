// i18next setup (05-reference/translations.md): flat keys containing dots and dashes,
// English fallback for the keys missing from the other 17 files.
import i18next from "i18next";
import { reloadAppAsync } from "expo";
import { getLocales } from "expo-localization";
import { initReactI18next } from "react-i18next";

import { getString, remove, setString, KEYS } from "@/storage/kv";

import { syncLayoutDirection } from "./direction";
import { DEFAULT_LANGUAGE, resolveLanguage, type LanguageCode } from "./languages";
import { resources } from "./resources";

export { LANGUAGES, isRtlLanguage, type LanguageCode } from "./languages";

export const i18n = i18next;

function deviceLanguageCode(): string | null {
  return getLocales()[0]?.languageCode ?? null;
}

// Initialises i18next with the saved or device language. Returns true when the layout
// direction had to change, in which case the caller reloads the app before rendering.
export function initI18n(): { language: LanguageCode; needsReload: boolean } {
  const language = resolveLanguage(getString(KEYS.language), deviceLanguageCode());
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: DEFAULT_LANGUAGE,
      returnEmptyString: false,
      keySeparator: false,
      nsSeparator: false,
      interpolation: { escapeValue: false },
      initAsync: false,
    });
  }
  return { language, needsReload: needsDirectionReload(language) };
}

// Reloads at most once per language, so a direction the platform refuses cannot loop.
function needsDirectionReload(language: LanguageCode): boolean {
  if (!syncLayoutDirection(language)) {
    remove(KEYS.directionReload);
    return false;
  }
  if (getString(KEYS.directionReload) === language) return false;
  setString(KEYS.directionReload, language);
  return true;
}

// Settings → Language. Persists under the TV key, re-translates, and reloads when switching
// to or from a right-to-left language.
export async function changeLanguage(language: LanguageCode): Promise<void> {
  setString(KEYS.language, language);
  await i18n.changeLanguage(language);
  if (syncLayoutDirection(language)) {
    await reloadAppAsync("Layout direction changed");
  }
}
