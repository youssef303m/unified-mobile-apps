// The design-system components (03-design/design-system.md §5) in their states: loading,
// empty, locked/error, normal, pressed/selected and RTL (04-build/testing.md §3).
import { I18nManager } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { House, Inbox, Tv } from "lucide-react-native";

import { CategoryChips } from "@/components/CategoryChips";
import { ChannelRow } from "@/components/ChannelRow";
import { ContentRow } from "@/components/ContentRow";
import { ContinueCard } from "@/components/ContinueCard";
import { EmptyState } from "@/components/EmptyState";
import { EpisodeRow } from "@/components/EpisodeRow";
import { HeroBanner } from "@/components/HeroBanner";
import { LiveNowCard } from "@/components/LiveNowCard";
import { PinPad } from "@/components/PinPad";
import { PosterCard } from "@/components/PosterCard";
import { SectionLoader } from "@/components/SectionLoader";
import { Sheet } from "@/components/Sheet";
import { TabBar } from "@/components/TabBar";
import { i18n, initI18n } from "@/i18n";
import { TestProviders } from "@/testing/TestProviders";
import { artwork } from "@/theme/tokens";

beforeAll(async () => {
  initI18n();
  await i18n.changeLanguage("en");
});

const size = { width: artwork.poster.width, height: artwork.poster.height };

describe("PosterCard", () => {
  it("shows the title, the NEW badge and the progress; press and long press", async () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    await render(
      <PosterCard
        title="Dune"
        badge="new"
        progress={0.5}
        onPress={onPress}
        onLongPress={onLongPress}
      />,
    );
    expect(screen.getByText("Dune")).toBeOnTheScreen();
    expect(screen.getByText("NEW")).toBeOnTheScreen();
    expect(
      screen.getByTestId("poster-progress", { includeHiddenElements: true }),
    ).toHaveAccessibilityValue({ now: 50 });
    await fireEvent.press(screen.getByLabelText("Dune, 50% watched"));
    await fireEvent(screen.getByLabelText("Dune, 50% watched"), "longPress");
    expect(onPress).toHaveBeenCalled();
    expect(onLongPress).toHaveBeenCalled();
  });

  it("R-061: a locked poster shows the lock; a favourite shows the heart", async () => {
    await render(<PosterCard title="Locked" badge="lock" favourite onPress={jest.fn()} />);
    expect(screen.getByTestId("poster-lock")).toBeOnTheScreen();
    expect(screen.getByTestId("poster-favourite")).toBeOnTheScreen();
  });
});

describe("ContinueCard and LiveNowCard", () => {
  it("shows the episode label and opens the menu", async () => {
    const onMenu = jest.fn();
    await render(
      <ContinueCard
        title="The Bear"
        caption="S2:E5"
        fraction={0.3}
        onPress={jest.fn()}
        onMenu={onMenu}
      />,
    );
    expect(screen.getByText("S2:E5")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("More actions"));
    expect(onMenu).toHaveBeenCalled();
  });

  it("shows the live badge and the programme on now", async () => {
    await render(
      <LiveNowCard
        name="BBC One"
        programme="News"
        progress={40}
        liveLabel="LIVE"
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText("LIVE")).toBeOnTheScreen();
    expect(screen.getByLabelText("BBC One, News")).toBeOnTheScreen();
  });
});

