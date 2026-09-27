// Orientation follows the focused route (N-04, tech-stack.md "Orientation"): the players are
// landscape, the EPG guide turns with the phone, every other screen is portrait. One place
// decides it, so returning from a screen opened on top (the guide over the live player) can
// never leave the wrong lock behind.
import { useEffect } from "react";
import { usePathname } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";

export type RouteOrientation = "landscape" | "free" | "portrait";

export function orientationFor(pathname: string): RouteOrientation {
  if (pathname === "/player" || pathname.startsWith("/channel/")) return "landscape";
  if (pathname === "/guide") return "free";
  return "portrait";
}

export function useRouteOrientation(): void {
  const pathname = usePathname();
  const orientation = orientationFor(pathname);
  useEffect(() => {
    const apply =
      orientation === "free"
        ? ScreenOrientation.unlockAsync()
        : ScreenOrientation.lockAsync(
            orientation === "landscape"
              ? ScreenOrientation.OrientationLock.LANDSCAPE
              : ScreenOrientation.OrientationLock.PORTRAIT_UP,
          );
    void apply.catch(() => undefined);
  }, [orientation]);
}
