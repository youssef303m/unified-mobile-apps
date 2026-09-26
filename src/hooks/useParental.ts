// Parental control for the screens (R-061, R-065, R-066): the ParentalControl on MMKV, synced
// through the legacy changeParentPin call on the boot's panel servers, and askPin(), which opens
// the PIN sheet (PinPrompt) and resolves with whether the right PIN was typed.
import { create } from "zustand";

import { changeParentPin } from "@/api/ibo/client";
import { ParentalControl } from "@/browse/parental";
import { panelClient } from "@/session/boot";
import { session } from "@/session/store";
import { kvStore } from "@/storage/kv";

async function syncPin(pin: string): Promise<boolean> {
  const mac = session.get().macAddress;
  let bases: string[];
  try {
    bases = panelClient().serverBases;
  } catch {
    return false;
  }
  return mac ? changeParentPin(bases, mac, pin) : false;
}

export function parentalControl(): ParentalControl {
  return new ParentalControl(kvStore, syncPin);
}

export type PinPurpose = "category" | "settings";

interface PinRequest {
  id: number;
  purpose: PinPurpose;
  resolve: (ok: boolean) => void;
}

interface PinPromptState {
  request?: PinRequest;
}

export const usePinPrompt = create<PinPromptState>()(() => ({}));
let nextId = 1;

/**
 * R-061 / R-065: asks for the current PIN; resolves true at once when control is off. A new
 * request cancels the previous one.
 */
export function askPin(purpose: PinPurpose = "category"): Promise<boolean> {
  if (!parentalControl().enabled) return Promise.resolve(true);
  usePinPrompt.getState().request?.resolve(false);
  return new Promise((resolve) => {
    usePinPrompt.setState({ request: { id: nextId++, purpose, resolve } });
  });
}

/** Closes the sheet with the result. */
export function finishPin(ok: boolean): void {
  const request = usePinPrompt.getState().request;
  usePinPrompt.setState({ request: undefined });
  request?.resolve(ok);
}

/** Opens an adult category only after the PIN (R-061: every time). */
export async function unlockCategory(categoryIsAdult: boolean): Promise<boolean> {
  return parentalControl().locks(categoryIsAdult) ? askPin("category") : true;
}
