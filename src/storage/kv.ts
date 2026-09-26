// Key-value storage (MMKV, encrypted). Replaces the TV app's localStorage with the same key
// names and value shapes (02-backend/data-models.md §12). The full key set arrives in M2.
import { createMMKV, type MMKV } from "react-native-mmkv";

import type { KeyValueStore } from "@/api/store";

import { getOrCreateMmkvEncryptionKey } from "./secure";

// The TV app's storage prefix (`runtime.storageId`).
export const STORAGE_PREFIX = "gz3rYzUIC7_";

export const KEYS = {
  // 01-product/settings.md §2.2: key `{P}language`.
  language: "language",
  // Phone only: the language a direction reload was last attempted for (reload-loop guard).
  directionReload: "mobile_direction_reload",
  // Phone only, dev/preview builds: "fixtures" (default) or "dev_backend" (D-061: never production).
  networkMode: "mobile_network_mode",
  // Phone only, dev/preview builds: the fixture scenario from the dev link (JSON), for restarts.
  fixtureScenario: "mobile_fixture_scenario",
} as const;

export type KvKey = (typeof KEYS)[keyof typeof KEYS];

let instance: MMKV | undefined;

function store(): MMKV {
  instance ??= createMMKV({
    id: "iboplayer",
    encryptionKey: getOrCreateMmkvEncryptionKey(),
    encryptionType: "AES-256",
  });
  return instance;
}

export function prefixed(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

export function getString(key: KvKey): string | undefined {
  return store().getString(prefixed(key));
}

export function setString(key: KvKey, value: string): void {
  store().set(prefixed(key), value);
}

export function remove(key: KvKey): void {
  store().remove(prefixed(key));
}

/** Full-key access for src/api modules (some TV keys are unprefixed, e.g. `stalker_mac`). */
export const kvStore: KeyValueStore = {
  get: (key) => store().getString(key),
  set: (key, value) => store().set(key, value),
  remove: (key) => void store().remove(key),
  keys: () => store().getAllKeys(),
};
