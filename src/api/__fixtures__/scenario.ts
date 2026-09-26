// Mutable fixture scenario: tests (and the dev menu later) switch states such as the account
// state or a Stalker token expiry. `resetScenario()` runs after each test.

export type AccountState = "active" | "trial" | "expired";

export interface Scenario {
  /** Every agent server fails (→ cached list or fallbackDomains). */
  agentsDown: boolean;
  /** Panel hosts that fail at the transport level (connection refused). */
  panelsDown: string[];
  account: AccountState;
  /** recaptcha answers already_verified instead of a captcha. */
  alreadyVerified: boolean;
  /** device_login / device_info answer uid_mismatch_captcha. */
  uidMismatch: boolean;
  /** device_info answers error 404 (device unknown). */
  deviceUnknown: boolean;
  /** device_info returns only the demo playlist. */
  demoOnly: boolean;
  /** device_info also lists "Fixture Big" (20,000 channels, a 5,000-movie category). */
  bigPlaylist: boolean;
  /** The Stalker portal rejects the first token after the first content call. */
  stalkerTokenExpires: boolean;
  /** The Stalker portal answers 405 to GET content calls (→ POST). */
  stalkerPostOnly: boolean;
}

const defaults: Scenario = {
  agentsDown: false,
  panelsDown: [],
  account: "active",
  alreadyVerified: false,
  uidMismatch: false,
  deviceUnknown: false,
  demoOnly: false,
  bigPlaylist: false,
  stalkerTokenExpires: false,
  stalkerPostOnly: false,
};

export const scenario: Scenario = { ...defaults, panelsDown: [] };

/** Reset hooks for per-server state (tokens, counters). */
const resetHooks: (() => void)[] = [];
export function onScenarioReset(hook: () => void): void {
  resetHooks.push(hook);
}

export function resetScenario(): void {
  Object.assign(scenario, defaults, { panelsDown: [] });
  for (const hook of resetHooks) hook();
}

export function setScenario(patch: Partial<Scenario>): void {
  Object.assign(scenario, patch);
}
