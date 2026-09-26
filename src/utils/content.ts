// Opening and playing catalogue items from any screen.
import { router } from "expo-router";

import { showToast } from "@/components/Toast";
import type { CatalogueItem } from "@/content/types";
import { i18n } from "@/i18n";

/** The details page of a movie or series; a channel opens on the Live tab. */
export function openItem(item: CatalogueItem): void {
  if (item.kind === "movie") router.push({ pathname: "/movie/[id]", params: { id: item.item_id } });
  else if (item.kind === "series")
    router.push({ pathname: "/series/[id]", params: { id: item.item_id } });
  else
    router.navigate({
      pathname: "/live",
      params: { channel: item.item_id, category: item.category_id },
    });
}

/** Playback arrives with the player in M5 (roadmap); until then Play says so. */
export function play(item: CatalogueItem): void {
  showToast({ title: item.name, text: i18n.t("mobile_playback_soon") });
}
