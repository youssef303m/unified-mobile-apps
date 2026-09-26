// Secure storage (expo-secure-store): the MMKV encryption key, later the parental PIN hash.
import { getRandomBytes } from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const MMKV_KEY_NAME = "mmkv_encryption_key";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// 16 random bytes as 32 hex characters: a 32-byte key string for MMKV's AES-256 mode.
export function getOrCreateMmkvEncryptionKey(): string {
  const existing = SecureStore.getItem(MMKV_KEY_NAME);
  if (existing) return existing;
  const key = toHex(getRandomBytes(16));
  SecureStore.setItem(MMKV_KEY_NAME, key);
  return key;
}
