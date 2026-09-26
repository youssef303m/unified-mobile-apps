import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { qrPlaylistUrl } from "@/api/ibo/links";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import type { XtreamForm } from "@/content/rules/playlists";
import { openUrl } from "@/platform/links";
import { manageDeps, setPlaylists } from "@/session/boot";
import { addXtreamPlaylist } from "@/session/playlists";
import { session, useSession } from "@/session/store";

const REQUIRED = {
  name: "mobile_playlist_name_required",
  url: "mobile_playlist_url_required",
  username: "mobile_username_required",
  password: "mobile_password_required",
} as const;

// Add a new playlist (current-app-inventory.md §7): Xtream only in the app (R-036); M3U lists are
// added on the website. Back while saving cancels, and nothing is stored.
export default function AddPlaylistScreen() {
  const { t } = useTranslation();
  const macAddress = useSession((s) => s.macAddress) ?? "";
  const [form, setForm] = useState<XtreamForm>({ name: "", url: "", username: "", password: "" });
  const [error, setError] = useState<{ field?: keyof XtreamForm; text: string } | undefined>();
  const [saving, setSaving] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => controller.current?.abort(), []);

  const field = (key: keyof XtreamForm) => ({
    value: form[key],
    onChangeText: (value: string) => setForm((f) => ({ ...f, [key]: value })),
    error: error?.field === key ? error.text : undefined,
  });

  const save = () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setSaving(true);
    setError(undefined);
    void addXtreamPlaylist(manageDeps(), form, current.signal).then((result) => {
      if (current.signal.aborted) return;
      setSaving(false);
      if (result.kind === "invalid" && result.field in REQUIRED) {
        const key = result.field as keyof XtreamForm;
        setError({ field: key, text: t(REQUIRED[key]) });
      } else if (result.kind === "not_working") {
        setError({ text: t("mobile_playlist_not_working") });
      } else if (result.kind === "saved") {
        setPlaylists([...session.get().playlists, result.playlist]);
        router.back();
      }
    });
  };

  return (
    <Screen title={t("add_new_playlist")} onBack={() => router.back()} testID="add-playlist-screen">
      <TextField
        label={t("playlist_name")}
        maxLength={64}
        testID="add-playlist-name"
        {...field("name")}
      />
      <TextField
        label={t("playlist_url")}
        placeholder="http://example.com:port"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={512}
        testID="add-playlist-url"
        {...field("url")}
      />
      <TextField
        label={t("user_name")}
        autoCapitalize="none"
        autoCorrect={false}
        testID="add-playlist-username"
        {...field("username")}
      />
      <TextField
        label={t("password")}
        secret
        testID="add-playlist-password"
        {...field("password")}
      />
      {error && !error.field ? (
        <AppText color="danger" accessibilityLiveRegion="polite" testID="add-playlist-error">
          {error.text}
        </AppText>
      ) : null}
      <Button
        label={t("save_upper")}
        variant="brand"
        loading={saving}
        onPress={save}
        testID="add-playlist-save"
      />
      <AppText color="tertiary" style={{ textAlign: "center" }}>
        {t("or_upper")}
      </AppText>
      <Button
        label={t("mobile_add_on_website")}
        variant="secondary"
        onPress={() => void openUrl(qrPlaylistUrl(macAddress, "xc"))}
      />
    </Screen>
  );
}
