import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { reloadAppAsync } from "expo";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { LoadingView } from "@/components/LoadingView";
import { showToast } from "@/components/Toast";
import { deviceCredentials } from "@/content/rules/startup";
import { LOAD_STEP_KEYS } from "@/i18n/statusKeys";
import { loadActivePlaylist } from "@/session/boot";
import { session, useSession } from "@/session/store";
import { globalKeys } from "@/storage/keys";
import { kvStore } from "@/storage/kv";
import { goAfterLoad } from "@/utils/navigation";
import { playlistTitle } from "@/utils/playlists";

// The full-screen loader of a playlist load: at startup, after Welcome, and on every switch
// (user-flows.md §2 Mobile). Back, "Change Playlist" (R-011 after 120 s) and a new attempt
// cancel the running load.
export default function LoadingScreen() {
  const { t } = useTranslation();
  const { playlistId } = useLocalSearchParams<{ playlistId?: string }>();
  const [status, setStatus] = useState(() => t("loading_playlist"));
  const macAddress = useSession((s) => s.macAddress) ?? "";
  const info = useSession((s) => s.info);
  const controller = useRef<AbortController | undefined>(undefined);

  const start = useCallback(() => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    loadActivePlaylist({
      playlistId,
      signal: current.signal,
      onStep: (step) => {
        if (!current.signal.aborted) setStatus(t(LOAD_STEP_KEYS[step]));
      },
      onAutoSwitch: (playlist) =>
        showToast({
          title: t("auto_switch"),
          text: `${t("msg_playlist_failed_to_load_switched_to")} "${playlistTitle(playlist)}".`,
        }),
    })
      .catch(() => {
        // An unexpected error still explains itself on the Playlists screen.
        session.set({ failure: { screen: "playlists", error: "playlist_generic" } });
        return "playlists" as const;
      })
      .then((result) => {
        // A retry replaced this attempt; an abort still lands on the Playlists screen.
        if (controller.current === current) goAfterLoad(result);
      });
  }, [playlistId, t]);

  useEffect(() => {
    start();
    return () => controller.current?.abort();
  }, [start]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      controller.current?.abort();
      return true;
    });
    return () => sub.remove();
  }, []);

  const { deviceKey } = deviceCredentials(macAddress, info, kvStore.get(globalKeys.apiData));
  return (
    <LoadingView
      status={status}
      onRetry={start}
      macAddress={macAddress}
      deviceKey={deviceKey}
      stuck={{
        onChangePlaylist: () => controller.current?.abort(),
        onRestart: () => void reloadAppAsync("Stuck on loading"),
      }}
    />
  );
}
