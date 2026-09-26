import { I18nManager } from "react-native";
import { reloadAppAsync } from "expo";
import { getLocales } from "expo-localization";

import { KEYS, getString, remove, setString } from "@/storage/kv";

import { changeLanguage, i18n, initI18n } from "..";

jest.mock("expo", () => ({
  ...jest.requireActual<object>("expo"),
  reloadAppAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-localization", () => ({ getLocales: jest.fn() }));

const mockedLocales = jest.mocked(getLocales);
const mockedReload = jest.mocked(reloadAppAsync);

function deviceLanguage(languageCode: string) {
  mockedLocales.mockReturnValue([
    { languageCode, languageTag: languageCode, textDirection: "ltr" },
  ] as unknown as ReturnType<typeof getLocales>);
}

function setCurrentRtl(isRTL: boolean) {
  Object.defineProperty(I18nManager, "isRTL", { value: isRTL, configurable: true });
}

describe("i18n", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    remove(KEYS.language);
    remove(KEYS.directionReload);
    setCurrentRtl(false);
    deviceLanguage("en");
  });

  it("starts in the device language when none is saved", () => {
    deviceLanguage("ar");
    setCurrentRtl(true);
    expect(initI18n()).toEqual({ language: "ar", needsReload: false });
  });

  it("starts in English when the device language is not available", () => {
    deviceLanguage("fr");
    expect(initI18n()).toEqual({ language: "en", needsReload: false });
  });

  it("starts in the saved language (TV key {P}language)", () => {
    setString(KEYS.language, "ar");
    setCurrentRtl(true);
    expect(initI18n().language).toBe("ar");
  });

  it("R-121: a language change applies immediately; missing keys fall back to English", async () => {
    initI18n();
    await i18n.changeLanguage("ar");
    expect(i18n.t("mobile_tab_home")).toBe("Home");
    expect(i18n.t("movies")).not.toBe("Movies");
  });

  it("asks for one reload when the layout direction must change, and not again", () => {
    setString(KEYS.language, "ar");
    expect(initI18n().needsReload).toBe(true);
    expect(initI18n().needsReload).toBe(false);
  });

  it("persists the choice under gz3rYzUIC7_language and reloads when switching to RTL", async () => {
    initI18n();
    await changeLanguage("ar");
    expect(getString(KEYS.language)).toBe("ar");
    expect(i18n.language).toBe("ar");
    expect(mockedReload).toHaveBeenCalledTimes(1);
  });

  it("does not reload when the direction does not change", async () => {
    initI18n();
    await changeLanguage("en");
    expect(mockedReload).not.toHaveBeenCalled();
  });
});
