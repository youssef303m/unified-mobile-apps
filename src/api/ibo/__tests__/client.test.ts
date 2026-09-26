import { FIXTURE_PANEL_DOMAINS, STALKER_PORTAL_URL, XTREAM_URL } from "../../__fixtures__/hosts";
import {
  FIXTURE_CAPTCHA_CODE,
  FIXTURE_DEVICE_KEY,
  FIXTURE_RECAPTCHA_TOKEN,
  FIXTURE_TOKEN,
  demoPlaylist,
} from "../../__fixtures__/ibo";
import { setScenario } from "../../__fixtures__/scenario";
import { AllServersFailedError, AuthError } from "../../errors";
import { memoryStore } from "../../store";
import {
  changeParentPin,
  deletePlaylist,
  deviceInfo,
  deviceLogin,
  recaptcha,
  registerStararcsDevice,
  reportPlaylistAccount,
  saveOperation,
  savePlaylist,
} from "../client";
import { backgroundImageUrl, qrPlaylistUrl, webVerifyUrl } from "../links";
import { isAuthFailure, PanelClient } from "../panel";
import { convertPlaylistPath, mergeSavedPlaylist } from "../playlists";
import { buildPanelUrls, MANUAL_URL_KEY } from "../servers";
import type { DeviceIdentity, Playlist } from "../types";

const panelUrls = buildPanelUrls(FIXTURE_PANEL_DOMAINS);
const id: DeviceIdentity = { macAddress: "3A:E3:1A:46:33:A5", uid: "K7MQ3X", version: "1.0.0" };
const newPanel = (store = memoryStore()) => new PanelClient({ panelUrls, store });

describe("V4 recaptcha (#2)", () => {
  it("returns the captcha SVG and token", async () => {
    const result = await recaptcha(newPanel(), id.macAddress);
    expect(result).toEqual({
      kind: "captcha",
      captchaSvg: expect.stringContaining("<svg"),
      token: FIXTURE_RECAPTCHA_TOKEN,
    });
  });

  it("reports already_verified", async () => {
    setScenario({ alreadyVerified: true });
    expect(await recaptcha(newPanel(), id.macAddress)).toEqual({ kind: "already_verified" });
  });

  it("sends app_type 'android' in the path and body (Q-app-type)", async () => {
    const panel = newPanel();
    expect(panel.appType).toBe("android");
  });
});

describe("V4 device_login (#3)", () => {
  it("exchanges the typed captcha for a token", async () => {
    const result = await deviceLogin(newPanel(), id, {
      recaptchaCode: FIXTURE_CAPTCHA_CODE,
      recaptchaToken: FIXTURE_RECAPTCHA_TOKEN,
    });
    expect(result).toEqual({ kind: "success", token: FIXTURE_TOKEN });
  });

  it("a wrong captcha is a captcha_error (show it, get a new captcha)", async () => {
    const result = await deviceLogin(newPanel(), id, {
      recaptchaCode: "nope",
      recaptchaToken: FIXTURE_RECAPTCHA_TOKEN,
    });
    expect(result).toEqual({ kind: "captcha_error", message: "Invalid captcha" });
  });

  it("'Continue' without codes before web verification is a captcha_error", async () => {
    expect((await deviceLogin(newPanel(), id)).kind).toBe("captcha_error");
  });

  it("already verified: login without codes succeeds", async () => {
    setScenario({ alreadyVerified: true });
    expect(await deviceLogin(newPanel(), id)).toEqual({ kind: "success", token: FIXTURE_TOKEN });
  });

  it("uid mismatch returns the uid captcha, and the uppercased code passes", async () => {
    setScenario({ uidMismatch: true, alreadyVerified: true });
    const challenge = await deviceLogin(newPanel(), id);
    expect(challenge).toMatchObject({ kind: "uid_captcha", captchaToken: "9a8b7c" });
    const ok = await deviceLogin(newPanel(), id, {
      uidCaptchaCode: "k7mq3x",
      uidCaptchaToken: "9a8b7c",
    });
    expect(ok.kind).toBe("success");
  });
});

