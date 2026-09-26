// Where IBO calls go (docs/decisions.md D-050, D-061). Development and preview builds choose
// between the fixtures (default) and the owner's development backend; they can never reach the
// production backend (the owner's rule: no test data in the real database). Production builds
// always use production. Platform-free (persistence is in network.ts).
import { buildPanelUrls, fetchDomainList } from "@/api/ibo/servers";
import type { KeyValueStore } from "@/api/store";

export type NetworkMode = "fixtures" | "dev_backend" | "production";

/** The modes a development or preview build can choose. */
export type DevNetworkMode = Exclude<NetworkMode, "production">;
export const NETWORK_MODES: readonly DevNetworkMode[] = ["fixtures", "dev_backend"];

/** The owner's development IBO backend (the same API as production, its own database). */
export const DEV_BACKEND_DOMAIN = "iboplayer-backend.youssef-dev.online";

/**
 * The stored mode of a development or preview build. Anything else (an unknown value, a
 * "production" saved before D-061, or the old "use fixtures" switch) means the fixtures.
 */
export function parseNetworkMode(stored: string | undefined): DevNetworkMode {
  return (NETWORK_MODES as readonly string[]).includes(stored ?? "")
    ? (stored as DevNetworkMode)
    : "fixtures";
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
