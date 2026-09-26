// Runs before any other module (index.ts). Hermes has no `crypto.getRandomValues`, which
// crypto-js looks up once when it loads (for the QR AES salt) and src/api/random.ts uses.
import { getRandomValues } from "expo-crypto";

type WebCrypto = { getRandomValues: typeof getRandomValues };
const g = globalThis as { crypto?: Partial<WebCrypto> };

if (typeof g.crypto?.getRandomValues !== "function") {
  g.crypto = { ...(g.crypto ?? {}), getRandomValues };
}
