// The phone's persisted device id (02-backend/device-and-auth.md §2.1, Q-device-id). Derived
// once from ANDROID_ID and kept in secure storage, so a later change of the derivation (or of
// ANDROID_ID after an update) cannot silently change the identity. Used from M3 (boot flow).
import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";

import { macFromAndroidId, macFromRandomBytes } from "@/api/ibo/identity";
import { randomBytes } from "@/api/random";

const DEVICE_MAC_KEY = "device_mac";

function readAndroidId(): string | null {
  try {
    const id = Application.getAndroidId();
    return id ? id : null;
  } catch {
    return null;
  }
}

export function getOrCreateDeviceMac(): string {
  const stored = SecureStore.getItem(DEVICE_MAC_KEY);
  if (stored) return stored;
  const androidId = readAndroidId();
  const mac = androidId ? macFromAndroidId(androidId) : macFromRandomBytes(randomBytes(6));
  SecureStore.setItem(DEVICE_MAC_KEY, mac);
  return mac;
}