describe("ContentRow", () => {
  const renderRow = (props: Partial<Parameters<typeof ContentRow<string>>[0]>) =>
    render(
      <ContentRow<string>
        title="Recently Added"
        data={[]}
        keyExtractor={(i) => i}
        itemSize={size}
        renderItem={(i) => <PosterCard title={i} onPress={jest.fn()} />}
        {...props}
      />,
    );

  it("loading: 4 skeleton cards", async () => {
    await renderRow({ loading: true });
    expect(screen.getAllByTestId("skeleton", { includeHiddenElements: true })).toHaveLength(4);
  });

  it("empty: the row is hidden (N-01)", async () => {
    await renderRow({ testID: "row" });
    expect(screen.queryByTestId("row")).toBeNull();
  });

  it("normal: the cards and See all", async () => {
    const onSeeAll = jest.fn();
    await renderRow({ data: ["One", "Two"], onSeeAll, testID: "row" });
    expect(screen.getByText("One")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("row-see-all"));
    expect(onSeeAll).toHaveBeenCalled();
  });

  it("R-061 locked: the title with a lock and no cards", async () => {
    await renderRow({ data: ["Hidden"], locked: true, onSeeAll: jest.fn(), testID: "row" });
    expect(screen.getByText("Recently Added")).toBeOnTheScreen();
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("RTL: the See all chevron is mirrored", async () => {
    const rtl = jest.replaceProperty(I18nManager, "isRTL", true);
    await renderRow({ data: ["One"], onSeeAll: jest.fn(), testID: "row" });
    expect(JSON.stringify(screen.toJSON())).toContain('"scaleX":-1');
    rtl.restore();
  });
});

describe("HeroBanner, CategoryChips, TabBar", () => {
  it("the hero's My List, Play and Info fire", async () => {
    const onToggle = jest.fn();
    const onPlay = jest.fn();
    const onInfo = jest.fn();
    await render(
      <HeroBanner
        title="Dune"
        genres={["Drama", "2024"]}
        inMyList
        onToggleMyList={onToggle}
        onPlay={onPlay}
        onInfo={onInfo}
      />,
    );
    // Style A: the genres are pills.
    expect(screen.getByText("Drama")).toBeOnTheScreen();
    expect(screen.getByText("2024")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("hero-my-list"));
    await fireEvent.press(screen.getByTestId("hero-play"));
    await fireEvent.press(screen.getByTestId("hero-info"));
    expect([onToggle, onPlay, onInfo].every((f) => f.mock.calls.length === 1)).toBe(true);
    expect(screen.getByLabelText("My List, Remove from Favorites")).toBeOnTheScreen();
  });

  it("the selected chip is marked selected", async () => {
    const onPress = jest.fn();
    await render(
      <CategoryChips
        chips={[
          { key: "a", label: "All", selected: true },
          { key: "b", label: "Sports" },
        ]}
        onPress={onPress}
      />,
    );
    expect(screen.getByTestId("chip-a")).toBeSelected();
    expect(screen.getByTestId("chip-b")).not.toBeSelected();
    await fireEvent.press(screen.getByTestId("chip-b"));
    expect(onPress).toHaveBeenCalledWith("b");
  });

  it("the active tab is selected and a badge is announced", async () => {
    const onPress = jest.fn();
    await render(
      <TestProviders>
        <TabBar
          tabs={[
            { key: "home", label: "Home", icon: House },
            { key: "live", label: "Live TV", icon: Tv, badge: 2 },
          ]}
          activeKey="home"
          onPress={onPress}
        />
      </TestProviders>,
    );
    expect(screen.getByTestId("tab-home")).toBeSelected();
    expect(screen.getByLabelText("Live TV, 2")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("tab-live"));
    expect(onPress).toHaveBeenCalledWith("live");
  });
});

describe("ChannelRow and EpisodeRow", () => {
  it("shows the programme on now; the heart toggles; playing is selected", async () => {
    const onToggle = jest.fn();
    await render(
      <ChannelRow
        name="BBC One"
        number={101}
        now={{ title: "News at Six", times: "18:00 – 18:30", progress: 50 }}
        favourite={false}
        onToggleFavourite={onToggle}
        onPress={jest.fn()}
        playing
        testID="ch"
      />,
    );
    expect(screen.getByText("101 BBC One")).toBeOnTheScreen();
    expect(screen.getByText("18:00 – 18:30")).toBeOnTheScreen();
    expect(screen.getByTestId("ch")).toBeSelected();
    await fireEvent.press(screen.getByTestId("ch-favourite"));
    expect(onToggle).toHaveBeenCalled();
  });

  it("N-03: the download button only when downloads exist, in each state", async () => {
    const { rerender } = await render(
      <EpisodeRow number={1} title="Pilot" duration="52m" onPress={jest.fn()} />,
    );
    expect(screen.queryByLabelText("Download")).toBeNull();
    for (const state of ["idle", "queued", "done", "error"] as const) {
      await rerender(
        <EpisodeRow
          number={1}
          title="Pilot"
          download={{ state, onPress: jest.fn() }}
          onPress={jest.fn()}
        />,
      );
      expect(screen.getByLabelText("Download")).toBeOnTheScreen();
    }
    await rerender(
      <EpisodeRow
        number={1}
        title="Pilot"
        download={{ state: "downloading", onPress: jest.fn() }}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByLabelText("Download")).toBeBusy();
    expect(screen.getByText("1. Pilot")).toBeOnTheScreen();
  });
});

describe("PinPad", () => {
  it("completes after 4 digits; Delete removes one; Cancel", async () => {
    const onComplete = jest.fn();
    const onCancel = jest.fn();
    await render(<PinPad title="Parental Control" onComplete={onComplete} onCancel={onCancel} />);
    for (const key of ["1", "2", "9"]) await fireEvent.press(screen.getByTestId(`pin-key-${key}`));
    await fireEvent.press(screen.getByTestId("pin-key-delete"));
    for (const key of ["3", "4"]) await fireEvent.press(screen.getByTestId(`pin-key-${key}`));
    expect(onComplete).toHaveBeenCalledWith("1234");
    await fireEvent.press(screen.getByTestId("pin-key-cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("R-061 error: the message shows under the dots", async () => {
    await render(
      <PinPad title="Parental Control" error="Wrong PIN" shake onComplete={jest.fn()} />,
    );
    expect(screen.getByTestId("pin-error")).toHaveTextContent("Wrong PIN");
  });

  it("RTL: the delete key's icon is mirrored", async () => {
    const rtl = jest.replaceProperty(I18nManager, "isRTL", true);
    await render(<PinPad title="PIN" onComplete={jest.fn()} />);
    expect(JSON.stringify(screen.toJSON())).toContain('"scaleX":-1');
    rtl.restore();
  });
});

describe("EmptyState, SectionLoader, Sheet", () => {
  it("the empty state's action fires", async () => {
    const onPress = jest.fn();
    await render(
      <EmptyState icon={Inbox} title="Nothing" body="Body" action={{ label: "Go", onPress }} />,
    );
    await fireEvent.press(screen.getByText("Go"));
    expect(onPress).toHaveBeenCalled();
  });

  it("R-050: the loader shows progress and Cancel; after a failure, Try again", async () => {
    const onCancel = jest.fn();
    const onRetry = jest.fn();
    const { rerender } = await render(
      <SectionLoader
        section="Movies"
        status={{ state: "loading", fraction: 0.4 }}
        onCancel={onCancel}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText("Loading Movies... 40%")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("section-cancel"));
    await rerender(
      <SectionLoader
        section="Movies"
        status={{ state: "error", message: "Failed" }}
        onCancel={onCancel}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText("Failed")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("section-retry"));
    expect(onCancel).toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalled();
  });

  it("the sheet shows its title and content", async () => {
    await render(
      <TestProviders>
        <Sheet visible onClose={jest.fn()} title="Sort">
          <EmptyState icon={Inbox} title="Inside" />
        </Sheet>
      </TestProviders>,
    );
    expect(screen.getByText("Sort")).toBeOnTheScreen();
    expect(screen.getByText("Inside")).toBeOnTheScreen();
  });
});
