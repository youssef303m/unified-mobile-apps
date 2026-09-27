// N-03: removing a playlist or portal offers to delete its downloads.
import { Alert } from "react-native";

import { downloads } from "@/downloads";
import { i18n } from "@/i18n";

export function offerToDeleteDownloads(playlistId: string): void {
  const count = downloads().countForPlaylist(playlistId);
  if (count === 0) return;
  Alert.alert(i18n.t("mobile_download_delete_playlist", { count }), undefined, [
    { text: i18n.t("mobile_keep"), style: "cancel" },
    {
      text: i18n.t("delete"),
      style: "destructive",
      onPress: () => void downloads().removeAll((r) => r.playlistId === playlistId),
    },
  ]);
}
