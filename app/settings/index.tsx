import { useState, type ReactNode } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { reloadAppAsync } from "expo";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { clearWatchListOf } from "@/browse/settings";
import { AppText } from "@/components/AppText";
import { LanguageSheet, useCurrentLanguage } from "@/components/LanguageSheet";
import { ListRow } from "@/components/ListRow";
import { OptionSheet } from "@/components/OptionSheet";
import { Screen } from "@/components/Screen";
import { showToast } from "@/components/Toast";
import { downloads, storageUsed, useDownloads } from "@/downloads";
import { refreshBrowse } from "@/hooks/queryClient";
import { browseContext } from "@/hooks/useBrowse";
import {
  autoPlayOn,
  backgroundAudioOn,
  setAutoPlay,
  setBackgroundAudio,
} from "@/player/playerSettings";
import { clearAppCache } from "@/session/boot";
import { useSession } from "@/session/store";
import { globalKeys } from "@/storage/keys";
import { kvStore } from "@/storage/kv";
import { readSettings, type Settings } from "@/storage/settings";
import { spacing } from "@/theme/tokens";
import { formatBytes } from "@/utils/format";

type Picker = "language" | "live_initialization" | "app_initialization";

const LIVE_INIT = ["default", "last", "favorite"] as const;
const APP_INIT = [
  { key: "automatic", label: "automatic" },
  { key: "playlist_first", label: "playlist_selection" },
] as const;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText variant="caption" color="secondary" accessibilityRole="header">
        {title.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

// Settings (settings.md, user-flows.md §14 Mobile): the TV settings the phone keeps (D-074 lists
// the dropped ones), grouped, plus the phone's player settings. Choices open a radio sheet; the
// Storage actions ask first (user-flows.md §16 Mobile).
export default function SettingsScreen() {
  const { t } = useTranslation();
  const hasPlaylist = useSession((s) => s.active !== undefined);
  const [settings, setSettings] = useState<Settings>(() => readSettings(kvStore));
  const [autoPlay, setAutoPlayState] = useState(() => autoPlayOn(kvStore));
  const [background, setBackground] = useState(() => backgroundAudioOn(kvStore));
  const [picker, setPicker] = useState<Picker | undefined>();
  const [wifiOnly, setWifiOnly] = useState(() => downloads().wifiOnly());
  const records = useDownloads();
  const language = useCurrentLanguage();

  const save = (key: string, value: string) => {
    kvStore.set(key, value);
    setSettings(readSettings(kvStore));
  };

  const confirm = (title: string, message: string, onConfirm: () => void) =>
    Alert.alert(title, message, [
      { text: t("cancel"), style: "cancel" },
      { text: t("mobile_clear"), style: "destructive", onPress: onConfirm },
    ]);

  const clearWatchList = (kind: "movie" | "series") =>
    confirm(
      t(kind === "movie" ? "clear_movies_watch_list" : "clear_series_watch_list"),
      t("clear_watch_lists_desc"),
      () => {
        const ctx = browseContext();
        if (!ctx) return;
        clearWatchListOf(ctx, kind);
        refreshBrowse(ctx.catalogue.playlistId);
        showToast({
          text: t(
            kind === "movie"
              ? "msg_movies_watch_lists_cleared_successfully"
              : "msg_series_watch_lists_cleared_successfully",
          ),
        });
      },
    );

  const clearCache = () =>
    confirm(t("clear_cache"), t("clear_cache_desc"), () => {
      void clearAppCache().finally(() => void reloadAppAsync("Cache cleared"));
    });

  const appInitLabel = APP_INIT.find((o) => o.key === settings.appInitialization)?.label;

  return (
    <Screen title={t("settings")} onBack={() => router.back()} testID="settings-screen">
      <Group title={t("mobile_settings_playback")}>
        <ListRow
          title={t("subtitle_settings")}
          subtitle={t("subtitle_settings_desc")}
          chevron
          onPress={() => router.push("/settings/subtitles")}
          testID="settings-subtitles"
        />
        <ListRow
          title={autoPlay ? t("mobile_autoplay_on") : t("autoplay_off")}
          subtitle={t("mobile_autoplay_hint")}
          toggle={{
            value: autoPlay,
            onChange: (on) => {
              setAutoPlay(kvStore, on);
              setAutoPlayState(on);
            },
          }}
          testID="settings-autoplay"
        />
        <ListRow
          title={t("mobile_background_audio")}
          subtitle={t("mobile_background_audio_hint")}
          toggle={{
            value: background,
            onChange: (on) => {
              setBackgroundAudio(kvStore, on);
              setBackground(on);
            },
          }}
          testID="settings-background-audio"
        />
      </Group>

      <Group title={t("mobile_downloads")}>
        <ListRow
          title={t("mobile_download_wifi_only")}
          subtitle={t("mobile_download_wifi_only_hint")}
          toggle={{
            value: wifiOnly,
            onChange: (on) => {
              void downloads().setWifiOnly(on);
              setWifiOnly(on);
            },
          }}
          testID="settings-wifi-only"
        />
        <ListRow
          title={t("mobile_downloads")}
          subtitle={t("mobile_downloads_storage", {
            used: formatBytes(storageUsed(records)),
            free: formatBytes(downloads().freeBytes()),
          })}
          chevron
          onPress={() => router.push({ pathname: "/my-list", params: { segment: "downloads" } })}
          testID="settings-downloads"
        />
      </Group>

      {hasPlaylist ? (
        <Group title={t("mobile_settings_content")}>
          <ListRow
            title={t("hide_categories")}
            subtitle={t("hide_categories_desc")}
            chevron
            onPress={() => router.push("/settings/hide-categories")}
            testID="settings-hide-categories"
          />
          <ListRow
            title={t("live_initialization")}
            subtitle={t(settings.liveInitialization)}
            chevron
            onPress={() => setPicker("live_initialization")}
            testID="settings-live-initialization"
          />
        </Group>
      ) : null}

      <Group title={t("mobile_settings_startup")}>
        <ListRow
          title={t("app_initialization")}
          subtitle={appInitLabel ? t(appInitLabel) : undefined}
          chevron
          onPress={() => setPicker("app_initialization")}
          testID="settings-app-initialization"
        />
        <ListRow
          title={t("auto_switch_playlist")}
          toggle={{
            value: settings.autoSwitchPlaylist,
            onChange: (on) => save(globalKeys.autoSwitchPlaylist, on ? "on" : "off"),
          }}
          testID="settings-auto-switch-playlist"
        />
      </Group>

      <Group title={t("mobile_settings_general")}>
        <ListRow
          title={t("change_language")}
          subtitle={language.name}
          chevron
          onPress={() => setPicker("language")}
          testID="settings-language"
        />
        <ListRow
          title={t("parent_control")}
          chevron
          onPress={() => router.push("/settings/parental")}
          testID="settings-parental"
        />
      </Group>

      <Group title={t("mobile_settings_storage")}>
        {hasPlaylist ? (
          <>
            <ListRow
              title={t("clear_movies_watch_list")}
              onPress={() => clearWatchList("movie")}
              testID="settings-clear-movies"
            />
            <ListRow
              title={t("clear_series_watch_list")}
              onPress={() => clearWatchList("series")}
              testID="settings-clear-series"
            />
          </>
        ) : null}
        <ListRow
          title={t("clear_cache")}
          subtitle={t("clear_cache_desc")}
          onPress={clearCache}
          testID="settings-clear-cache"
        />
      </Group>

      <ListRow
        title={t("mobile_about")}
        chevron
        onPress={() => router.push("/about")}
        testID="settings-about"
      />

      <LanguageSheet visible={picker === "language"} onClose={() => setPicker(undefined)} />
      <OptionSheet
        visible={picker === "live_initialization"}
        onClose={() => setPicker(undefined)}
        title={t("live_initialization")}
        description={t("live_initialization_desc")}
        options={LIVE_INIT.map((key) => ({ key, label: t(key) }))}
        value={settings.liveInitialization}
        onChange={(key) => save(globalKeys.liveInitializationChoice, key)}
        testID="live-initialization-sheet"
      />
      <OptionSheet
        visible={picker === "app_initialization"}
        onClose={() => setPicker(undefined)}
        title={t("app_initialization")}
        description={t("app_initialization_desc")}
        options={APP_INIT.map((o) => ({ key: o.key, label: t(o.label) }))}
        value={settings.appInitialization}
        onChange={(key) => save(globalKeys.appInitializationChoice, key)}
        testID="app-initialization-sheet"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm, marginTop: spacing.sm },
});
