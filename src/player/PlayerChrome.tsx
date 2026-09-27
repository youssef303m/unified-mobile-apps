// The full-screen players' system chrome (tech-stack.md): the status and navigation bars hidden,
// and the screen kept on while playing. Orientation follows the route (useRouteOrientation).
import { memo, useEffect } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { NavigationBar } from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";

const KEEP_AWAKE_TAG = "player";

/** tech-stack.md "Keep awake": only while the video plays. */
export function useKeepAwakeWhile(playing: boolean): void {
  useEffect(() => {
    if (!playing) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [playing]);
}

/**
 * Hides the system bars while mounted (immersive full screen). Memoised: the players re-render
 * on every progress event, and each render would apply the bars again.
 */
export const PlayerChrome = memo(function PlayerChrome() {
  return (
    <>
      <StatusBar hidden style="light" />
      <NavigationBar hidden />
    </>
  );
});
