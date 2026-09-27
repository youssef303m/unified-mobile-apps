import { renderRouter, screen } from "expo-router/testing-library";

import { i18n, initI18n } from "@/i18n";
import { TestProviders } from "@/testing/TestProviders";

import TabsLayout from "../../app/(tabs)/_layout";
import HomeScreen from "../../app/(tabs)/home";
import LiveScreen from "../../app/(tabs)/live";
import MoviesScreen from "../../app/(tabs)/movies";
import MyListScreen from "../../app/(tabs)/my-list";
import SeriesScreen from "../../app/(tabs)/series";

const routes = {
  "(tabs)/_layout": TabsLayout,
  "(tabs)/home": HomeScreen,
  "(tabs)/live": LiveScreen,
  "(tabs)/movies": MoviesScreen,
  "(tabs)/series": SeriesScreen,
  "(tabs)/my-list": MyListScreen,
};

describe("tab bar", () => {
  beforeAll(() => {
    initI18n();
  });

  // renderRouter switches to fake timers.
  afterEach(() => jest.useRealTimers());

  it("shows the five tabs in English, starting on Home", async () => {
    await i18n.changeLanguage("en");
    // expo-router attaches its helpers to the promise RNTL 14's async render returns.
    const router = renderRouter(routes, { initialUrl: "/home", wrapper: TestProviders });
    await router;
    expect(router.getPathname()).toBe("/home");
    for (const label of ["Home", "Live TV", "Movies", "Series", "My List"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("shows the tab bar in Arabic, TV and phone keys alike (D-077)", async () => {
    await i18n.changeLanguage("ar");
    await renderRouter(routes, { initialUrl: "/home", wrapper: TestProviders });
    expect(screen.getAllByText(i18n.t("movies")).length).toBeGreaterThan(0);
    expect(i18n.t("movies")).not.toBe("Movies");
    expect(screen.getAllByText("قائمتي").length).toBeGreaterThan(0);
  });
});
