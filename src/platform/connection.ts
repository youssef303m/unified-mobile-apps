// The phone's connection for the Wi-Fi only download rule (N-03, docs/decisions.md D-083), from
// @react-native-community/netinfo (04-build/tech-stack.md). "Metered" is Android's own flag, so a
// phone hotspot counts as mobile data and an unmetered Ethernet or Wi-Fi does not.
import NetInfo, { useNetInfo, type NetInfoState } from "@react-native-community/netinfo";

import type { Connection } from "@/downloads/types";

// No reachability pings to a third-party URL: the connection type is all the app needs.
NetInfo.configure({ reachabilityShouldRun: () => false });

export function connectionOf(state: NetInfoState): Connection {
  if (state.isConnected === false || state.type === "none") return "none";
  if (state.isConnected === null || !state.details) return "unknown";
  return state.details.isConnectionExpensive ? "metered" : "unmetered";
}

export function useConnection(): Connection {
  return connectionOf(useNetInfo());
}
