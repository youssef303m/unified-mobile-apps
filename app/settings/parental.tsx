import { useEffect, useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import type { NewPinError } from "@/content/rules/parental";
import { AppText } from "@/components/AppText";
import { ListRow } from "@/components/ListRow";
import { PinPad } from "@/components/PinPad";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { showToast } from "@/components/Toast";
import { askPin, parentalControl } from "@/hooks/useParental";

type Step = {
  mode: "turn_on" | "change";
  stage: "new" | "confirm";
  first?: string;
  attempt: number;
  error?: string;
};

const PIN_ERRORS: Record<
  NewPinError,
  "msg_please_fill_all_fields" | "msg_new_pins_do_not_match" | "msg_pin_must_be_4_digits"
> = {
  fill_all_fields: "msg_please_fill_all_fields",
  pins_do_not_match: "msg_new_pins_do_not_match",
  must_be_4_digits: "msg_pin_must_be_4_digits",
};

// Settings → Parental Control (R-065, R-066): the current PIN is asked while control is on; the
// switch turns control off, or on with a new PIN; Change PIN asks the new PIN twice. Every change
// is saved on the device first, then sent to the backend.
export default function ParentalControlScreen() {
  const { t } = useTranslation();
  const [unlocked, setUnlocked] = useState(() => !parentalControl().settingsLocked);
  const [enabled, setEnabled] = useState(() => parentalControl().enabled);
  const [step, setStep] = useState<Step | undefined>();

  // R-065: the PIN first; Cancel leaves the screen.
  useEffect(() => {
    if (unlocked) return;
    void askPin("settings").then((ok) => {
      if (ok) setUnlocked(true);
      else router.back();
    });
    // Asked once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savedToast = (saved: "synced" | "saved_on_device_only", success: string) =>
    showToast({ text: saved === "synced" ? success : t("msg_parental_pin_saved_on_device_only") });

  const toggle = async (next: boolean) => {
    if (next) return setStep({ mode: "turn_on", stage: "new", attempt: 0 });
    const saved = await parentalControl().turnOff();
    setEnabled(false);
    savedToast(saved, t("msg_parental_control_turned_off"));
  };

  const complete = async (pin: string) => {
    if (!step) return;
    if (step.stage === "new")
      return setStep({
        ...step,
        stage: "confirm",
        first: pin,
        error: undefined,
        attempt: step.attempt + 1,
      });
    const result = await parentalControl().setPin(step.first ?? "", pin);
    if ("error" in result) {
      setStep({
        mode: step.mode,
        stage: "new",
        attempt: step.attempt + 1,
        error: t(PIN_ERRORS[result.error]),
      });
      return;
    }
    setStep(undefined);
    setEnabled(true);
    savedToast(result.saved, t("msg_parental_control_pin_changed_successfully"));
  };

  if (!unlocked)
    return (
      <Screen title={t("parent_control")} onBack={() => router.back()}>
        {null}
      </Screen>
    );
  return (
    <Screen title={t("parent_control")} onBack={() => router.back()} testID="parental-screen">
      <AppText color="secondary">{t("parent_control_desc")}</AppText>
      <ListRow
        title={t("parent_control")}
        subtitle={enabled ? t("on") : t("off")}
        toggle={{ value: enabled, onChange: (v) => void toggle(v) }}
        testID="parental-toggle"
      />
      {enabled ? (
        <ListRow
          title={t("change_pin")}
          chevron
          onPress={() => setStep({ mode: "change", stage: "new", attempt: 0 })}
          testID="parental-change-pin"
        />
      ) : null}
      <Sheet visible={step !== undefined} onClose={() => setStep(undefined)} testID="new-pin-sheet">
        {step ? (
          <PinPad
            key={step.attempt}
            title={
              step.stage === "new"
                ? step.mode === "turn_on"
                  ? t("mobile_set_parental_pin")
                  : t("new_password")
                : t("confirm_new_password")
            }
            error={step.error}
            shake={step.error !== undefined}
            onComplete={(pin) => void complete(pin)}
            onCancel={() => setStep(undefined)}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}
