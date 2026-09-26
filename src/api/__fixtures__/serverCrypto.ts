// The server side of the obfuscation (device-and-auth.md §3): read what the app sends, answer
// the way the panel does (markers at the end).
import { config } from "@/config";

import { base64DecodeUtf8, base64EncodeUtf8 } from "../crypto";

const ALPHABET = config.crypto.obfuscationAlphabet;

/** Reverses encryptRequest: markers first, filler at `pos`. */
export function decryptRequest(blob: string): unknown {
  const pos = ALPHABET.indexOf(blob.charAt(0));
  const keyLen = ALPHABET.indexOf(blob.charAt(1));
  const body = blob.slice(2);
  return JSON.parse(base64DecodeUtf8(body.slice(0, pos) + body.slice(pos + keyLen))) as unknown;
}

/** Builds `{ data }` with a deterministic filler, markers at the end. */
export function encryptResponse(value: unknown): { data: string } {
  const b64 = base64EncodeUtf8(JSON.stringify(value));
  const pos = Math.min(7, b64.length);
  const len = 23;
  const filler = "q".repeat(len);
  return {
    data: b64.slice(0, pos) + filler + b64.slice(pos) + ALPHABET.charAt(pos) + ALPHABET.charAt(len),
  };
}
