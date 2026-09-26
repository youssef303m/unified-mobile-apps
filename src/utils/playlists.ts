// Playlist display and switching helpers shared by the Playlists and Portals screens.
import { Alert } from "react-native";

import type { Playlist } from "@/api/ibo/types";

import { resetTo } from "./navigation";

export function playlistTitle(p: Playlist): string {
  return p.playlist_name || p.portal_name || p.url;
}

/**
 * R-040: a switch shows the full-screen loader, then Home. With content already loaded the user
 * confirms first (screens.md Playlists).
 */
export function switchPlaylist(
  p: Playlist,
  confirm?: { title: string; body: string; cancel: string; ok: string },
): void {
  const go = () => resetTo({ pathname: "/loading", params: { playlistId: p.id } });
  if (!confirm) return go();
  Alert.alert(confirm.title, confirm.body, [
    { text: confirm.cancel, style: "cancel" },
    { text: confirm.ok, onPress: go },
  ]);
}
