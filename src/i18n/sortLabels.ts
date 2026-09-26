// The sort options' labels (R-090): the TV keys, plus "Number" for the live sort.
import type { SortKey } from "@/storage/settings";

export const SORT_LABELS = {
  default: "default",
  added: "added",
  a_z: "a_z",
  z_a: "z_a",
  rating: "rating",
  number: "mobile_sort_number",
} as const satisfies Record<SortKey, string>;
