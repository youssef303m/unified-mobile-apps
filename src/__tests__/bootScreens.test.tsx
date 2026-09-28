// The boot screens and the content guard (flows 1 and 10 at the component level; the Maestro
// flows in e2e/ run them end to end on a phone).

import { fireEvent, render, screen } from "@testing-library/react-native";

import { parseDeviceInfo } from "@/api/ibo/client";
import type { Playlist } from "@/api/ibo/types";
import { i18n, initI18n } from "@/i18n";
import { session } from "@/session/store";
import { globalKeys } from "@/storage/keys";
import { kvStore } from "@/storage/kv";

import ExpiredScreen from "../../app/(boot)/expired";
import VerifyScreen from "../../app/(boot)/verify";
import WelcomeScreen from "../../app/(boot)/welcome";
import PlaylistsScreen from "../../app/playlists/index";

const MAC = "02:AB:CD:EF:12:34";

function account(state: "expired" | "trial" | "active", playlists: Playlist[] = []) {
  const info = parseDeviceInfo({
    mac_registered: state !== "trial",
    expire_date: state === "expired" ? "2020-01-01" : "2099-01-01",
    is_trial: state === "trial" ? 0 : 2,
    trial_days: 7,
    device_key: "482913",
  });
  session.set({ macAddress: MAC, info, accountState: state, playlists });
}

beforeAll(async () => {
  initI18n();
  await i18n.changeLanguage("en");
});
beforeEach(() => session.reset());

describe("boot screens", () => {
  it("R-006: the Expired screen offers Check again and no Continue", async () => {
    account("expired");
    await render(<ExpiredScreen />);
    expect(screen.getByText("Notice: Trial Period Expired!")).toBeTruthy();
    expect(screen.getByTestId("expired-check-again")).toBeTruthy();
    expect(screen.queryByText("Continue")).toBeNull();
    expect(screen.getByTestId("device-id").props.children).toBe(MAC);
    expect(screen.getByTestId("device-key").props.children).toBe("482913");
  });

  it("R-007: the trial Welcome shows the trial days, the device id and key, and Continue", async () => {
    account("trial");
    await render(<WelcomeScreen />);
    expect(screen.getByTestId("trial-days").props.children).toBe(
      "Trial period notice your complimentary trial ends in 7 days.",
    );
    expect(screen.getByTestId("device-id").props.children).toBe(MAC);
    expect(screen.getByTestId("welcome-continue")).toBeTruthy();
  });

  it("Verify: the captcha image and the error of the last attempt", async () => {
    session.set({
      challenge: {
        mode: "recaptcha",
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="50"></svg>',
        token: "t",
        error: { key: "enter_code" },
      },
    });
    await render(<VerifyScreen />);
    expect(screen.getByTestId("captcha-image")).toBeTruthy();
    expect(screen.getByText("Please enter the code shown above.")).toBeTruthy();
    // "I've verified — Continue" appears only after opening the website.
    expect(screen.queryByTestId("verify-web-continue")).toBeNull();
  });

  it("Playlists: the failed-load banner, and the empty state with the device details", async () => {
    account("trial");
    session.set({ failure: { screen: "playlists", error: "playlist_expired" } });
    await render(<PlaylistsScreen />);
    expect(screen.getByTestId("playlists-error")).toBeTruthy();
    expect(
      screen.getByText(
        "Your playlist subscription has expired. Please contact your IPTV provider. IBOPlayer does not manage or sell playlist subscriptions",
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("playlists-empty")).toBeTruthy();
    expect(screen.getByTestId("device-id").props.children).toBe(MAC);
  });

  it("R-021 / R-020: the Playlists toggles are saved with the TV values", async () => {
    account("active", [{ id: "a", playlist_name: "Alpha", playlist_type: "xc", url: "http://a" }]);
    await render(<PlaylistsScreen />);
    expect(screen.getByText("Alpha")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Auto Switch Playlist"));
    expect(kvStore.get(globalKeys.autoSwitchPlaylist)).toBe("on");
    fireEvent.press(screen.getByLabelText("Start on Playlist"));
    expect(kvStore.get(globalKeys.appInitializationChoice)).toBe("playlist_first");
  });
});
