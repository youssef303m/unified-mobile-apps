// TalkBack (M8 accessibility pass): whether a screen reader is on. The players keep their
// controls on screen while it is (nothing to focus once they hide), and timed prompts wait.
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (active && value) setEnabled(true);
    });
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", setEnabled);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return enabled;
}
