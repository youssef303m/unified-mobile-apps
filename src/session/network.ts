// The persisted network mode (dev and preview builds). Fixtures by default, so development never
// reaches a real server unless someone chooses to.
import { FIXTURES_ALLOWED, setFixtureMode, setFixtureScenario } from "@/api/fixtureMode";
import { getString, KEYS, setString } from "@/storage/kv";

import { parseNetworkMode, type NetworkMode } from "./networkMode";

export const NETWORK_SWITCH_ALLOWED = FIXTURES_ALLOWED;

type ScenarioPatch = Parameters<typeof setFixtureScenario>[0];

export function networkMode(): NetworkMode {
  if (!FIXTURES_ALLOWED) return "production";
  return parseNetworkMode(getString(KEYS.networkMode), getString(KEYS.useFixtures));
}

function savedScenario(): ScenarioPatch {
  try {
    return JSON.parse(getString(KEYS.fixtureScenario) ?? "{}") as ScenarioPatch;
  } catch {
    return {};
  }
}

export function applyNetworkSetting(): void {
  const fixtures = networkMode() === "fixtures";
  setFixtureMode(fixtures);
  if (fixtures) setFixtureScenario(savedScenario());
}

export function saveNetworkMode(mode: NetworkMode): void {
  if (!FIXTURES_ALLOWED) return;
  setString(KEYS.networkMode, mode);
  setFixtureMode(mode === "fixtures");
}

/** The fixture scenario set by the dev link, kept across restarts (the e2e restart checks). */
export function saveFixtureScenario(patch: ScenarioPatch): void {
  if (!FIXTURES_ALLOWED) return;
  setString(KEYS.fixtureScenario, JSON.stringify({ ...savedScenario(), ...patch }));
  setFixtureScenario(patch);
}
