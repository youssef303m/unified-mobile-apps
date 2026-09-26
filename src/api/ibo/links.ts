// Website links built by the app, never called by it (ibo-api-reference.md "Website links").
import { config } from "@/config";

import { encryptRequest, qrIdentifier, toUrlSafe } from "../crypto";

import type { DeviceIdentity } from "./types";

const WEBSITE = config.app.websiteUrl;

/** `/device/verify?d=…`: opened in the browser for Q-captcha-phone "Verify on website". */
export function webVerifyUrl(
  id: DeviceIdentity,
  appType: string,
  mode: "recaptcha" | "uid",
): string {
  const d = toUrlSafe(
    encryptRequest({
      mac_address: id.macAddress,
      app_type: appType,
      u_id: id.uid,
      version: id.version,
      mode,
    }),
  );
  return `${WEBSITE}${config.iboBackend.webVerifyPath}?d=${d}`;
}

/** `/qr-playlist?identifier=<AES>&type=<type>`; the Base64 goes in raw, not URL-encoded. */
export function qrPlaylistUrl(macAddress: string, type: "xc" | "general" | "stalker"): string {
  return `${WEBSITE}${config.iboBackend.qrPlaylistPath}?identifier=${qrIdentifier(macAddress)}&type=${type}`;
}

/** `<working panel host>/images/upload/<file>`; the backend's theme URL keeps only its file name. */
export function backgroundImageUrl(workingWebsiteHost: string, themeUrlOrFile: string): string {
  const file = themeUrlOrFile.split("/").pop() ?? themeUrlOrFile;
  return `${workingWebsiteHost}${config.iboBackend.backgroundImagePath}${file}`;
}
