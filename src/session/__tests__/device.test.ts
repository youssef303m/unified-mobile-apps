// The V4 device flow on the fixtures: verification, login, device info and the offline start.
import { FIXTURE_PANEL_DOMAINS } from "@/api/__fixtures__/hosts";
import { FIXTURE_CAPTCHA_CODE, FIXTURE_DEVICE_KEY, FIXTURE_TOKEN } from "@/api/__fixtures__/ibo";
import { setScenario } from "@/api/__fixtures__/scenario";
import { PanelClient } from "@/api/ibo/panel";
import { buildPanelUrls } from "@/api/ibo/servers";
import { memoryStore } from "@/api/store";
import type { KeyValueStore } from "@/api/store";
import { globalKeys } from "@/storage/keys";

import { DeviceFlow, type CaptchaChallenge, type DeviceOutcome, type DeviceStep } from "../device";

const MAC = "3A:E3:1A:46:33:A5";

function newFlow(store: KeyValueStore = memoryStore(), steps: DeviceStep[] = []) {
  const panel = new PanelClient({ panelUrls: buildPanelUrls(FIXTURE_PANEL_DOMAINS), store });
  return new DeviceFlow({
    store,
    panel,
    macAddress: MAC,
    version: "1.0.0",
    onStep: (s) => steps.push(s),
  });
}

function challengeOf(outcome: DeviceOutcome): CaptchaChallenge {
  if (outcome.kind !== "captcha") throw new Error(`expected a captcha, got ${outcome.kind}`);
  return outcome.challenge;
}

describe("first launch: verification", () => {
  it("R-003: without a token the captcha comes first; the right code logs in and loads the account", async () => {
    const store = memoryStore();
    const steps: DeviceStep[] = [];
    const flow = newFlow(store, steps);
    const challenge = challengeOf(await flow.start());
    expect(challenge).toMatchObject({ mode: "recaptcha", svg: expect.stringContaining("<svg") });
    // The u_id is not stored before the backend accepts it (§4.1).
    expect(store.get(globalKeys.v4Uid)).toBeUndefined();

    const outcome = await flow.submit(challenge, FIXTURE_CAPTCHA_CODE);
    expect(outcome).toMatchObject({ kind: "account", offline: false });
    expect(outcome.kind === "account" && outcome.info.device_key).toBe(FIXTURE_DEVICE_KEY);
    expect(store.get(globalKeys.v4Token)).toBe(FIXTURE_TOKEN);
    expect(store.get(globalKeys.v4Uid)).toMatch(/^[ACDEFHJKMNPQRTUVWXY13479]{6}$/);
    // The reply is cached for offline starts (R-004).
    expect(JSON.parse(store.get(globalKeys.apiData) ?? "{}")).toMatchObject({
      device_key: FIXTURE_DEVICE_KEY,
    });
    expect(steps).toEqual(["verifying_device", "registering_device", "account"]);
  });

  it("an empty code asks for one without calling the server", async () => {
    const flow = newFlow();
    const challenge = challengeOf(await flow.start());
    expect(challengeOf(await flow.submit(challenge, "  ")).error).toEqual({ key: "enter_code" });
  });

  it("a wrong code shows the server message with a new captcha", async () => {
    const flow = newFlow();
    const challenge = challengeOf(await flow.start());
    const retry = challengeOf(await flow.submit(challenge, "wrong"));
    expect(retry).toMatchObject({ mode: "recaptcha", error: { message: "Invalid captcha" } });
  });

  it("New Code fetches another captcha", async () => {
    const flow = newFlow();
    const challenge = challengeOf(await flow.start());
    expect(challengeOf(await flow.newCode(challenge)).error).toBeUndefined();
  });

  it("Continue after the website: not verified yet keeps the captcha with a message", async () => {
    const flow = newFlow();
    const challenge = challengeOf(await flow.start());
    const again = challengeOf(await flow.continueAfterWebVerify(challenge));
    expect(again).toMatchObject({ svg: challenge.svg, error: { key: "not_verified_yet" } });
  });

  it("an already verified device logs in straight away", async () => {
    setScenario({ alreadyVerified: true });
    expect((await newFlow().start()).kind).toBe("account");
  });

  it("uid mismatch: the ownership captcha, then the typed uid logs in", async () => {
    setScenario({ uidMismatch: true, alreadyVerified: true });
    const flow = newFlow();
    const challenge = challengeOf(await flow.start());
    expect(challenge).toMatchObject({ mode: "uid", message: expect.stringContaining("mismatch") });
    setScenario({ uidMismatch: false });
    expect((await flow.submit(challenge, "k7mq3x")).kind).toBe("account");
  });
});

describe("returning launch: device info", () => {
  function registered(): KeyValueStore {
    return memoryStore({ [globalKeys.v4Token]: FIXTURE_TOKEN, [globalKeys.v4Uid]: "K7MQ3X" });
  }

  it("a stored token goes straight to device info", async () => {
    const steps: DeviceStep[] = [];
    const outcome = await newFlow(registered(), steps).start();
    expect(outcome.kind).toBe("account");
    expect(steps).toEqual(["account"]);
  });

  it("D-048: device_info's uid captcha (sent with error_code 401) is a captcha, not a re-login", async () => {
    setScenario({ uidMismatch: true });
    const store = registered();
    const challenge = challengeOf(await newFlow(store).start());
    expect(challenge.mode).toBe("uid");
    expect(store.get(globalKeys.v4Token)).toBe(FIXTURE_TOKEN);
  });

  it("R-003: an invalid token is forgotten and verification starts again", async () => {
    const store = memoryStore({ [globalKeys.v4Token]: "stale", [globalKeys.v4Uid]: "K7MQ3X" });
    const challenge = challengeOf(await newFlow(store).start());
    expect(challenge.mode).toBe("recaptcha");
    expect(store.get(globalKeys.v4Token)).toBeUndefined();
  });

  it("R-003: an unknown device (404) is forgotten and verified again", async () => {
    setScenario({ deviceUnknown: true });
    const store = registered();
    expect(challengeOf(await newFlow(store).start()).mode).toBe("recaptcha");
    expect(store.get(globalKeys.v4Token)).toBeUndefined();
  });

  it("R-004: no server answers → the cached account, offline", async () => {
    const store = registered();
    await newFlow(store).start();
    setScenario({ panelsDown: [...FIXTURE_PANEL_DOMAINS] });
    const outcome = await newFlow(store).start();
    expect(outcome).toMatchObject({ kind: "account", offline: true });
    expect(outcome.kind === "account" && outcome.info.device_key).toBe(FIXTURE_DEVICE_KEY);
  });

  it("R-004: no server and no cache → Server URLs failed", async () => {
    setScenario({ panelsDown: [...FIXTURE_PANEL_DOMAINS] });
    expect(await newFlow(registered()).start()).toEqual({ kind: "server_failed" });
    expect(await newFlow().start()).toEqual({ kind: "server_failed" });
  });
});
