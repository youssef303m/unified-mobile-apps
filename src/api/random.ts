// Secure randomness from `crypto.getRandomValues`. Node and browsers have it; on React Native
// src/platform/polyfills.ts installs it from expo-crypto before any other module loads.

export interface RandomSource {
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

function getRandomValues(bytes: Uint32Array): Uint32Array {
  const webCrypto = (
    globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }
  ).crypto;
  if (!webCrypto?.getRandomValues) throw new Error("crypto.getRandomValues is not available");
  return webCrypto.getRandomValues(bytes);
}

export const secureRandom: RandomSource = {
  int(maxExclusive) {
    const buffer = getRandomValues(new Uint32Array(1));
    return (buffer[0] ?? 0) % maxExclusive;
  },
};

export function randomBytes(count: number, source: RandomSource = secureRandom): Uint8Array {
  return Uint8Array.from({ length: count }, () => source.int(256));
}

export function randomString(
  alphabet: string,
  length: number,
  source: RandomSource = secureRandom,
): string {
  let out = "";
  while (out.length < length) out += alphabet.charAt(source.int(alphabet.length));
  return out;
}

/** Fisher–Yates shuffle into a new array. */
export function shuffled<T>(items: readonly T[], source: RandomSource = secureRandom): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = source.int(i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
