import { useState } from "react";
import { useTranslation } from "react-i18next";

import { finishPin, parentalControl, usePinPrompt } from "@/hooks/useParental";

import { PinPad } from "./PinPad";
import { Sheet } from "./Sheet";

// The PIN sheet behind askPin() (R-061, R-065): "Parental Control" / "Enter your PIN"; a wrong PIN
// shakes the dots with "Sorry, parent password does not match." ("Incorrect PIN." on the
// Parental Control screen) and clears them; Cancel or a swipe down returns false.
export function PinPrompt() {
  const { t } = useTranslation();
  const request = usePinPrompt((s) => s.request);
  // Wrong attempts, counted per request (a new request starts at 0).
  const [wrong, setWrong] = useState<{ id: number; count: number }>({ id: 0, count: 0 });
  const attempts = request && wrong.id === request.id ? wrong.count : 0;
  const complete = (pin: string) => {
    if (!request) return;
    if (parentalControl().check(pin)) finishPin(true);
    else setWrong({ id: request.id, count: attempts + 1 });
  };
  const error =
    attempts > 0
      ? request?.purpose === "settings"
        ? t("mobile_incorrect_pin")
        : t("parent_pass_mismatch")
      : undefined;
  return (
    <Sheet
      visible={request !== undefined}
      presentKey={request?.id}
      onClose={() => finishPin(false)}
      testID="pin-sheet"
    >
      {request ? (
        <PinPad
          key={`${request.id}:${attempts}`}
          title={t("parent_control")}
          message={t("enter_your_pin")}
          error={error}
          shake={attempts > 0}
          onComplete={complete}
          onCancel={() => finishPin(false)}
        />
      ) : null}
    </Sheet>
  );
}
