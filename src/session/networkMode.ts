// Where IBO calls go (docs/decisions.md D-050). Development and preview builds choose between the
// fixtures (default), the owner's development backend, and production; production builds always
// use production. Platform-free (persistence is in network.ts).
import { buildPanelUrls, fetchDomainList } from "@/api/ibo/servers";
import type { KeyValueStore } from "@/api/store";

export type NetworkMode = "fixtures" | "dev_backend" | "production";

export const NETWORK_MODES: readonly NetworkMode[] = ["fixtures", "dev_backend", "production"];

/** The owner's development IBO backend (the same API as production, its own database). */
export const DEV_BACKEND_DOMAIN = "iboplayer-backend.youssef-dev.online";

/** The stored mode; an older "use fixtures" switch set to off meant production. */
export function parseNetworkMode(
  stored: string | undefined,
  legacyUseFixtures: string | undefined,
): NetworkMode {
  if ((NETWORK_MODES as readonly string[]).includes(stored ?? "")) return stored as NetworkMode;
  return legacyUseFixtures === "0" ? "production" : "fixtures";
}

/**
 * The panel URLs for this boot. The dev backend is a single panel and has no agent server
 * (overview.md §4.1 is skipped); the other modes ask the agents (answered by the fixtures in
 * fixture mode).
 */
export async function discoverPanelUrls(
  mode: NetworkMode,
  macAddress: string,
  store: KeyValueStore,
): Promise<string[]> {
  if (mode === "dev_backend") return buildPanelUrls([DEV_BACKEND_DOMAIN]);
  const { list } = await fetchDomainList(macAddress, store);
  return buildPanelUrls(list.domains);
}
