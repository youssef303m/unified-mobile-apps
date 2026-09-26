import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { DevNetworkSwitch } from "@/components/DevNetworkSwitch";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { config } from "@/config";
import { openUrl } from "@/platform/links";
import { retryWithServer } from "@/session/boot";
import { goToBootRoute } from "@/utils/navigation";

// Server URLs failed (R-004, overview.md §4.4): a custom server domain and Try again.
export default function ServerFailedScreen() {
  const { t } = useTranslation();
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const retry = () => {
    setBusy(true);
    retryWithServer(domain)
      .catch(() => "server_failed" as const)
      .then((route) => {
        setBusy(false);
        goToBootRoute(route);
      });
  };
  return (
    <Screen title={t("server_urls_failed")} testID="server-failed-screen">
      <AppText color="secondary">
        {t("urls_failed_desc")} {config.app.websiteUrl.replace(/^https?:\/\//, "")}
      </AppText>
      <TextField
        label={t("mobile_server_domain")}
        value={domain}
        onChangeText={setDomain}
        placeholder="example.com"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={retry}
      />
      <Button
        label={t("try_again")}
        variant="brand"
        loading={busy}
        onPress={retry}
        testID="server-retry"
      />
      <Button
        label={t("mobile_contact_support")}
        variant="secondary"
        onPress={() => void openUrl(config.app.websiteUrl)}
      />
      <DevNetworkSwitch />
    </Screen>
  );
}
