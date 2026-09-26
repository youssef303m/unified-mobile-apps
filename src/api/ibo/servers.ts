// Panel server discovery (02-backend/overview.md §4.1-4.2, §4.4).
import { config } from "@/config";

import { decryptResponse, encryptRequest } from "../crypto";
import { FORM_CONTENT_TYPE, formEncode, send, tryParseJson } from "../http";
import { asArray, asObject, str } from "../parse";
import { secureRandom, shuffled, type RandomSource } from "../random";
import { readJson, type KeyValueStore } from "../store";

const P = config.app.storagePrefix;
export const DOMAIN_LISTS_KEY = `${P}domain_lists`;
export const MANUAL_URL_KEY = `${P}_manually_chosen_url`;

export interface DomainList {
  domains: string[];
  main_domain?: string;
}

export type DomainListSource = "agent" | "cache" | "fallback";

function parseDomainList(value: unknown): DomainList | undefined {
  const obj = asObject(value);
  const domains = asArray(obj.domains)
    .map((d) => str(d))
    .filter(Boolean);
  if (domains.length === 0) return undefined;
  return { domains, main_domain: str(obj.main_domain) || undefined };
}

async function askAgent(agentUrl: string, macAddress: string): Promise<DomainList | undefined> {
  try {
    const response = await send({
      url: agentUrl + config.iboBackend.agentPath,
      method: "POST",
      headers: { "Content-Type": FORM_CONTENT_TYPE },
      body: formEncode({ data: encryptRequest({ mac_address: macAddress }) }),
      timeoutMs: config.iboBackend.agentTimeoutMs,
    });
    if (!response.ok) return undefined;
    return parseDomainList(decryptResponse(tryParseJson(response.text)));
  } catch {
    // Network error, timeout, or an undecodable reply: try the next agent (§4.1 step 4).
    return undefined;
  }
}

/**
 * Asks the agent servers in random order, one after another, for the panel domains. When all
 * fail: the last good list (Q-domain-cache), then config `fallbackDomains`. No retry cycle.
 */
export async function fetchDomainList(
  macAddress: string,
  store: KeyValueStore,
  random: RandomSource = secureRandom,
): Promise<{ list: DomainList; source: DomainListSource }> {
  for (const agentUrl of shuffled(config.iboBackend.agentUrls, random)) {
    const list = await askAgent(agentUrl, macAddress);
    if (list) {
      store.set(DOMAIN_LISTS_KEY, JSON.stringify(list));
      return { list, source: "agent" };
    }
  }
  // Q-domain-cache: the TV stores the last reply but never reads it back.
  const cached = parseDomainList(readJson<unknown>(store, DOMAIN_LISTS_KEY));
  if (cached) return { list: cached, source: "cache" };
  // Q-panel-fallback: the static panelUrls are never used, as on TV.
  const { domains, main_domain } = config.iboBackend.fallbackDomains;
  return { list: { domains: [...domains], main_domain }, source: "fallback" };
}

function stripScheme(value: string): string {
  return value.replace(/^https?:\/\//i, "");
}

/** §4.2: bare domains (optionally with scheme and /api) → `https://<host>/api`, agent order. */
export function buildPanelUrls(domains: readonly string[], manualUrl?: string): string[] {
  const all = manualUrl ? [manualUrl, ...domains] : [...domains];
  return all.map((d) => `https://${stripScheme(d.trim()).replace(/\/api\/?$/i, "")}/api`);
}

function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** §4.3: the saved manual URL first, then the panel URLs, without duplicates. */
export function buildFailoverBases(panelUrls: readonly string[], manualUrl?: string): string[] {
  const bases: string[] = [];
  if (manualUrl)
    bases.push(
      `${withScheme(manualUrl)
        .replace(/\/+$/, "")
        .replace(/\/api$/i, "")}/api`,
    );
  for (const url of panelUrls) if (!bases.includes(url)) bases.push(url);
  return bases;
}

/** §4.4 "Try again" on the Server URLs failed screen: the typed domain → one panel base. */
export function panelUrlFromManualInput(input: string): string {
  const cleaned = input
    .trim()
    .replace(/\/api\/?$/i, "")
    .replace(/\/+$/, "");
  return `${withScheme(cleaned)}/api`;
}
