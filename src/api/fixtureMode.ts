// The "use fixtures" dev toggle (04-build/testing.md §1, release.md): available in
// development and preview builds, compiled out of production (the condition is constant there,
// so the fixture servers are never bundled).
import { resetTransport, setTransport } from "./http";

export const FIXTURES_ALLOWED = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_FIXTURES === "1";

let active = false;

export function setFixtureMode(enabled: boolean): void {
  if (!FIXTURES_ALLOWED) return;
  active = enabled;
  if (enabled) {
    // A lazy require keeps the fixture servers out of production bundles.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lazy = require("./fixtureTransport") as typeof import("./fixtureTransport");
    setTransport(lazy.fixtureTransport);
  } else {
    resetTransport();
  }
}

/** Dev and preview builds: change the fixture servers' scenario (e2e flows, via the dev link). */
export function setFixtureScenario(
  patch: Partial<import("./__fixtures__/scenario").Scenario>,
): void {
  if (!FIXTURES_ALLOWED) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lazy = require("./__fixtures__/scenario") as typeof import("./__fixtures__/scenario");
  lazy.setScenario(patch);
}

/**
 * The URL the video player gets: in fixture mode, fixture stream URLs become public test streams
 * (the native player cannot reach `.fixture.test`). Unchanged everywhere else.
 */
export function playbackUrl(url: string): string {
  if (!FIXTURES_ALLOWED || !active) return url;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lazy = require("./__fixtures__/playback") as typeof import("./__fixtures__/playback");
  return lazy.fixtureStreamFor(url) ?? url;
}
