// H. Custom categories (01-product/business-rules.md R-080…R-084, data-models.md §5).
import type { KeyValueStore } from "@/api/store";
import { readJson } from "@/api/store";
import { secureRandom, type RandomSource } from "@/api/random";
import { globalKeys, playlistKeys, type ListType } from "@/storage/keys";

import type { CatalogueItem } from "../types";

import { canAddFavourite } from "./parental";

export interface CustomCategory {
  id: string;
  name: string;
  icon: string;
}

export const DEFAULT_CUSTOM_ICON = "cc-heart";
export const CUSTOM_NAME_MAX = 32;
export const CUSTOM_MEMBERS_MAX = 500;
const TYPES: readonly ListType[] = ["live", "vod", "series"];

/** R-080: custom categories default off. */
export function customCategoriesEnabled(store: KeyValueStore): boolean {
  return store.get(globalKeys.customCategoriesEnabled) === "true";
}

export function setCustomCategoriesEnabled(store: KeyValueStore, enabled: boolean): void {
  store.set(globalKeys.customCategoriesEnabled, enabled ? "true" : "false");
}

/**
 * R-080 / R-101: with custom categories off the favourite action toggles Favourites directly;
 * with them on (or in Sports mode) it opens the "Add to" chooser.
 */
export function favouriteAction(
  customEnabled: boolean,
  sportsMode: boolean,
): "toggle_favourite" | "open_chooser" {
  return customEnabled || sportsMode ? "open_chooser" : "toggle_favourite";
}

/** R-081: definitions are global (shared by every playlist). */
export function customCategories(store: KeyValueStore): CustomCategory[] {
  return readJson<CustomCategory[]>(store, globalKeys.customCategories) ?? [];
}

/** R-084: the name is trimmed and 1–32 characters. */
export function validCustomName(name: string): string | undefined {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= CUSTOM_NAME_MAX ? trimmed : undefined;
}

/** R-084: id "cc<base36 time><base36 rand>", default icon cc-heart. */
export function createCustomCategory(
  store: KeyValueStore,
  name: string,
  icon: string = DEFAULT_CUSTOM_ICON,
  now: number = Date.now(),
  random: RandomSource = secureRandom,
): CustomCategory | undefined {
  const valid = validCustomName(name);
  if (!valid) return undefined;
  const category = {
    id: `cc${now.toString(36)}${random.int(36 ** 4).toString(36)}`,
    name: valid,
    icon,
  };
  store.set(globalKeys.customCategories, JSON.stringify([...customCategories(store), category]));
  return category;
}

/** R-081: membership per playlist and type; ids for Xtream/M3U. */
export function customMembers(
  store: KeyValueStore,
  pid: string,
  type: ListType,
  catId: string,
): string[] {
  return (readJson<unknown[]>(store, playlistKeys(pid).customMembers(type, catId)) ?? []).map(
    String,
  );
}

/** R-081 / R-062: max 500 (oldest dropped); adult items refused. */
export function addCustomMember(
  store: KeyValueStore,
  pid: string,
  type: ListType,
  catId: string,
  id: string,
  categoryIsAdult: boolean,
): boolean {
  if (!canAddFavourite(categoryIsAdult)) return false;
  const members = customMembers(store, pid, type, catId).filter((m) => m !== id);
  const next = [...members, id].slice(-CUSTOM_MEMBERS_MAX);
  store.set(playlistKeys(pid).customMembers(type, catId), JSON.stringify(next));
  return true;
}

export function removeCustomMember(
  store: KeyValueStore,
  pid: string,
  type: ListType,
  catId: string,
  id: string,
) {
  const next = customMembers(store, pid, type, catId).filter((m) => m !== id);
  store.set(playlistKeys(pid).customMembers(type, catId), JSON.stringify(next));
}

/** R-081 for Stalker: full objects, newest first, max 500. */
export function addStalkerCustomMember(
  store: KeyValueStore,
  pid: string,
  type: ListType,
  catId: string,
  item: CatalogueItem,
  categoryIsAdult: boolean,
): boolean {
  if (!canAddFavourite(categoryIsAdult)) return false;
  const key = playlistKeys(pid).stalkerCustomMembers(type, catId);
  const rest = (readJson<CatalogueItem[]>(store, key) ?? []).filter(
    (o) => o.item_id !== item.item_id,
  );
  store.set(key, JSON.stringify([item, ...rest].slice(0, CUSTOM_MEMBERS_MAX)));
  return true;
}

/** R-082: the custom rows shown after Favourites (none while the feature is off). */
export function customRows(store: KeyValueStore): CustomCategory[] {
  return customCategoriesEnabled(store) ? customCategories(store) : [];
}

/** R-083: deleting a category removes it and its membership for the current playlist only. */
export function deleteCustomCategory(store: KeyValueStore, pid: string, catId: string): void {
  store.set(
    globalKeys.customCategories,
    JSON.stringify(customCategories(store).filter((c) => c.id !== catId)),
  );
  for (const type of TYPES) {
    store.remove(playlistKeys(pid).customMembers(type, catId));
    store.remove(playlistKeys(pid).stalkerCustomMembers(type, catId));
  }
}
