// Sports mode (01-product/business-rules.md R-100, R-101; data-models.md §9). Keyword lists are
// copied verbatim; matching is a case-insensitive substring test.
import type { KeyValueStore } from "@/api/store";
import { readJson } from "@/api/store";
import { globalKeys } from "@/storage/keys";

export const CATEGORY_INCLUDE = [
  "WORLD CUP",
  "FIFA",
  "MUNDIAL",
  "WC 20",
  "SPORT",
  "SPORTS",
  "⚽",
  "FOOTBALL",
  "SOCCER",
  "FUTBOL",
  "BEIN",
  "FOX SPORT",
  "SKY SPORT",
  "TSN",
  "ESPN",
  "ALWAN SPORT",
];
export const CATEGORY_EXCLUDE = [
  "ENTERTAINMENT",
  "MOVIES",
  "AFLAM",
  "CINEMA",
  "MOSALSALAT",
  "MUSIC",
  "AGHANI",
  "KIDS",
  "ATFAL",
  "ANIME",
  "QURAN",
  "MEDIA",
  "NEWS",
  "AKHBAR",
  "DOCUMENTARY",
  "WATHAEQ",
  "HORSE RACING",
  "RACING",
  "MOTOR",
  "F1",
  "WWE",
  "UFC",
  "KOREA",
  "BOLLYWOOD",
  "TURKEY",
];
export const CHANNEL_INCLUDE = [
  "WORLD CUP",
  "FIFA WC",
  "FIFA",
  "MUNDIAL",
  "SPORT",
  "SPORTS",
  "⚽",
  "BEIN",
  "FOX SPORT",
  "SKY SPORT",
  "TSN",
  "ESPN",
  "BBC",
  "ITV",
  "ZDF",
  "RAI",
  "TRT SPOR",
  "M6",
  "SVT",
  "NRK",
  "RTE",
  "TELEMUNDO",
  "UNIVERS",
  "CARACOL",
  "TVP",
  "HRT",
  "RTS",
  "BNT",
  "TVR",
  "SBS",
  "FUBO",
  "WCTV",
  "ALWAYS ON",
  "DSPORT",
  "CAZE",
  "SPORZA",
  "ARENA SPORT",
  "WIN SPORT",
  "TIGO SPORT",
  "TELETICA",
  "SIGMA",
  "CT SPORT",
  "NRK",
  "TVNZ",
  "ALWAN SPORT",
];
export const CHANNEL_EXCLUDE = [
  "F1",
  "FORMULA",
  "WWE",
  "UFC",
  "BOXING",
  "NBA",
  "NFL",
  "MLB",
  "NHL",
  "CRICKET",
  "GOLF",
  "HORSE",
  "RACING",
  "MOTOR",
  "AFLAM",
  "MOSALSALAT",
  "ANIME",
  "QURAN",
  "MOVIES",
  "CINEMA",
  "SERIES",
  "BOX OFFICE",
  "D-SMART",
  "AGHANI",
  "ATFAL",
  "BOLLYWOOD",
  "KOREA",
];

function matches(
  name: string | undefined,
  include: readonly string[],
  exclude: readonly string[],
): boolean {
  if (!name) return false;
  const upper = name.toUpperCase();
  return (
    include.some((k) => upper.includes(k.toUpperCase())) &&
    !exclude.some((k) => upper.includes(k.toUpperCase()))
  );
}

export const isSportsCategory = (name: string) => matches(name, CATEGORY_INCLUDE, CATEGORY_EXCLUDE);
export const isSportsChannel = (name: string) => matches(name, CHANNEL_INCLUDE, CHANNEL_EXCLUDE);

export const MY_SPORTS_ID = "sports_my";

/** "My Sports Channels": global across playlists. */
export function mySportsChannelIds(store: KeyValueStore): string[] {
  return (readJson<unknown[]>(store, globalKeys.mySportsChannels) ?? []).map(String);
}

export function toggleMySportsChannel(store: KeyValueStore, id: string): boolean {
  const ids = mySportsChannelIds(store);
  const has = ids.includes(id);
  store.set(
    globalKeys.mySportsChannels,
    JSON.stringify(has ? ids.filter((i) => i !== id) : [...ids, id]),
  );
  return !has;
}

export interface SportsRow<T> {
  id: string;
  name: string;
  channels: T[];
}

/**
 * R-100: "My Sports Channels" first, then each matching category with its channels filtered by
 * the channel rule; empty categories are dropped. An empty result means "No sport channels
 * found in your playlist."
 */
export function buildSportsRows<T extends { item_id: string; name: string }>(
  categories: readonly { category_id: string; category_name: string; channels: readonly T[] }[],
  myIds: readonly string[],
): SportsRow<T>[] {
  const all = categories.flatMap((c) => c.channels);
  const mine = myIds.flatMap((id) => all.find((ch) => ch.item_id === id) ?? []);
  const rows: SportsRow<T>[] = [{ id: MY_SPORTS_ID, name: "My Sports Channels", channels: mine }];
  for (const category of categories) {
    if (!isSportsCategory(category.category_name)) continue;
    const channels = category.channels.filter((ch) => isSportsChannel(ch.name));
    if (channels.length > 0)
      rows.push({ id: category.category_id, name: category.category_name, channels });
  }
  return rows;
}

/** R-100: whether sports mode found anything besides the user's own list. */
export function hasSportsChannels<T>(rows: readonly SportsRow<T>[]): boolean {
  return rows.some((r) => r.channels.length > 0);
}

/** R-101: what sports mode allows. */
export const SPORTS_MODE = {
  favouriteOpensChooser: true,
  arrangeAvailable: false,
  searchLimitedToSports: true,
} as const;
