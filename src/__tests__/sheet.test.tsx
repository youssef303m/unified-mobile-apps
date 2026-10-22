// The sheet hook against a stand-in for @gorhom/bottom-sheet's modal that keeps the library's
// quirk: dismissing a modal that has already closed leaves it "dismissing", and it never opens again.
import { useState } from "react";
import { Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Sheet } from "@/components/Sheet";
import { i18n, initI18n } from "@/i18n";

interface FakeModal {
  present: jest.Mock;
  dismiss: jest.Mock;
  status: "initial" | "presented" | "dismissing";
  /** What the library does when the user closes the sheet: it calls the onDismiss prop. */
  userClose: () => void;
  reset: () => void;
}

jest.mock("@gorhom/bottom-sheet", () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual("react");
  const passthrough = ({ children }: { children?: unknown }) => children ?? null;
  const modal = {
    present: jest.fn(),
    dismiss: jest.fn(),
    status: "initial",
    userClose: () => {},
    reset() {
      modal.present.mockClear();
      modal.dismiss.mockClear();
      modal.status = "initial";
      modal.userClose = () => {};
    },
  };
  const BottomSheetModal = forwardRef(
    ({ onDismiss, children }: { onDismiss: () => void; children?: unknown }, ref: unknown) => {
      useImperativeHandle(ref, () => {
        modal.userClose = () => {
          modal.status = "initial";
          onDismiss();
        };
        return {
          present: () => {
            modal.present();
            if (modal.status !== "dismissing") modal.status = "presented";
          },
          dismiss: () => {
            modal.dismiss();
            // A modal that is not presented waits for a close animation that never comes.
            if (modal.status === "presented") modal.userClose();
            else modal.status = "dismissing";
          },
        };
      });
      return children ?? null;
    },
  );
  return {
    __modal: modal,
    BottomSheetModal,
    BottomSheetBackdrop: passthrough,
    BottomSheetFlatList: passthrough,
    BottomSheetScrollView: passthrough,
    BottomSheetView: passthrough,
  };
});

const modal = (jest.requireMock("@gorhom/bottom-sheet") as { __modal: FakeModal }).__modal;

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 800 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

function Harness({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <Text onPress={() => setOpen(true)} testID="open">
        open
      </Text>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Seasons">
        <Text>Inside</Text>
      </Sheet>
    </SafeAreaProvider>
  );
}

describe("Sheet", () => {
  beforeAll(async () => {
    initI18n();
    await i18n.changeLanguage("en");
  });

  beforeEach(() => modal.reset());

  it("opens again after the user dismissed it without choosing anything", async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByTestId("open"));
    expect(modal.present).toHaveBeenCalledTimes(1);

    // A tap on the backdrop or Back: the library closes the sheet and calls onDismiss.
    await act(async () => modal.userClose());
    // The parent hid it; the hook must not dismiss the sheet a second time.
    expect(modal.dismiss).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("open"));
    expect(modal.present).toHaveBeenCalledTimes(2);
    expect(modal.status).toBe("presented");
  });

  it("dismisses an open sheet when its screen goes away", async () => {
    const { unmount } = await render(<Harness initiallyOpen />);
    expect(modal.present).toHaveBeenCalledTimes(1);
    await unmount();
    expect(modal.dismiss).toHaveBeenCalledTimes(1);
  });

  it("does not dismiss a sheet that was never opened when its screen goes away", async () => {
    const { unmount } = await render(<Harness />);
    await unmount();
    expect(modal.dismiss).not.toHaveBeenCalled();
  });
});
