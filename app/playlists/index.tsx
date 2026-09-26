import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { qrPlaylistUrl } from "@/api/ibo/links";
import type { Playlist } from "@/api/ibo/types";
import { ActivationCard } from "@/components/ActivationCard";
import { AppText } from "@/components/AppText";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ListRow } from "@/components/ListRow";
import { PlaylistRow, useExpiryText } from "@/components/PlaylistRow";
import { Screen } from "@/components/Screen";
import { showToast } from "@/components/Toast";
import { splitPlaylists } from "@/content/rules/playlists";
import { deviceCredentials } from "@/content/rules/startup";
import { loadErrorKey } from "@/i18n/loadErrors";
import { openUrl } from "@/platform/links";
import { manageDeps, setPlaylists } from "@/session/boot";
import { removePlaylist } from "@/session/playlists";
import { session, useSession } from "@/session/store";
import { globalKeys } from "@/storage/keys";
import { kvStore } from "@/storage/kv";
import { readSettings } from "@/storage/settings";
import { colors, layout, radius, spacing } from "@/theme/tokens";
import { resetTo } from "@/utils/navigation";
import { playlistTitle, switchPlaylist } from "@/utils/playlists";

// Playlists ("Choose Your Playlist", current-app-inventory.md §6, user-flows.md §2 Mobile).
export default function PlaylistsScreen() {
  const { t } = useTranslation();
  const all = useSession((s) => s.playlists);
  const active = useSession((s) => s.active);
  const failure = useSession((s) => s.failure);
  const startupChooser = useSession((s) => s.startupChooser);
  const macAddress = useSession((s) => s.macAddress) ?? "";
  const info = useSession((s) => s.info);
  const expiry = useExpiryText();
  const [settings, setSettings] = useState(() => readSettings(kvStore));
  const { playlists } = splitPlaylists(all);
  const { deviceKey } = deviceCredentials(macAddress, info, kvStore.get(globalKeys.apiData));
  // Opened at startup or after a failed load there is no working Home: Back leaves the app.
  const canGoHome = active !== undefined && !startupChooser && router.canGoBack();
  const banner = failure?.screen === "playlists" ? failure : undefined;

  const saveSetting = (key: string, value: string) => {
    kvStore.set(key, value);
    setSettings(readSettings(kvStore));
  };

  const open = (p: Playlist) => {
    if (active?.playlist.id === p.id && canGoHome) return router.back();
    switchPlaylist(
      p,
      active
        ? {
            title: t("mobile_switch_playlist_title"),
            body: t("mobile_switch_playlist_body", { name: playlistTitle(p) }),
            cancel: t("cancel"),
            ok: t("ok"),
          }
        : undefined,
    );
  };

  const confirmDelete = (p: Playlist) => {
    Alert.alert(t("mobile_delete_playlist_title"), playlistTitle(p), [
      { text: t("no"), style: "cancel" },
      {
        text: t("yes"),
        style: "destructive",
        onPress: () => {
          void removePlaylist(manageDeps(), all, playlists, p).then((result) => {
            if (result.kind === "last_one")
              showToast({ title: t("sorry"), text: t("msg_you_need_to_have_1_playlist_at") });
            else if (result.kind === "failed")
              showToast({ title: t("error"), text: t("msg_failed_to_delete_playlist") });
            else {
              setPlaylists(result.playlists);
              if (result.clearedSelection) session.set({ active: undefined });
            }
          });
        },
      },
    ]);
  };

  return (
    <Screen
      title={t("choose_your_playlist")}
      onBack={canGoHome ? () => router.back() : undefined}
      scroll={false}
      testID="playlists-screen"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          // "Reload": the content load starts again (device info, then the playlist).
          <RefreshControl
            refreshing={false}
            onRefresh={() => resetTo("/")}
            tintColor={colors.brand.primary}
            colors={[colors.brand.primary]}
          />
        }
      >
        {banner ? (
          <Banner
            testID="playlists-error"
            lines={[t(loadErrorKey(banner)), t("playlist_error_2"), t("playlist_error_3")]}
          />
        ) : null}
        <ListRow
          title={t("auto_switch_playlist")}
          toggle={{
            value: settings.autoSwitchPlaylist,
            onChange: (on) => saveSetting(globalKeys.autoSwitchPlaylist, on ? "on" : "off"),
          }}
        />
        <ListRow
          title={t("start_on_playlist")}
          toggle={{
            value: settings.appInitialization === "playlist_first",
            onChange: (on) =>
              saveSetting(globalKeys.appInitializationChoice, on ? "playlist_first" : "automatic"),
          }}
        />
        {playlists.length === 0 ? (
          <View style={styles.empty} testID="playlists-empty">
            <AppText variant="h3">{t("mobile_playlists_empty_title")}</AppText>
            <AppText color="secondary">{t("mobile_playlists_empty_body")}</AppText>
            <ActivationCard macAddress={macAddress} deviceKey={deviceKey} />
          </View>
        ) : (
          playlists.map((p) => (
            <PlaylistRow
              key={p.id}
              playlist={p}
              subtitle={expiry(p)}
              badge={
                active?.playlist.id === p.id && !startupChooser ? t("mobile_current") : undefined
              }
              onPress={() => open(p)}
              onMore={() => confirmDelete(p)}
            />
          ))
        )}
        <ListRow
          title={t("stalker_portals")}
          chevron
          onPress={() => router.push("/portals")}
          testID="playlists-portals"
        />
        <Button
          label={t("mobile_add_on_website")}
          variant="ghost"
          onPress={() => void openUrl(qrPlaylistUrl(macAddress, "xc"))}
        />
        {playlists.length > 0 ? (
          <Card title={t("device_info")}>
            <AppText variant="meta" color="secondary">
              {`${t("mac_address_label")} ${macAddress}`}
            </AppText>
            <AppText variant="meta" color="secondary">
              {`${t("device_key_label")} ${deviceKey}`}
            </AppText>
          </Card>
        ) : null}
        <AppText variant="meta" color="tertiary">
          {`${t("playlists_footer_a")} ${t("playlists_footer_b")} iboplayer.com ${t("playlists_footer_c")}`}
        </AppText>
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("add_playlist")}
        onPress={() => router.push("/playlists/add")}
        style={styles.fab}
        testID="playlists-add"
      >
        <Plus size={layout.iconSize} color={colors.text.onPrimary} />
        <AppText variant="bodyStrong" color="onPrimary">
          {t("add_playlist")}
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.gutter, gap: spacing.md, paddingBottom: spacing.giant * 2 },
  empty: { gap: spacing.md },
  fab: {
    position: "absolute",
    end: layout.gutter,
    bottom: layout.gutter,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: layout.touchTarget + spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.chip * 2,
    backgroundColor: colors.brand.primary,
  },
});
