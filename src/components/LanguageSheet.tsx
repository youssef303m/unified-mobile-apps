import { useTranslation } from "react-i18next";

import { changeLanguage, LANGUAGES, type LanguageCode } from "@/i18n";
import { resolveLanguage } from "@/i18n/languages";
import { getString, KEYS } from "@/storage/kv";

import { OptionSheet } from "./OptionSheet";

/** The language currently in use (the saved one, else the one i18next resolved). */
export function useCurrentLanguage(): { code: LanguageCode; name: string } {
  const { i18n } = useTranslation();
  const code = resolveLanguage(getString(KEYS.language), i18n.language);
  return { code, name: LANGUAGES.find((l) => l.code === code)?.name ?? code };
}

// Settings → Change Language (settings.md §2.2, R-121): applies at once; switching between a
// left-to-right and a right-to-left language reloads the app.
export function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const current = useCurrentLanguage();
  return (
    <OptionSheet
      visible={visible}
      onClose={onClose}
      title={t("change_language")}
      description={t("change_language_desc")}
      options={LANGUAGES.map((l) => ({ key: l.code, label: l.name }))}
      value={current.code}
      onChange={(code) => void changeLanguage(code)}
      testID="language-sheet"
    />
  );
}
