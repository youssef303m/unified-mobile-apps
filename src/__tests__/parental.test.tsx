// Parental control at the component level (flow 5 runs it end to end in e2e/): the PIN sheet
// behind askPin() and the Parental Control screen.
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { PinPrompt } from "@/components/PinPrompt";
import { ToastHost } from "@/components/Toast";
import { askPin, parentalControl } from "@/hooks/useParental";
import { i18n, initI18n } from "@/i18n";
import { globalKeys } from "@/storage/keys";
import { kvStore } from "@/storage/kv";
import { TestProviders } from "@/testing/TestProviders";

import ParentalControlScreen from "../../app/settings/parental";

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));

beforeAll(async () => {
  initI18n();
  await i18n.changeLanguage("en");
});
beforeEach(() => kvStore.remove(globalKeys.parentPin));

async function typePin(pin: string) {
  for (const digit of pin) await fireEvent.press(screen.getByTestId(`pin-key-${digit}`));
}

describe("PIN sheet (R-061)", () => {
  it("a wrong PIN shows the TV message and clears; the right PIN opens", async () => {
    await render(
      <TestProviders>
        <PinPrompt />
      </TestProviders>,
    );
    let result: Promise<boolean> | undefined;
    await act(async () => {
      result = askPin("category");
    });
    await typePin("1111");
    expect(screen.getByTestId("pin-error")).toHaveTextContent(
      "Sorry, parent password does not match.",
    );
    await typePin("0000");
    await expect(result).resolves.toBe(true);
  });

  it("Cancel returns false", async () => {
    await render(
      <TestProviders>
        <PinPrompt />
      </TestProviders>,
    );
    let result: Promise<boolean> | undefined;
    await act(async () => {
      result = askPin("category");
    });
    await fireEvent.press(screen.getByTestId("pin-key-cancel"));
    await expect(result).resolves.toBe(false);
  });

  it("no PIN is asked while parental control is off", async () => {
    kvStore.set(globalKeys.parentPin, "off");
    await expect(askPin("category")).resolves.toBe(true);
  });
});

describe("Parental Control screen (R-065, R-066)", () => {
  it("changes the PIN (new + confirm); kept on the device when the backend is not reachable", async () => {
    kvStore.set(globalKeys.parentPin, "off");
    await render(
      <TestProviders>
        <ParentalControlScreen />
        <ToastHost />
      </TestProviders>,
    );
    // Turning control on asks for a new PIN twice.
    await fireEvent.press(screen.getByLabelText("Parental Control"));
    await typePin("1234");
    await typePin("4321");
    expect(screen.getByTestId("pin-error")).toHaveTextContent("New PINs do not match");
    await typePin("1234");
    await typePin("1234");
    expect(parentalControl().pin).toBe("1234");
    expect(screen.getByTestId("toast")).toHaveTextContent(/saved on this device only/);
  });
});
