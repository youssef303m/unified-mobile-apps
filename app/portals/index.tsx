import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import type { Playlist } from "@/api/ibo/types";
import { profileKey, type StbProfileKey } from "@/api/stalker/portal";
import { AppText } from "@/components/AppText";
import { Banner } from "@/components/Banner";
import { Card } from "@/components/Card";
import { CopyRow } from "@/components/CopyRow";
import { ListRow } from "@/components/ListRow";
import { PlaylistRow } from "@/components/PlaylistRow";
import { Screen } from "@/components/Screen";
import { showToast } from "@/components/Toast";
import { splitPlaylists, virtualStalkerMac } from "@/content/rules/playlists";
import { deviceCredentials } from "@/content/rules/startup";
import { loadErrorKey } from "@/i18n/loadErrors";
import { deviceModel } from "@/platform/deviceInfo";
import { manageDeps, setPlaylists } from "@/session/boot";
import { removePlaylist } from "@/session/playlists";
import { session, useSession } from "@/session/store";
import { globalKeys } from "@/storage/keys";
import { kvStore } from "@/storage/kv";
import { readSettings } from "@/storage/settings";
import { colors, layout, radius, spacing } from "@/theme/tokens";
import { playlistTitle, switchPlaylist } from "@/utils/playlists";

// Product names of the set-top boxes a portal is told the phone is (stalker.md §2.4).
const STB_LABELS: Record<StbProfileKey, string> = {
  mag250: "MAG 250",
  mag322: "MAG 322",
  mag520: "MAG 520",
  iboplayer: "IBOPlayer",
};

// Stalker Portals (current-app-inventory.md §8, user-flows.md §3 Mobile).
export default function PortalsScreen() {
  const { t } = useTranslation();
  const all = useSession((s) => s.playlists);
  const active = useSession((s) => s.active);
  const failure = useSession((s) => s.failure);
  const macAddress = useSession((s) => s.macAddress) ?? "";
  const info = useSession((s) => s.info);
  const [profile, setProfile] = useState(() => profileKey(readSettings(kvStore).stbProfile));
  const { playlists, portals } = splitPlaylists(all);
  const { deviceKey } = deviceCredentials(macAddress, info, kvStore.get(globalKeys.apiData));
  const banner = failure?.screen === "portals" ? failure : undefined;

  const confirmDelete = (p: Playlist) => {
    Alert.alert(t("mobile_delete_portal_title"), playlistTitle(p), [
      { text: t("no"), style: "cancel" },
      {
        text: t("yes"),
        style: "destructive",
        onPress: () => {
          void removePlaylist(manageDeps(), all, portals, p).then((result) => {
            if (result.kind === "last_one")
              showToast({ title: t("sorry"), text: t("msg_you_need_to_have_at_least_1") });
            else if (result.kind === "failed")
              showToast({ title: t("error"), text: t("msg_failed_to_delete_portal") });
            else {
              setPlaylists(result.playlists);
              if (result.clearedSelection) session.set({ active: undefined });
              if (result.toPlaylists) router.replace("/playlists");
            }
          });
        },
      },
    ]);
  };

  return (
    <Screen
      title={t("stalker_portals")}
      onBack={router.canGoBack() ? () => router.back() : undefined}
      scroll={false}
      testID="portals-screen"
    >
      <ScrollView contentContainerStyle={styles.content}>
        {banner ? <Banner testID="portals-error" lines={[t(loadErrorKey(banner))]} /> : null}
        {portals.length === 0 ? (
          <AppText color="secondary" testID="portals-empty">
            {t("mobile_portals_empty")}
          </AppText>
        ) : (
          portals.map((p) => (
            <PlaylistRow
              key={p.id}
              playlist={p}
              subtitle={[p.portal_address || p.url, p.stalker_mac_address]
                .filter(Boolean)
                .join("\n")}
              badge={active?.playlist.id === p.id ? t("mobile_selected") : undefined}
              onPress={() =>
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
                )
              }
              onMore={() => confirmDelete(p)}
            />
          ))
        )}
        <Card title={t("device_information")}>
          <CopyRow label={t("device_model")} value={deviceModel()} />
          <CopyRow label={t("stalker_virtual_mac")} value={virtualStalkerMac(kvStore)} />
          <CopyRow label={t("software_mac")} value={macAddress} />
          <CopyRow label={t("device_key")} value={deviceKey} />
        </Card>
        <Card title={t("stb_profile")}>
          {(Object.keys(STB_LABELS) as StbProfileKey[]).map((key) => (
            <ListRow
              key={key}
              title={STB_LABELS[key]}
              selected={profile === key}
              testID={`stb-${key}`}
              onPress={() => {
                // Saved on tap (current-app-inventory.md §8).
                kvStore.set(globalKeys.stalkerStbProfile, key);
                setProfile(key);
              }}
              trailing={
                <AppText color={profile === key ? "primary" : "tertiary"}>
                  {profile === key ? "●" : "○"}
                </AppText>
              }
            />
          ))}
        </Card>
        {playlists.length > 0 ? (
          <ListRow
            title={t("playlists_page")}
            chevron
            onPress={() => router.replace("/playlists")}
          />
        ) : null}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("add_portal")}
        onPress={() => router.push("/portals/add")}
        style={styles.fab}
        testID="portals-add"
      >
        <Plus size={layout.iconSize} color={colors.text.onPrimary} />
        <AppText variant="bodyStrong" color="onPrimary">
          {t("add_portal")}
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.gutter, gap: spacing.md, paddingBottom: spacing.giant * 2 },
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
