// Parental control state (01-product/business-rules.md R-061, R-065, R-066): the PIN stored
// under the TV key `parent_account_password` ("off" = control off), the checks, and every change
// saved locally first and then sent to the backend.
import type { KeyValueStore } from "@/api/store";
import {
  changePin,
  DEFAULT_PIN,
  needsPin,
  pinMatches,
  PIN_OFF,
  settingsNeedPin,
  validateNewPin,
  type NewPinError,
} from "@/content/rules/parental";
import { globalKeys } from "@/storage/keys";

export type PinSync = (pin: string) => Promise<boolean>;
export type PinChangeResult = { error: NewPinError } | { saved: "synced" | "saved_on_device_only" };

export class ParentalControl {
  constructor(
    private readonly store: KeyValueStore,
    private readonly sync: PinSync,
  ) {}

  /** The stored PIN, or the default "0000" (R-066). */
  get pin(): string {
    return this.store.get(globalKeys.parentPin) || DEFAULT_PIN;
  }

  get enabled(): boolean {
    return this.pin !== PIN_OFF;
  }

  /** R-061: opening this category asks for the PIN (every time). */
  locks(categoryIsAdult: boolean): boolean {
    return needsPin(categoryIsAdult, this.pin);
  }

  /** R-065: the Parental Control screen asks for the current PIN while control is on. */
  get settingsLocked(): boolean {
    return settingsNeedPin(this.pin);
  }

  check(typed: string): boolean {
    return pinMatches(typed, this.pin);
  }

  private save(pin: string): Promise<"synced" | "saved_on_device_only"> {
    return changePin((p) => this.store.set(globalKeys.parentPin, p), this.sync, pin);
  }

  /** R-065: Change PIN, and turning control on, need New + Confirm, equal, 4 digits. */
  async setPin(next: string, confirm: string): Promise<PinChangeResult> {
    const error = validateNewPin(next, confirm);
    if (error) return { error };
    return { saved: await this.save(next) };
  }

  /** Turning control off stores "off" (R-061), synced like a change (R-066). */
  async turnOff(): Promise<"synced" | "saved_on_device_only"> {
    return this.save(PIN_OFF);
  }
}
