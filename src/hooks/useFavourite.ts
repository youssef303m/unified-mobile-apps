// The favourite toggle of cards, channels and details pages, with the TV toasts (R-062, R-070).
// On the phone the change applies at once (user-flows.md §7 Mobile, docs/decisions.md D-060).
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { isFavouriteItem, toggleFavourite } from "@/browse/library";
import { showToast } from "@/components/Toast";
import type { CatalogueItem } from "@/content/types";

import { refreshBrowse } from "./queryClient";
import { browseContext, useBrowse } from "./useBrowse";

export function useIsFavourite(item: CatalogueItem | undefined): boolean {
  const ctx = useBrowse();
  return item && ctx ? isFavouriteItem(ctx, item) : false;
}

export function useToggleFavourite() {
  const { t } = useTranslation();
  return useCallback(
    (item: CatalogueItem, categoryIsAdult: boolean) => {
      const ctx = browseContext();
      if (!ctx) return;
      const result = toggleFavourite(ctx, item, categoryIsAdult);
      switch (result) {
        case "added":
          showToast({ text: `${item.name}${t("msg_added_to_favorites")}` });
          break;
        case "removed":
          showToast({ text: `${item.name}${t("msg_removed_from_favorites")}` });
          break;
        case "refused_adult":
          showToast({
            title: t("parental_safety"),
            text: t("msg_adding_protected_content_to_favourites_is_not"),
          });
          break;
        case "full":
          showToast({ text: t("mobile_favourites_full") });
          break;
      }
      refreshBrowse(ctx.catalogue.playlistId);
    },
    [t],
  );
}
