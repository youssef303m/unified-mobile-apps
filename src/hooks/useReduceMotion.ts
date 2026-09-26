// design-system.md §7: honour AccessibilityInfo.isReduceMotionEnabled() (no shimmer, no press
// scale; fades stay).
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      // Only a change re-renders (the default is off).
      if (active && value) setReduce(true);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
