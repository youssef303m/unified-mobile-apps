import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ActivationCard } from "@/components/ActivationCard";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { Screen } from "@/components/Screen";
import { showToast } from "@/components/Toast";
import { config } from "@/config";
import { deviceCredentials } from "@/content/rules/startup";
import { openUrl } from "@/platform/links";
import { checkAgain } from "@/session/boot";
import { useSession } from "@/session/store";
import { globalKeys } from "@/storage/keys";
import { kvStore } from "@/storage/kv";
import { goToBootRoute } from "@/utils/navigation";

// Expired (R-006, screens.md): blocked. Open website to activate, Check again, and no Continue.
export default function ExpiredScreen() {
  const { t } = useTranslation();
  const macAddress = useSession((s) => s.macAddress) ?? "";
  const info = useSession((s) => s.info);
  const [checking, setChecking] = useState(false);
  const { deviceKey } = deviceCredentials(macAddress, info, kvStore.get(globalKeys.apiData));
  return (
    <Screen testID="expired-screen">
      <Logo />
      <AppText variant="h2" color="danger" accessibilityRole="header">
        {t("msg_notice_trial_period_expired")}
      </AppText>
      <AppText color="secondary">{t("msg_your_trial_period_has_ended_to_continue")}</AppText>
      <ActivationCard macAddress={macAddress} deviceKey={deviceKey} />
      <AppText color="secondary">{t("msg_activate_your_device_and_subscribe_with_a")}</AppText>
      <Button
        label={t("mobile_open_website_activate")}
        variant="secondary"
        onPress={() => void openUrl(config.app.websiteUrl)}
      />
      <Button
        label={t("mobile_check_again")}
        variant="brand"
        loading={checking}
        testID="expired-check-again"
        onPress={() => {
          setChecking(true);
          checkAgain()
            .catch(() => "failed" as const)
            .then((route) => {
              setChecking(false);
              // The check always answers: still expired, or no server reached.
              if (route === "failed") showToast({ text: t("mobile_verify_network_error") });
              else if (route === "expired") showToast({ text: t("mobile_still_expired") });
              else goToBootRoute(route);
            });
        }}
      />
      <AppText variant="meta" color="tertiary">
        {t("msg_thank_you_for_choosing_our_app_if")}
      </AppText>
    </Screen>
  );
}