describe("V4 device_info (#4)", () => {
  it("active account: registered, future expiry, device key and all playlist types", async () => {
    const result = await deviceInfo(newPanel(), id, FIXTURE_TOKEN);
    if (result.kind !== "ok") throw new Error(result.kind);
    const { info } = result;
    expect(info.mac_registered).toBe(true);
    expect(info.is_trial).toBe(2);
    expect(info.device_key).toBe(FIXTURE_DEVICE_KEY);
    expect(info.parent_pin).toBe("0000");
    expect(info.urls.map((u) => u.playlist_type)).toEqual(["general", "xc", "general", "stalker"]);
    expect(info.urls[1]).toMatchObject({ url: XTREAM_URL, username: "fixture_user" });
    expect(info.urls[3]).toMatchObject({
      portal_address: STALKER_PORTAL_URL,
      stalker_mac_address: "00:1A:79:12:34:56",
    });
    expect(info.raw.device_key).toBe(FIXTURE_DEVICE_KEY);
  });

  it("trial and expired account states", async () => {
    setScenario({ account: "trial" });
    const trial = await deviceInfo(newPanel(), id, FIXTURE_TOKEN);
    expect(trial.kind === "ok" && trial.info).toMatchObject({
      mac_registered: false,
      trial_days: 7,
    });
    setScenario({ account: "expired" });
    const expired = await deviceInfo(newPanel(), id, FIXTURE_TOKEN);
    const today = new Date().toISOString().slice(0, 10);
    expect(expired.kind === "ok" && expired.info.expire_date < today).toBe(true);
  });

  it("demo-only playlist list: the backend sends the demo as a bare URL string", async () => {
    setScenario({ demoOnly: true });
    const result = await deviceInfo(newPanel(), id, FIXTURE_TOKEN);
    expect(result.kind === "ok" && result.info.urls).toEqual([
      { id: "demo", playlist_type: "general", url: demoPlaylist.url },
    ]);
  });

  it("an invalid or missing token is an AuthError (session expired)", async () => {
    await expect(deviceInfo(newPanel(), id, "stale-token")).rejects.toBeInstanceOf(AuthError);
    await expect(deviceInfo(newPanel(), id, null)).rejects.toBeInstanceOf(AuthError);
  });

  it("error 404: the device is unknown", async () => {
    setScenario({ deviceUnknown: true });
    expect(await deviceInfo(newPanel(), id, FIXTURE_TOKEN)).toEqual({ kind: "not_found" });
  });

  it("uid_mismatch_captcha", async () => {
    setScenario({ uidMismatch: true });
    expect((await deviceInfo(newPanel(), id, FIXTURE_TOKEN)).kind).toBe("uid_captcha");
  });
});

describe("server failover (overview.md §4.3)", () => {
  it("moves to the next panel on a transport failure and remembers the working host", async () => {
    setScenario({ panelsDown: [FIXTURE_PANEL_DOMAINS[0] as string] });
    const busy: string[] = [];
    const panel = new PanelClient({
      panelUrls,
      store: memoryStore(),
      onServerBusy: (n, t) => busy.push(`${n}/${t}`),
    });
    expect((await deviceInfo(panel, id, FIXTURE_TOKEN)).kind).toBe("ok");
    expect(panel.workingWebsiteHost).toBe(`https://${FIXTURE_PANEL_DOMAINS[1]}`);
    expect(busy).toEqual(["2/2"]);
  });

  it("all servers down: AllServersFailedError, and a saved manual URL is deleted", async () => {
    setScenario({ panelsDown: [...FIXTURE_PANEL_DOMAINS, "manual.fixture.test"] });
    const store = memoryStore({ [MANUAL_URL_KEY]: "manual.fixture.test" });
    await expect(recaptcha(newPanel(store), id.macAddress)).rejects.toBeInstanceOf(
      AllServersFailedError,
    );
    expect(store.get(MANUAL_URL_KEY)).toBeUndefined();
  });

  it("auth failure detection (device-and-auth.md §4.3)", () => {
    expect(isAuthFailure(401, {})).toBe(true);
    expect(isAuthFailure(200, { error_code: 403 })).toBe(true);
    expect(isAuthFailure(200, { status: "error", message: "Token does not match" })).toBe(true);
    expect(isAuthFailure(200, { status: "error", error_code: 404 })).toBe(false);
  });
});

