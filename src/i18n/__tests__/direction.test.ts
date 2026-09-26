import { I18nManager } from "react-native";

import { syncLayoutDirection } from "../direction";

function setCurrentRtl(isRTL: boolean) {
  Object.defineProperty(I18nManager, "isRTL", { value: isRTL, configurable: true });
}

describe("syncLayoutDirection", () => {
  const allowRTL = jest.spyOn(I18nManager, "allowRTL").mockImplementation(() => undefined);
  const forceRTL = jest.spyOn(I18nManager, "forceRTL").mockImplementation(() => undefined);

  beforeEach(() => jest.clearAllMocks());

  it("forces RTL for Arabic and asks for a reload from an LTR layout", () => {
    setCurrentRtl(false);
    expect(syncLayoutDirection("ar")).toBe(true);
    expect(allowRTL).toHaveBeenCalledWith(true);
    expect(forceRTL).toHaveBeenCalledWith(true);
  });

  it("disallows RTL for English so an RTL device locale does not mirror it", () => {
    setCurrentRtl(true);
    expect(syncLayoutDirection("en")).toBe(true);
    expect(allowRTL).toHaveBeenCalledWith(false);
    expect(forceRTL).toHaveBeenCalledWith(false);
  });

  it("needs no reload when the layout already matches", () => {
    setCurrentRtl(true);
    expect(syncLayoutDirection("fa")).toBe(false);
    setCurrentRtl(false);
    expect(syncLayoutDirection("fr")).toBe(false);
  });
});
