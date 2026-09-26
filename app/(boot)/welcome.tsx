import { useTranslation } from "react-i18next";

import { qrPlaylistUrl } from "@/api/ibo/links";
import { ActivationCard } from "@/components/ActivationCard";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { Screen } from "@/components/Screen";
import { deviceCredentials } from "@/content/rules/startup";
import { openUrl } from "@/platform/links";
import { useSession } from "@/session/store";
import { globalKeys } from "@/storage/keys";
import { kvStore } from "@/storage/kv";
import { resetTo } from "@/utils/navigation";

// Welcome / trial (R-007, screens.md): trial days, the "Add your playlist" card, Open website
// (this device's playlist page) and Continue (loads the playlists the backend returned).
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const macAddress = useSession((s) => s.macAddress) ?? "";
  const info = useSession((s) => s.info);
  const { deviceKey } = deviceCredentials(macAddress, info, kvStore.get(globalKeys.apiData));
  return (
    <Screen testID="welcome-screen">
      <Logo />
      <AppText variant="h2" accessibilityRole="header">
        {t("login_tagline")}
      </AppText>
      <AppText color="secondary">{t("login_description")}</AppText>
      <AppText variant="bodyStrong" color="warning" testID="trial-days">
        {t("mobile_trial_days_left", { count: info?.trial_days ?? 0 })}
      </AppText>
      <AppText color="secondary">{t("trial_thank_you")}</AppText>
      <AppText color="secondary">{t("continue_demo_note")}</AppText>
      <ActivationCard macAddress={macAddress} deviceKey={deviceKey} />
      <Button
        label={t("mobile_open_website")}
        variant="secondary"
        onPress={() => void openUrl(qrPlaylistUrl(macAddress, "xc"))}
      />
      <Button
        label={t("login")}
        variant="brand"
        onPress={() => resetTo("/loading")}
        testID="welcome-continue"
      />
    </Screen>
  );
}
