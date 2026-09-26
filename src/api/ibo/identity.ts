// The phone's device id (02-backend/device-and-auth.md §2.1). Pure derivation; reading
// ANDROID_ID and persisting the result live in src/platform/deviceIdentity.ts.
import { sha256Hex } from "../crypto";

const NAMESPACE = "iboplayer-mobile:";

function formatMac(bytes: readonly number[]): string {
  // Q-device-id: uppercase (the open-questions default; device-and-auth.md §2.1 step 4 says
  // lowercase, see docs/decisions.md D-024).
  return bytes
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":")
    .toUpperCase();
}

/** Forces a locally administered, unicast first octet, so it never collides with a vendor MAC. */
function toLocallyAdministered(bytes: number[]): number[] {
  const [first = 0, ...rest] = bytes;
  return [(first & 0xfc) | 0x02, ...rest];
}

/** Q-device-id: SHA-256("iboplayer-mobile:" + ANDROID_ID), first 6 bytes, locally administered. */
export function macFromAndroidId(androidId: string): string {
  const hex = sha256Hex(NAMESPACE + androidId).slice(0, 12);
  const bytes = Array.from({ length: 6 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  return formatMac(toLocallyAdministered(bytes));
}

/** Fallback when ANDROID_ID is unavailable: 6 random bytes, locally administered. */
export function macFromRandomBytes(random: Uint8Array): string {
  return formatMac(toLocallyAdministered(Array.from(random.slice(0, 6))));
}
