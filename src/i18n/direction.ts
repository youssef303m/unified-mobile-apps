// Layout direction for the active language. React Native only applies a direction change after
// a reload, so callers reload when `syncLayoutDirection` returns true.
import { I18nManager } from "react-native";

import { isRtlLanguage, type LanguageCode } from "./languages";

// Sets the persisted native RTL flags for `language`. `allowRTL(false)` stops an RTL device
// locale from mirroring an LTR app language. Returns whether a reload is needed.
export function syncLayoutDirection(language: LanguageCode): boolean {
  const rtl = isRtlLanguage(language);
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return I18nManager.isRTL !== rtl;
}
