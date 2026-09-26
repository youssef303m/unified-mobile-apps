// The titles of the R-053 rows. The TV hard-codes the virtual row names; the phone has keys for
// them (docs/new-strings.md).
import type { TFunction } from "i18next";

import type { Row } from "@/browse/rows";
import { UNCATEGORIZED_ID } from "@/content/sync";
import type { ContentKind } from "@/content/types";

export function rowTitle(t: TFunction, kind: ContentKind, row: Row): string {
  if (row.type === "custom") return row.name;
  if (row.type === "category")
    return row.id === UNCATEGORIZED_ID ? t("mobile_uncategorized") : row.name;
  switch (row.id) {
    case "recent":
      return kind === "movie" ? t("continue_watching") : t("mobile_row_recently_viewed");
    case "favourite":
      return t("favorites");
    case "top_rated":
      return t("mobile_row_top_rated");
    case "newly_added":
      return t("mobile_row_newly_added");
    case "recently_modified":
      return t("mobile_row_recently_updated");
    default:
      return t("search");
  }
}
