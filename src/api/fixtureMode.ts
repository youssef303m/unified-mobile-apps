// The "use fixtures" dev toggle (04-build/testing.md §1, release.md): available in
// development and preview builds, compiled out of production (the condition is constant there,
// so the fixture servers are never bundled).
import { resetTransport, setTransport } from "./http";

export const FIXTURES_ALLOWED = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_FIXTURES === "1";

export function setFixtureMode(enabled: boolean): void {
  if (!FIXTURES_ALLOWED) return;
  if (enabled) {
    // A lazy require keeps the fixture servers out of production bundles.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lazy = require("./fixtureTransport") as typeof import("./fixtureTransport");
    setTransport(lazy.fixtureTransport);
  } else {
    resetTransport();
  }
}
