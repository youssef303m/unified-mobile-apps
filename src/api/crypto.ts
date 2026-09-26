// Payload obfuscation and the QR AES (02-backend/device-and-auth.md §3). The wire format must be
// byte-exact: the servers are shared with the TV apps.
import CryptoJS from "crypto-js";

import { config } from "@/config";

import { ParseError } from "./errors";
import { randomString, secureRandom, type RandomSource } from "./random";

const ALPHABET = config.crypto.obfuscationAlphabet;

// Q-utf8: Base64 of the UTF-8 bytes (the TV's btoa fails on non-Latin-1 text). Identical to the
// TV for ASCII payloads.
export function base64EncodeUtf8(text: string): string {
  return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(text));
}

export function base64DecodeUtf8(b64: string): string {
  return CryptoJS.enc.Base64.parse(b64).toString(CryptoJS.enc.Utf8);
}

/**
 * JSON with every non-ASCII character written as a `\uXXXX` escape. The IBO backend decodes the
 * request Base64 as ASCII, not UTF-8, so raw UTF-8 bytes (an Arabic playlist name) arrive garbled;
 * escapes are plain ASCII and JSON.parse restores the text. Identical to JSON.stringify for ASCII
 * payloads (docs/decisions.md D-047).
 */
export function asciiJson(data: unknown): string {
  return JSON.stringify(data).replace(
    /[\u007f-￿]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

/** Client → server: 2 marker characters first, then Base64 with a random filler spliced in. */
export function encryptRequest(data: unknown, random: RandomSource = secureRandom): string {
  const b64 = base64EncodeUtf8(asciiJson(data));
  let keyLen = random.int(30);
  if (keyLen < 20) keyLen = 20;
  let pos = b64.length > 0 ? random.int(b64.length) : 0;
  if (pos >= 42) pos = 42;
  const filler = randomString(ALPHABET, keyLen, random);
  return (
    ALPHABET.charAt(pos) + ALPHABET.charAt(keyLen) + b64.slice(0, pos) + filler + b64.slice(pos)
  );
}

/** Server → client: the envelope `{ data }` with the 2 marker characters at the end. */
export function decryptResponse(envelope: unknown): unknown {
  const raw = (envelope as { data?: unknown } | null)?.data;
  if (typeof raw !== "string" || raw.length < 2) throw new ParseError("Missing encrypted data");
  const pos = ALPHABET.indexOf(raw.charAt(raw.length - 2));
  const len = ALPHABET.indexOf(raw.charAt(raw.length - 1));
  if (pos < 0 || len < 0) throw new ParseError("Bad envelope markers");
  const trimmed = raw.slice(0, -2);
  const b64 = trimmed.slice(0, pos) + trimmed.slice(pos + len);
  try {
    return JSON.parse(base64DecodeUtf8(b64)) as unknown;
  } catch (error) {
    throw new ParseError("Could not decode the encrypted response", error);
  }
}

/** The body is an encrypted envelope: a string `data` and no `status` key. */
export function isEnvelope(body: unknown): body is { data: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { data?: unknown }).data === "string" &&
    !("status" in body)
  );
}

export function toUrlSafe(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** QR "identifier": AES of the JSON-quoted MAC, OpenSSL "Salted__" format (§3.4). */
export function qrIdentifier(macAddress: string): string {
  return CryptoJS.AES.encrypt(JSON.stringify(macAddress), config.crypto.qrAesPassphrase).toString();
}

/** Random 6-character u_id from the look-alike-free alphabet (§4.1). */
export function generateUid(random: RandomSource = secureRandom): string {
  return randomString(config.crypto.uidAlphabet, config.crypto.uidLength, random);
}

export function sha256Hex(text: string): string {
  return CryptoJS.SHA256(text).toString(CryptoJS.enc.Hex);
}

export function sha1Hex(text: string): string {
  return CryptoJS.SHA1(text).toString(CryptoJS.enc.Hex);
}