describe("manage playlists (#5-7)", () => {
  const local: Playlist = {
    id: "non_saved_1727000000",
    playlist_name: "My IPTV",
    playlist_type: "xc",
    url: "http://line.fixture.test:8080",
    username: "john",
    password: "s3cret",
  };

  it("chooses add for non_saved_ ids and update otherwise", () => {
    expect(saveOperation(local)).toBe("add");
    expect(saveOperation({ ...local, id: "65f1" })).toBe("update");
    expect(saveOperation({ ...local, id: "65f1", is_created: true })).toBe("add");
  });

  it("adds a playlist and merges the server id", async () => {
    const result = await savePlaylist(newPanel(), local, id.macAddress, FIXTURE_TOKEN);
    if (result.kind !== "success") throw new Error("save failed");
    const merged = mergeSavedPlaylist(local, result.playlist);
    expect(merged.id).toBe("65f1c0ffee00000000000001");
    expect(merged.origin_url).toBe(local.url);
  });

  it("updates and deletes", async () => {
    const update = await savePlaylist(
      newPanel(),
      { ...local, id: "65f1c0ffee1234567890abcd" },
      id.macAddress,
      FIXTURE_TOKEN,
    );
    expect(update.kind === "success" && update.playlist._id).toBe("65f1c0ffee1234567890abcd");
    expect(
      (await deletePlaylist(newPanel(), "65f1c0ffee1234567890abcd", id.macAddress, FIXTURE_TOKEN))
        .kind,
    ).toBe("success");
  });

  it("an encrypted error with an invalid token is an AuthError", async () => {
    await expect(savePlaylist(newPanel(), local, id.macAddress, "stale")).rejects.toBeInstanceOf(
      AuthError,
    );
  });

  it("converts /playlist/ URLs into Xtream entries", () => {
    const converted = convertPlaylistPath({
      id: "1",
      playlist_type: "general",
      url: "http://h.test/playlist/u1/p1/m3u_plus/ts",
    });
    expect(converted).toMatchObject({
      playlist_type: "xc",
      url: "http://h.test",
      username: "u1",
      password: "p1",
      origin_url: "http://h.test/get.php?username=u1&password=p1&type=m3u_plus&output=ts",
    });
  });
});

describe("device/add, changeParentPin, edit_playlist (#8-10)", () => {
  it("gets the Stararcs token through device/add", async () => {
    expect(await registerStararcsDevice(newPanel(), id.macAddress, FIXTURE_TOKEN)).toBe(
      "st_fixture_token",
    );
  });

  it("changeParentPin succeeds on a live panel, fails when all are down", async () => {
    expect(await changeParentPin(panelUrls, id.macAddress, "1234")).toBe(true);
    setScenario({ panelsDown: [...FIXTURE_PANEL_DOMAINS] });
    expect(await changeParentPin(panelUrls, id.macAddress, "off")).toBe(false);
  });

  it("edit_playlist is fire-and-forget", async () => {
    await expect(
      reportPlaylistAccount(panelUrls, id.macAddress, {
        playlistId: "65f1",
        expirationDate: "1767139200",
        status: "Active",
        auth: "Active",
        fetchedAt: "2026-09-26T08:15:00.000Z",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("website links", () => {
  it("web verify URL carries a URL-safe encrypted payload", () => {
    const url = webVerifyUrl(id, "android", "recaptcha");
    expect(url.startsWith("https://iboplayer.com/device/verify?d=")).toBe(true);
    expect(url).not.toMatch(/[+/=]$/);
  });

  it("QR playlist URL keeps the raw Base64 identifier", () => {
    expect(qrPlaylistUrl(id.macAddress, "xc")).toMatch(
      /^https:\/\/iboplayer\.com\/qr-playlist\?identifier=U2FsdGVkX1.+&type=xc$/,
    );
  });

  it("background image keeps only the file name", () => {
    expect(
      backgroundImageUrl("https://panel1.fixture.test", "https://x/images/upload/125984.png"),
    ).toBe("https://panel1.fixture.test/images/upload/125984.png");
  });
});
