import CryptoJS from "crypto-js";

import { config } from "@/config";

import { decryptRequest, encryptResponse } from "../__fixtures__/serverCrypto";
import {
  asciiJson,
  base64EncodeUtf8,
  decryptResponse,
  encryptRequest,
  generateUid,
  isEnvelope,
  qrIdentifier,
  toUrlSafe,
} from "../crypto";
import { ParseError } from "../errors";
import { macFromAndroidId, macFromRandomBytes, withPlatformPrefix } from "../ibo/identity";
import type { RandomSource } from "../random";

/** Replays a fixed sequence of draws. */
function sequence(values: number[]): RandomSource {
  let i = 0;
  return { int: () => values[i++] ?? 0 };
}
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const ALPHABET = config.crypto.obfuscationAlphabet;

// Vectors computed independently with Node's Buffer (device-and-auth.md §3 algorithm).
const MAC_PAYLOAD = { mac_address: "a1:b2:c3:d4:e5:f6" };

describe("encryptRequest (device-and-auth.md §3.1)", () => {
  it("vector 1: filler length clamped up to 20, inserted at position 10", () => {
    const random = sequence([5, 10, ...range(20)]);
    expect(encryptRequest(MAC_PAYLOAD, random)).toBe(
      "kueyJtYWNfYWabcdefghijklmnopqrstRkcmVzcyI6ImExOmIyOmMzOmQ0OmU1OmY2In0=",
    );
  });

  it("vector 2: position clamped down to 42, filler length 25", () => {
    const random = sequence([25, 45, ...range(25)]);
    expect(encryptRequest(MAC_PAYLOAD, random)).toBe(
      "QzeyJtYWNfYWRkcmVzcyI6ImExOmIyOmMzOmQ0OmU1OmabcdefghijklmnopqrstuvwxyY2In0=",
    );
  });

  it("drops undefined keys like JSON.stringify (the agent payload)", () => {
    const blob = encryptRequest({
      mac_address: "a1:b2:c3:d4:e5:f6",
      app_type: undefined,
      version: undefined,
    });
    expect(decryptRequest(blob)).toEqual(MAC_PAYLOAD);
  });

  it("round-trips random payloads through the server-side decoder", () => {
    for (let i = 0; i < 50; i++) {
      const payload = { mac_address: "A1:B2:C3:D4:E5:F6", u_id: generateUid(), n: i };
      expect(decryptRequest(encryptRequest(payload))).toEqual(payload);
    }
  });

  it("Q-utf8: encodes the UTF-8 bytes of non-Latin-1 text", () => {
    expect(base64EncodeUtf8(JSON.stringify({ playListName: "قناة" }))).toBe(
      "eyJwbGF5TGlzdE5hbWUiOiLZgtmG2KfYqSJ9",
    );
    expect(decryptRequest(encryptRequest({ playListName: "قناة" }))).toEqual({
      playListName: "قناة",
    });
  });

  it("D-047: non-ASCII text survives the backend's ASCII decoding", () => {
    const payload = { playListName: "قناة Élan 📺", mac_address: "A1:B2:C3:D4:E5:F6" };
    expect(asciiJson({ mac_address: "A1:B2" })).toBe(JSON.stringify({ mac_address: "A1:B2" }));
    const blob = encryptRequest(payload);
    // The backend (ApiController decryptRequest): markers first, filler cut, Base64 → 'ascii'.
    const pos = ALPHABET.indexOf(blob.charAt(0));
    const len = ALPHABET.indexOf(blob.charAt(1));
    const body = blob.slice(2);
    const b64 = body.slice(0, pos) + body.slice(pos + len);
    expect(JSON.parse(Buffer.from(b64, "base64").toString("ascii"))).toEqual(payload);
  });
});

describe("decryptResponse (§3.2)", () => {
  it("vector: markers at the end, filler removed", () => {
    const data =
      "eyJkbZz9Zz9Zz9Zz9Zz9Zz9Zz921haW5zIjpbImFwcC5pYm8tZGV2LmNvbSJdLCJtYWluX2RvbWFpbiI6ImFwaS5pYm8tZGV2LmNvbSJ9fv";
    expect(decryptResponse({ data })).toEqual({
      domains: ["app.ibo-dev.com"],
      main_domain: "api.ibo-dev.com",
    });
  });

  it("decodes UTF-8 text", () => {
    expect(decryptResponse(encryptResponse({ name: "قناة عربية" }))).toEqual({
      name: "قناة عربية",
    });
  });

  it("throws ParseError on a bad envelope", () => {
    expect(() => decryptResponse({ data: "x" })).toThrow(ParseError);
    expect(() => decryptResponse({})).toThrow(ParseError);
    expect(() => decryptResponse({ data: "@@@@@@@@@@@@@@@@" })).toThrow(ParseError);
  });

  it("recognises an envelope only when there is no status key", () => {
    expect(isEnvelope({ data: "abc" })).toBe(true);
    expect(isEnvelope({ data: "abc", status: "success" })).toBe(false);
    expect(isEnvelope({ status: "error" })).toBe(false);
  });
});

describe("toUrlSafe (§3.3)", () => {
  it("replaces + and / and strips = padding", () => {
    expect(toUrlSafe("ab+cd/ef==")).toBe("ab-cd_ef");
  });
});

describe("qrIdentifier (§3.4)", () => {
  it("is OpenSSL-salted AES of the JSON-quoted MAC", () => {
    const id = qrIdentifier("a1:b2:c3:d4:e5:f6");
    expect(id.startsWith("U2FsdGVkX1")).toBe(true);
    const plain = CryptoJS.AES.decrypt(id, config.crypto.qrAesPassphrase).toString(
      CryptoJS.enc.Utf8,
    );
    expect(plain).toBe('"a1:b2:c3:d4:e5:f6"');
    expect(qrIdentifier("a1:b2:c3:d4:e5:f6")).not.toBe(id);
  });
});

describe("u_id (§4.1)", () => {
  it("is 6 characters from the look-alike-free alphabet", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateUid()).toMatch(/^[ACDEFHJKMNPQRTUVWXY13479]{6}$/);
    }
  });
});

describe("device id (§2.1, Q-device-id, D-086)", () => {
  it("vector: SHA-256 of the namespaced ANDROID_ID, uppercase, the first two characters RN", () => {
    expect(macFromAndroidId("dd96dec43fb81c97")).toBe("RN:E3:1A:46:33:A5");
  });

  it("always starts with RN, then five hex octets", () => {
    for (const id of ["a", "b", "0000000000000000", "ffffffffffffffff"])
      expect(macFromAndroidId(id)).toMatch(/^RN(:[0-9A-F]{2}){5}$/);
    expect(macFromRandomBytes(Uint8Array.from([0xff, 1, 2, 3, 4, 5]))).toBe("RN:01:02:03:04:05");
  });

  it("adds the prefix to an id saved before D-086, once", () => {
    expect(withPlatformPrefix("3A:E3:1A:46:33:A5")).toBe("RN:E3:1A:46:33:A5");
    expect(withPlatformPrefix("RN:E3:1A:46:33:A5")).toBe("RN:E3:1A:46:33:A5");
  });
});
