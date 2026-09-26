// Where each session outcome leads, and a navigation reset for flow changes (boot → screen,
// playlist switch → Home). Navigation waits one tick so a Stack.Protected guard that the same
// session update just opened is committed first.
import { router, type Href } from "expo-router";

import type { AfterLoad, BootRoute } from "@/session/boot";

const BOOT_HREF: Record<BootRoute, Href> = {
  terms: "/terms",
  verify: "/verify",
  server_failed: "/server-failed",
  expired: "/expired",
  welcome: "/welcome",
  choose_playlist: "/playlists",
  load: "/loading",
};

const LOAD_HREF: Record<AfterLoad, Href> = {
  home: "/home",
  playlists: "/playlists",
  portals: "/portals",
};

/** Clears the stack and shows `href` as its only screen (Android Back then leaves the app). */
export function resetTo(href: Href): void {
  setTimeout(() => {
    if (router.canDismiss()) router.dismissAll();
    router.replace(href);
  }, 0);
}

export function goToBootRoute(route: BootRoute): void {
  resetTo(BOOT_HREF[route]);
}

export function goAfterLoad(result: AfterLoad): void {
  resetTo(LOAD_HREF[result]);
}
