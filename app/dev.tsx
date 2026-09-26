import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";

import { FIXTURES_ALLOWED } from "@/api/fixtureMode";
import { resetAppData } from "@/session/boot";
import { saveFixtureScenario, saveNetworkMode } from "@/session/network";
import { NETWORK_MODES, type NetworkMode } from "@/session/networkMode";
import { resetTo } from "@/utils/navigation";

type Account = "active" | "trial" | "expired";
const ACCOUNTS: readonly string[] = ["active", "trial", "expired"];

/**
 * Dev and preview builds: `iboplayer://dev?…` drives the fixtures from the Maestro flows
 * (04-build/testing.md §4). `network=` picks the network mode, `reset=1` forgets the app data,
 * `account=` / `demo=1` / `agentsDown=1` set the fixture scenario. With `reset` or `network` the
 * app boots again; otherwise it returns to the screen it was on. Production builds ignore it.
 */
export default function DevLinkScreen() {
  const params = useLocalSearchParams<{
    reset?: string;
    network?: string;
    account?: string;
    demo?: string;
    agentsDown?: string;
  }>();

  useEffect(() => {
    let reboot = false;
    if (FIXTURES_ALLOWED) {
      if (params.network && (NETWORK_MODES as readonly string[]).includes(params.network)) {
        saveNetworkMode(params.network as NetworkMode);
        reboot = true;
      }
      if (params.reset === "1") {
        resetAppData();
        reboot = true;
      }
      saveFixtureScenario({
        ...(params.account && ACCOUNTS.includes(params.account)
          ? { account: params.account as Account }
          : {}),
        ...(params.demo !== undefined ? { demoOnly: params.demo === "1" } : {}),
        ...(params.agentsDown !== undefined ? { agentsDown: params.agentsDown === "1" } : {}),
      });
    }
    if (reboot || !router.canGoBack()) resetTo("/");
    else router.back();
    // Runs once per link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
