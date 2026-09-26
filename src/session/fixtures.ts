// The persisted "use fixtures" setting (dev and preview builds). On by default, so development
// never reaches the real IBO or IPTV servers unless someone turns it off on purpose.
import { FIXTURES_ALLOWED, setFixtureMode } from "@/api/fixtureMode";
import { getString, KEYS, setString } from "@/storage/kv";

export function isFixtureModeOn(): boolean {
  return FIXTURES_ALLOWED && getString(KEYS.useFixtures) !== "0";
}

export function applyFixtureSetting(): void {
  setFixtureMode(isFixtureModeOn());
}

export function saveFixtureSetting(enabled: boolean): void {
  if (!FIXTURES_ALLOWED) return;
  setString(KEYS.useFixtures, enabled ? "1" : "0");
  setFixtureMode(enabled);
}
