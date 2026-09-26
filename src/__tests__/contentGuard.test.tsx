// The content guard (src/navigation/AppStack.tsx, flow 10 at the router level): without a valid
// account nothing past the boot screens opens, and the tabs also need a loaded playlist.
import { Text } from "react-native";
import { router, Slot, Stack } from "expo-router";
import { act, renderRouter } from "expo-router/testing-library";

import { parseDeviceInfo } from "@/api/ibo/client";
import { AppStack } from "@/navigation/AppStack";
import { session } from "@/session/store";

type Href = "/home" | "/account" | "/playlists";

const page = (name: string) =>
  function Page() {
    return <Text>{name}</Text>;
  };

const routes = {
  _layout: AppStack,
  index: page("splash"),
  loading: page("loading"),
  dev: page("dev"),
  "(boot)/_layout": () => <Stack screenOptions={{ headerShown: false }} />,
  "(boot)/expired": page("expired"),
  "(tabs)/_layout": Slot,
  "(tabs)/home": page("home"),
  account: page("account"),
  "playlists/index": page("playlists"),
  "playlists/add": page("add playlist"),
  "portals/index": page("portals"),
  "portals/add": page("add portal"),
};

function account(state: "expired" | "active") {
  const info = parseDeviceInfo({
    expire_date: state === "expired" ? "2020-01-01" : "2099-01-01",
  });
  session.set({ info, accountState: state });
}

// renderRouter runs on fake timers: navigation settles once they are flushed.
async function go(href: Href) {
  await act(async () => {
    router.push(href);
    jest.runOnlyPendingTimers();
  });
}

beforeEach(() => session.reset());
afterEach(() => jest.useRealTimers());

it("R-006 / flow 10: with an expired account, Home, Account and Playlists cannot be opened", async () => {
  account("expired");
  const app = renderRouter(routes, { initialUrl: "/expired" });
  await app;
  for (const href of ["/home", "/account", "/playlists"] as const) {
    await go(href);
    expect(app.getPathname()).not.toBe(href);
  }
});

it("with a valid account, Account and Playlists open; the tabs still need a loaded playlist", async () => {
  account("active");
  const app = renderRouter(routes, { initialUrl: "/expired" });
  await app;
  await go("/playlists");
  expect(app.getPathname()).toBe("/playlists");
  await go("/home");
  expect(app.getPathname()).not.toBe("/home");
});

it("with a loaded playlist, Home opens", async () => {
  account("active");
  session.set({
    active: {
      playlist: { id: "p", playlist_type: "xc", url: "http://p" },
      catalogue: {} as never,
      provider: { type: "m3u" },
    },
  });
  const app = renderRouter(routes, { initialUrl: "/expired" });
  await app;
  await go("/home");
  expect(app.getPathname()).toBe("/home");
});
