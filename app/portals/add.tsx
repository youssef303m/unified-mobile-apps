import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { virtualStalkerMac, type StalkerMacPrefix } from "@/content/rules/playlists";
import { manageDeps, setPlaylists } from "@/session/boot";
import { addPortal, type PortalForm } from "@/session/playlists";
import { session } from "@/session/store";
import { kvStore } from "@/storage/kv";
import { spacing } from "@/theme/tokens";

const PREFIXES: readonly StalkerMacPrefix[] = ["00:1A:79", "00:1C:1D"];

const FIELD_ERRORS = {
  name: "msg_portal_name_is_required",
  url: "msg_portal_url_is_required",
  mac: "msg_mac_address_is_required_please_wait_for",
  mac_format: "msg_invalid_mac_address_format_expected_xx_xx",
} as const;

// Add Portal (current-app-inventory.md §9): tested (primary, then fallback) before it is saved.
export default function AddPortalScreen() {
  const { t } = useTranslation();
  const [prefix, setPrefix] = useState<StalkerMacPrefix>("00:1A:79");
  const [form, setForm] = useState<PortalForm>(() => ({
    name: "",
    url: "",
    fallbackUrl: "",
    mac: virtualStalkerMac(kvStore, "00:1A:79"),
  }));
  const [error, setError] = useState<{ field?: keyof PortalForm; text: string } | undefined>();
  const [saving, setSaving] = useState(false);

  const field = (key: keyof PortalForm) => ({
    value: form[key],
    onChangeText: (value: string) => setForm((f) => ({ ...f, [key]: value })),
    error: error?.field === key ? error.text : undefined,
  });

  const choosePrefix = (next: StalkerMacPrefix) => {
    setPrefix(next);
    // Switching rewrites the prefix and keeps the device part.
    setForm((f) => ({ ...f, mac: `${next}:${f.mac.split(":").slice(3).join(":")}` }));
  };

  const save = () => {
    setSaving(true);
    setError(undefined);
    void addPortal(manageDeps(), form).then((result) => {
      setSaving(false);
      if (result.kind === "invalid") {
        const key = result.field === "mac_format" ? "mac" : (result.field as keyof PortalForm);
        const text = t(
          result.field in FIELD_ERRORS
            ? FIELD_ERRORS[result.field as keyof typeof FIELD_ERRORS]
            : "msg_please_fill_all_fields",
        );
        setError({ field: key, text });
      } else if (result.kind === "not_working") {
        setError({
          text:
            result.message ||
            t(
              form.fallbackUrl.trim()
                ? "mobile_portal_failed_both"
                : "msg_portal_connection_failed",
            ),
        });
      } else {
        setPlaylists([...session.get().playlists, result.playlist]);
        router.back();
      }
    });
  };

  return (
    <Screen title={t("add_portal")} onBack={() => router.back()} testID="add-portal-screen">
      <AppText color="secondary">{t("portal_subtitle")}</AppText>
      <TextField
        label={t("portal_name")}
        placeholder="My Portal"
        testID="portal-name"
        {...field("name")}
      />
      <TextField
        label={t("primary_url")}
        placeholder="http://yourportal.com:8080"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        testID="portal-url"
        {...field("url")}
      />
      <TextField
        label={`${t("fallback_url")} ${t("optional")}`}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        {...field("fallbackUrl")}
      />
      <TextField
        label={t("mac_address")}
        autoCapitalize="characters"
        autoCorrect={false}
        testID="portal-mac"
        {...field("mac")}
      />
      <AppText variant="meta" color="secondary">
        {t("mac_prefix")}
      </AppText>
      <View style={styles.prefixes}>
        {PREFIXES.map((p) => (
          <View key={p} style={styles.prefix}>
            <Button
              label={p}
              variant={prefix === p ? "primary" : "secondary"}
              onPress={() => choosePrefix(p)}
            />
          </View>
        ))}
      </View>
      {error && !error.field ? (
        <AppText color="danger" accessibilityLiveRegion="polite" testID="add-portal-error">
          {error.text}
        </AppText>
      ) : null}
      <Button
        label={t("save_portal")}
        variant="brand"
        loading={saving}
        onPress={save}
        testID="portal-save"
      />
      <Button label={t("cancel")} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  prefixes: { flexDirection: "row", gap: spacing.sm },
  prefix: { flex: 1 },
});
