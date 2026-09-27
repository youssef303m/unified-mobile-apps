// Settings at the component level (flow 8 runs the language change end to end in e2e/): the
// grouped Settings screen, its radio sheets, the Storage confirmations and Subtitle Settings.
import { Alert, type AlertButton } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { i18n, initI18n } from "@/i18n";
import { globalKeys } from "@/storage/keys";
import { kvStore } from "@/storage/kv";
import { subtitlePalettes } from "@/theme/colors";
import { TestProviders } from "@/testing/TestProviders";

import SettingsScreen from "../../app/settings";
import SubtitleSettingsScreen from "../../app/settings/subtitles";

jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock("expo", () => ({
  ...jest.requireActual<object>("expo"),
  reloadAppAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/session/boot", () => ({ clearAppCache: jest.fn(() => Promise.resolve()) }));
jest.mock("@/i18n", () => {
  const actual = jest.requireActual<typeof import("@/i18n")>("@/i18n");
  return { ...actual, changeLanguage: jest.fn(() => Promise.resolve()) };
});

const { reloadAppAsync } = jest.requireMock<{ reloadAppAsync: jest.Mock }>("expo");
const { clearAppCache } = jest.requireMock<{ clearAppCache: jest.Mock }>("@/session/boot");
const { changeLanguage } = jest.requireMock<{ changeLanguage: jest.Mock }>("@/i18n");

beforeAll(async () => {
  initI18n();
  await i18n.changeLanguage("en");
});
beforeEach(() => {
  for (const key of [
    globalKeys.autoPlay,
    globalKeys.liveInitializationChoice,
    globalKeys.subtitleTextColor,
    globalKeys.subtitleSize,
  ])
    kvStore.remove(key);
  jest.clearAllMocks();
});

const renderSettings = () =>
  render(
    <TestProviders>
      <SettingsScreen />
    </TestProviders>,
  );

describe("Settings screen", () => {
  it("toggles autoplay from the row (the player reads the same key)", async () => {
    await renderSettings();
    expect(screen.getByText("Autoplay is off")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("settings-autoplay"));
    expect(kvStore.get(globalKeys.autoPlay)).toBe("on");
    expect(screen.getByText("Autoplay is on")).toBeOnTheScreen();
  });

  it("App Initialization is a radio sheet writing the TV value", async () => {
    await renderSettings();
    await fireEvent.press(screen.getByTestId("settings-app-initialization"));
    await fireEvent.press(screen.getByTestId("app-initialization-sheet-playlist_first"));
    expect(kvStore.get(globalKeys.appInitializationChoice)).toBe("playlist_first");
    kvStore.remove(globalKeys.appInitializationChoice);
  });

  it("R-121 choosing Arabic changes the language", async () => {
    await renderSettings();
    expect(screen.getByTestId("settings-language")).toHaveTextContent(/English/);
    await fireEvent.press(screen.getByTestId("settings-language"));
    await fireEvent.press(screen.getByTestId("language-sheet-ar"));
    expect(changeLanguage).toHaveBeenCalledWith("ar");
  });

  it("R-120 Clear Cache asks first, then wipes and restarts", async () => {
    const alert = jest.spyOn(Alert, "alert");
    await renderSettings();
    await fireEvent.press(screen.getByTestId("settings-clear-cache"));
    const buttons = alert.mock.calls[0]?.[2] as AlertButton[];
    expect(alert.mock.calls[0]?.[0]).toBe("Clear Cache");
    expect(clearAppCache).not.toHaveBeenCalled();
    await act(async () => buttons.find((b) => b.style === "destructive")?.onPress?.());
    expect(clearAppCache).toHaveBeenCalled();
    expect(reloadAppAsync).toHaveBeenCalled();
  });

  it("without a loaded playlist the playlist-only rows are hidden", async () => {
    await renderSettings();
    expect(screen.queryByTestId("settings-hide-categories")).toBeNull();
    expect(screen.queryByTestId("settings-clear-movies")).toBeNull();
    expect(screen.getByTestId("settings-parental")).toBeOnTheScreen();
  });
});

describe("Subtitle Settings", () => {
  it("saves the style the player uses", async () => {
    await render(
      <TestProviders>
        <SubtitleSettingsScreen />
      </TestProviders>,
    );
    await fireEvent.press(screen.getByTestId("subtitle-text-color-yellow"));
    expect(kvStore.get(globalKeys.subtitleTextColor)).toBe(subtitlePalettes.text[2]);
    await fireEvent.press(screen.getByTestId("subtitle-size-plus"));
    expect(kvStore.get(globalKeys.subtitleSize)).toBe("55");
    expect(screen.getByTestId("subtitle-size-value")).toHaveTextContent("55");
  });
});
