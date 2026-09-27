import { useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { Screen } from "@/components/Screen";
import { SubtitleStyleEditor } from "@/player/controls/SubtitleStyleEditor";
import { readSubtitleStyle, saveSubtitleStyle, type SubtitleStyle } from "@/player/playerSettings";
import { kvStore } from "@/storage/kv";

// Settings → Subtitle Settings (settings.md §2.9): the same saved style as the player's subtitle
// menu, applied instantly.
export default function SubtitleSettingsScreen() {
  const { t } = useTranslation();
  const [style, setStyle] = useState<SubtitleStyle>(() => readSubtitleStyle(kvStore));
  const change = (next: SubtitleStyle) => {
    saveSubtitleStyle(kvStore, next);
    setStyle(readSubtitleStyle(kvStore));
  };
  return (
    <Screen title={t("subtitle_settings")} onBack={() => router.back()} testID="subtitle-settings">
      <AppText color="secondary">{t("subtitle_settings_desc")}</AppText>
      <SubtitleStyleEditor style={style} onStyle={change} />
    </Screen>
  );
}
