// Portal URL handling, STB profiles and identity values (02-backend/stalker.md §1-2).
import { sha1Hex } from "../crypto";
import { randomBytes, secureRandom, type RandomSource } from "../random";

const STRIP = [
  /\/c\/server\/load\.php.*$/i,
  /\/stalker_portal\/server\/load\.php.*$/i,
  /\/portal\/server\/load\.php.*$/i,
  /\/ministra\/server\/load\.php.*$/i,
  /\/ministra\/server\/api\.php.*$/i,
  /\/server\/load\.php.*$/i,
  /\/magLoad\.php.*$/i,
  /\/load\.php.*$/i,
  /\/c\/server\/?$/i,
  /\/stalker_portal\/server\/?$/i,
  /\/portal\/server\/?$/i,
  /\/ministra\/server\/?$/i,
  /\/ministra\/?$/i,
  /\/server\/?$/i,
  /\/stalker_portal\/?$/i,
  /\/portal\/?$/i,
  /\/c\/?$/i,
  /\?.*$/,
  /\/+$/,
];

export function normalizePortalUrl(url: string): string {
  return STRIP.reduce((u, re) => u.replace(re, ""), (url || "").trim());
}

/** `scheme://host[:port]` of the normalised URL, or undefined ("Invalid portal URL"). */
export function portalOrigin(url: string): string | undefined {
  return /^https?:\/\/[^/]+/i.exec(normalizePortalUrl(url))?.[0];
}

/** absUrl: http(s) kept; "/x" and "x" resolved against the portal origin. */
export function absUrl(value: string, origin: string): string {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith("/") ? origin + value : `${origin}/${value}`;
}

export const LOADER_PATHS = [
  "/portal.php",
  "/stalker_portal/server/load.php",
  "/portal/server/load.php",
  "/ministra/server/load.php",
  "/ministra/server/api.php",
  "/server/load.php",
  "/c/server/load.php",
  "/mag/server/load.php",
  "/stb/server/load.php",
  "/magLoad.php",
  "/load.php",
  "/mag/server/magload.php",
  "/server/magload.php",
  "/portal/magload.php",
  "/stalker_portal/server/magload.php",
] as const;

export type StbProfileKey = "mag250" | "mag322" | "mag520" | "iboplayer";

export interface StbProfile {
  stbType: string;
  userAgent: string;
  xUserAgent: string;
  ver: string;
}

const ver = (image: string, model: string) =>
  `ImageDescription:%200.2.18-${image};ModelDescription:${model};ETH_MAC:00:00:00:00:00:00;HDMI:1;ScreenWidth:1920;ScreenHeight:1080;`;

export const STB_PROFILES: Record<StbProfileKey, StbProfile> = {
  mag250: {
    stbType: "MAG250",
    userAgent:
      "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 4 rev: 874 Mobile Safari/533.3",
    xUserAgent: "Model: MAG250; Link: Ethernet",
    ver: ver("r12-874", "MAG250"),
  },
  mag322: {
    stbType: "MAG322",
    userAgent:
      "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Mobile Safari/533.3",
    xUserAgent: "Model: MAG322; Link: Ethernet",
    ver: ver("r12-250", "MAG322"),
  },
  mag520: {
    stbType: "MAG520",
    userAgent:
      "Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/68.0.3440.106 Chrome/68.0.3440.106 Safari/537.36 MAG520 stbapp ver: 4",
    xUserAgent: "Model: MAG520; Link: Ethernet",
    ver: ver("r12-254", "MAG520"),
  },
  iboplayer: {
    stbType: "MAG254",
    userAgent:
      "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG254 stbapp ver: 4 rev: 2721 IBOPlayer Mobile Safari/533.3",
    xUserAgent: "Model: IBOPlayer; Link: Ethernet",
    ver: ver("r14-pub-254", "IBOPlayer"),
  },
};

export const HW_VERSION = "2.4.14-4228-g5e21c7f";

/** Unknown key → mag250; the legacy key "stbstalker" is "iboplayer". */
export function profileKey(value: string | undefined): StbProfileKey {
  if (value === "stbstalker") return "iboplayer";
  return value && value in STB_PROFILES ? (value as StbProfileKey) : "mag250";
}

/** Configured profile first, then the rest of mag250/mag322/mag520 (never iboplayer). */
export function profileOrder(configured: StbProfileKey): StbProfileKey[] {
  const fallback: StbProfileKey[] = ["mag250", "mag322", "mag520"];
  return [configured, ...fallback.filter((p) => p !== configured)];
}

export const MAC_PATTERN = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

export interface PortalIdentity {
  mac: string;
  sn: string;
  deviceId: string;
  deviceId2: string;
  signature: string;
  random: string;
}

function rand36(random: RandomSource): string {
  let s = "";
  while (s.length < 8) s += random.int(36).toString(36);
  return s;
}

/** §2.2: identity values computed per connect. */
export function portalIdentity(
  macAddress: string,
  random: RandomSource = secureRandom,
): PortalIdentity {
  const mac = macAddress.trim().toUpperCase();
  const rnd = rand36(random) + rand36(random);
  const deviceId = sha1Hex(mac);
  const deviceId2 = sha1Hex(mac + rnd);
  return {
    mac,
    sn: mac.replace(/:/g, ""),
    deviceId,
    deviceId2,
    signature: sha1Hex(deviceId + deviceId2 + mac),
    random: rnd,
  };
}

/** Phone: no hardware MAC, so a random `00:1A:79:XX:XX:XX`, generated once and stored (§1). */
export function randomVirtualMac(random: RandomSource = secureRandom): string {
  const tail = Array.from(randomBytes(3, random), (b) =>
    b.toString(16).padStart(2, "0").toUpperCase(),
  );
  return `00:1A:79:${tail.join(":")}`;
}

/** The unprefixed storage keys the TV uses for Stalker. */
export const VIRTUAL_MAC_KEY = "stalker_mac";
export const quirksKey = (host: string) =>
  `stalker_quirks_${host.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
