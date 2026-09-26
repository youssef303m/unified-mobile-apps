// The persisted network mode (dev and preview builds). Fixtures by default, so development never
// reaches a real server unless someone chooses to.
import { FIXTURES_ALLOWED, setFixtureMode } from "@/api/fixtureMode";
import { getString, KEYS, setString } from "@/storage/kv";

import { parseNetworkMode, type NetworkMode } from "./networkMode";

export const NETWORK_SWITCH_ALLOWED = FIXTURES_ALLOWED;

export function networkMode(): NetworkMode {
  if (!FIXTURES_ALLOWED) return "production";
  return parseNetworkMode(getString(KEYS.networkMode), getString(KEYS.useFixtures));
}

export function applyNetworkSetting(): void {
  setFixtureMode(networkMode() === "fixtures");
}

export function saveNetworkMode(mode: NetworkMode): void {
  if (!FIXTURES_ALLOWED) return;
  setString(KEYS.networkMode, mode);
  setFixtureMode(mode === "fixtures");
}
