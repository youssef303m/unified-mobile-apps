import { useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { qrPlaylistUrl } from "@/api/ibo/links";
import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { CopyRow } from "@/components/CopyRow";
import { DevNetworkSwitch } from "@/components/DevNetworkSwitch";
import { LanguageSheet, useCurrentLanguage } from "@/components/LanguageSheet";
import { ListRow } from "@/components/ListRow";
import { Screen } from "@/components/Screen";
import { config } from "@/config";
import { deviceCredentials, licenseStatusLabel } from "@/content/rules/startup";
import { openUrl } from "@/platform/links";
import * as Application from "expo-application";
import type { ProviderAccount } from "@/session/playlistLoad";
import { useSession } from "@/session/store";
import { globalKeys } from "@/storage/keys";
import { kvStore } from "@/storage/kv";

function Field({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <>
      <AppText variant="meta" color="secondary">
        {label}
      </AppText>
      <AppText variant="bodyStrong" testID={testID}>
        {value || "—"}
      </AppText>
    </>
  );
}

function providerRows(provider: ProviderAccount | undefined, unlimited: string, active: string) {
  if (provider?.type === "xtream")
    return {
      user: provider.username,
      status: provider.account.status,
      expiry: provider.account.expireDate ?? unlimited,
    };
  if (provider?.type === "stalker")
    return { user: provider.mac, status: active, expiry: provider.profile.expiry || unlimited };
  return { user: "", status: "", expiry: "" };
}

// Account (current-app-inventory.md §22, user-flows.md §15 Mobile): device, licence and playlist
// info, with the Playlists / Portals entries and the website links.
export default function AccountScreen() {
  const { t } = useTranslation();
  const macAddress = useSession((s) => s.macAddress) ?? "";
  const info = useSession((s) => s.info);
  const offline = useSession((s) => s.offline);
  const active = useSession((s) => s.active);
  const { deviceKey } = deviceCredentials(macAddress, info, kvStore.get(globalKeys.apiData));
  const status = licenseStatusLabel(info?.is_trial) === "active" ? t("msg_active") : t("msg_trial");
  const provider = providerRows(active?.provider, t("msg_unlimited"), t("msg_active"));
  const language = useCurrentLanguage();
  const [languageSheet, setLanguageSheet] = useState(false);
  return (
    <Screen title={t("account")} onBack={() => router.back()} testID="account-screen">
      {offline ? (
        <AppText variant="meta" color="warning">
          {t("mobile_offline_notice")}
        </AppText>
      ) : null}
      <Card title={t("device_info")}>
        <CopyRow label={t("mac_address")} value={macAddress.toUpperCase()} testID="account-mac" />
        <CopyRow label={t("device_key")} value={deviceKey} testID="account-device-key" />
        <Field label={t("platform")} value={t("mobile_android")} />
      </Card>
      <Card title={t("app_info")}>
        <Field label={t("status")} value={status} testID="account-status" />
        <Field
          label={t("expiration_date")}
          value={info?.expire_date ?? ""}
          testID="account-expiry"
        />
        <Field label={t("app_version")} value={Application.nativeApplicationVersion ?? ""} />
      </Card>
      {active ? (
        <Card title={t("playlist_info")}>
          <Field label={t("username")} value={provider.user} />
          <Field label={t("status")} value={provider.status} />
          <Field label={t("expiration_date")} value={provider.expiry} />
        </Card>
      ) : null}
      <ListRow
        title={t("mobile_playlists")}
        chevron
        onPress={() => router.push("/playlists")}
        testID="account-playlists"
      />
      <ListRow
        title={t("stalker_portals")}
        chevron
        onPress={() => router.push("/portals")}
        testID="account-portals"
      />
      <ListRow
        title={t("settings")}
        chevron
        onPress={() => router.push("/settings")}
        testID="account-settings"
      />
      <ListRow
        title={t("change_language")}
        subtitle={language.name}
        chevron
        onPress={() => setLanguageSheet(true)}
        testID="account-language"
      />
      <ListRow
        title={t("mobile_manage_playlists_website")}
        chevron
        onPress={() => void openUrl(qrPlaylistUrl(macAddress, "xc"))}
      />
      <ListRow
        title={t("mobile_activate_license")}
        chevron
        onPress={() => void openUrl(config.app.websiteUrl)}
      />
      <ListRow
        title={t("mobile_about")}
        chevron
        onPress={() => router.push("/about")}
        testID="account-about"
      />
      <DevNetworkSwitch />
      {__DEV__ ? (
        <ListRow
          title={t("mobile_dev_gallery")}
          chevron
          onPress={() => router.push("/gallery")}
          testID="account-gallery"
        />
      ) : null}
      <LanguageSheet visible={languageSheet} onClose={() => setLanguageSheet(false)} />
    </Screen>
  );
}
