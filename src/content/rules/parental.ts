// F. Parental control (01-product/business-rules.md R-060…R-066, data-models.md §4).
import { config } from "@/config";

/** The PIN value that turns parental control off. */
export const PIN_OFF = config.defaults.parentalPinOffValue;
export const DEFAULT_PIN = config.defaults.parentalPin;

/** R-060 test A: a category is adult if its name contains xxx, adult or porn. */
export function isAdultCategory(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("xxx") || n.includes("adult") || n.includes("porn");
}

/** R-060 test B (Top Rated / Newly Added / Recently Added only): also "sex". */
export function isHiddenFromRows(name: string): boolean {
  return isAdultCategory(name) || name.toLowerCase().includes("sex");
}

/** R-061: opening an adult category asks for the PIN every time, unless control is off. */
export function needsPin(categoryIsAdult: boolean, pin: string): boolean {
  return categoryIsAdult && pin !== PIN_OFF;
}

/** R-061: the typed PIN must equal the stored one. */
export function pinMatches(typed: string, pin: string): boolean {
  return typed === pin;
}

/** R-062: items from adult categories cannot be favourited (even with control off). */
export function canAddFavourite(categoryIsAdult: boolean): boolean {
  return !categoryIsAdult;
}

/** R-063: adult channels are not recorded as recent; adult progress is not saved. */
export function canRecordHistory(categoryIsAdult: boolean): boolean {
  return !categoryIsAdult;
}

/** R-065: opening Settings → Parental Control asks the PIN when control is on. */
export function settingsNeedPin(pin: string): boolean {
  return pin !== PIN_OFF;
}

export type NewPinError = "fill_all_fields" | "pins_do_not_match" | "must_be_4_digits";

/** R-065: Change PIN needs New + Confirm, equal, 4 digits. */
export function validateNewPin(next: string, confirm: string): NewPinError | undefined {
  if (!next || !confirm) return "fill_all_fields";
  if (next !== confirm) return "pins_do_not_match";
  if (!/^\d{4}$/.test(next)) return "must_be_4_digits";
  return undefined;
}

/** R-010: a `parent_pin` from device info replaces the local PIN at every login. */
export function pinAfterLogin(localPin: string | undefined, serverPin: string | undefined): string {
  return serverPin || localPin || DEFAULT_PIN;
}

/**
 * R-066: a PIN change (or on/off) is saved locally first, then sent to the backend. The result
 * says which toast to show; the local value is kept either way.
 */
export async function changePin(
  save: (pin: string) => void,
  sync: (pin: string) => Promise<boolean>,
  pin: string,
): Promise<"synced" | "saved_on_device_only"> {
  save(pin);
  return (await sync(pin)) ? "synced" : "saved_on_device_only";
}
