import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Bookmark, Clapperboard, Film, House, Inbox, Tv } from "lucide-react-native";

import { AppText } from "@/components/AppText";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { CategoryChips } from "@/components/CategoryChips";
import { ChannelRow } from "@/components/ChannelRow";
import { ContentRow } from "@/components/ContentRow";
import { ContinueCard } from "@/components/ContinueCard";
import { EmptyState } from "@/components/EmptyState";
import { EpisodeRow, type DownloadState } from "@/components/EpisodeRow";
import { HeroBanner } from "@/components/HeroBanner";
import { ListRow } from "@/components/ListRow";
import { LiveNowCard } from "@/components/LiveNowCard";
import { PinPad } from "@/components/PinPad";
import { PosterCard } from "@/components/PosterCard";
import { Screen } from "@/components/Screen";
import { SectionLoader } from "@/components/SectionLoader";
import { Sheet } from "@/components/Sheet";
import { Skeleton } from "@/components/Skeleton";
import { TabBar } from "@/components/TabBar";
import { showToast } from "@/components/Toast";
import { artwork, layout, spacing } from "@/theme/tokens";

// The in-app component gallery (design-system.md §5): every core component in its states, for
// development only. Strings here are sample data, not UI text.
const POSTER = "http://img.fixture.test/poster.jpg";
const noop = () => undefined;
const DOWNLOADS: DownloadState[] = ["idle", "queued", "downloading", "done", "error"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="h3">{title}</AppText>
      {children}
    </View>
  );
}

export default function GalleryScreen() {
  const [chip, setChip] = useState("all");
  const [tab, setTab] = useState("home");
  const [sheet, setSheet] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen title="Component gallery" onBack={() => router.back()} testID="gallery-screen">
      <Section title="PosterCard">
        <View style={styles.row}>
          <PosterCard title="Normal poster" image={POSTER} onPress={noop} />
          <PosterCard title="New" badge="new" onPress={noop} progress={0.4} />
          <PosterCard title="Locked" badge="lock" onPress={noop} />
        </View>
        <View style={styles.row}>
          <PosterCard title="Downloaded" badge="downloaded" onPress={noop} />
          <PosterCard title="Favourite, S2EP5" favourite caption="S2EP5" onPress={noop} />
        </View>
      </Section>
      <Section title="ContinueCard / LiveNowCard">
        <View style={styles.row}>
          <ContinueCard title="Movie in progress" fraction={0.6} onPress={noop} onMenu={noop} />
          <ContinueCard
            title="Series"
            caption="S2:E5"
            fraction={0.2}
            onPress={noop}
            onMenu={noop}
          />
        </View>
        <LiveNowCard
          name="BBC One"
          programme="News at Six"
          progress={45}
          liveLabel="LIVE"
          onPress={noop}
        />
      </Section>
      <Section title="ContentRow (normal, loading, locked)">
        <View style={styles.bleed}>
          <ContentRow
            title="Recently Added"
            data={["a", "b", "c", "d"]}
            keyExtractor={(i) => i}
            itemSize={artwork.poster}
            onSeeAll={noop}
            renderItem={(i) => <PosterCard title={`Poster ${i}`} onPress={noop} />}
          />
          <ContentRow
            title="Loading"
            data={[]}
            keyExtractor={String}
            itemSize={artwork.poster}
            loading
            renderItem={() => <View />}
          />
          <ContentRow
            title="Adult (locked)"
            data={[]}
            keyExtractor={String}
            itemSize={artwork.poster}
            locked
            onSeeAll={noop}
            renderItem={() => <View />}
          />
        </View>
      </Section>
      <Section title="HeroBanner">
        <View style={styles.bleed}>
          <HeroBanner
            title="A featured movie"
            genres={["Drama", "Thriller", "2024"]}
            inMyList={false}
            onToggleMyList={noop}
            onPlay={noop}
            onInfo={noop}
          />
        </View>
      </Section>
      <Section title="CategoryChips">
        <View style={styles.bleed}>
          <CategoryChips
            chips={[
              { key: "all", label: "All categories", dropdown: true, selected: chip === "all" },
              { key: "fav", label: "Favourites", selected: chip === "fav" },
              { key: "adult", label: "Adult", locked: true, selected: chip === "adult" },
            ]}
            onPress={setChip}
          />
        </View>
      </Section>
      <Section title="ChannelRow (normal, playing, favourite)">
        <View style={styles.bleed}>
          <ChannelRow
            name="BBC One"
            number={101}
            now={{ title: "News at Six", times: "18:00 – 18:30", progress: 40 }}
            favourite={false}
            onToggleFavourite={noop}
            onPress={noop}
          />
          <ChannelRow
            name="Sky Sports"
            number={102}
            favourite
            onToggleFavourite={noop}
            onPress={noop}
            playing
          />
        </View>
      </Section>
      <Section title="EpisodeRow (download states)">
        <View style={styles.bleed}>
          {DOWNLOADS.map((state, i) => (
            <EpisodeRow
              key={state}
              number={i + 1}
              title={`Episode (${state})`}
              duration="52m"
              synopsis="Two lines of synopsis for the episode row, cut after the second line."
              progress={i / 5}
              download={{ state, onPress: noop }}
              onPress={noop}
            />
          ))}
        </View>
      </Section>
      <Section title="Buttons">
        <Button label="Play" onPress={noop} />
        <Button label="Brand" variant="brand" onPress={noop} />
        <Button label="Secondary" variant="secondary" onPress={noop} />
        <Button label="Loading" loading onPress={noop} />
        <Button label="Disabled" disabled onPress={noop} />
      </Section>
      <Section title="SettingsRow">
        <ListRow title="With a value" subtitle="On" chevron onPress={noop} />
        <ListRow title="With a switch" toggle={{ value: true, onChange: noop }} />
      </Section>
      <Section title="BottomSheet + PinPad (wrong PIN shakes)">
        <Button label="Open sheet" variant="secondary" onPress={() => setSheet(true)} />
        <PinPad
          key={attempt}
          title="Parental Control"
          message="Enter your PIN"
          error={attempt ? "Wrong PIN" : undefined}
          shake={attempt > 0}
          onComplete={() => setAttempt((a) => a + 1)}
          onCancel={noop}
        />
      </Section>
      <Section title="Toast / Banner / Loader">
        <Button
          label="Show toast"
          variant="secondary"
          onPress={() => showToast({ title: "Title", text: "Toast text" })}
        />
        <Banner lines={["An error banner"]} />
        <Banner
          tone="warning"
          lines={["A warning banner"]}
          action={{ label: "Retry", onPress: noop }}
        />
        <View style={styles.box}>
          <SectionLoader
            section="Movies"
            status={{ state: "loading", fraction: 0.4 }}
            onCancel={noop}
            onRetry={noop}
          />
        </View>
      </Section>
      <Section title="EmptyState / Skeleton">
        <View style={styles.box}>
          <EmptyState
            icon={Inbox}
            title="Nothing here"
            body="An empty state with an action."
            action={{ label: "Action", onPress: noop }}
          />
        </View>
        <View style={styles.row}>
          <Skeleton width={artwork.poster.width} height={artwork.poster.height} />
          <Skeleton width={artwork.continueCard.width} height={artwork.continueCard.height} />
        </View>
      </Section>
      <Section title="TabBar">
        <View style={styles.bleed}>
          <TabBar
            tabs={[
              { key: "home", label: "Home", icon: House },
              { key: "live", label: "Live TV", icon: Tv },
              { key: "movies", label: "Movies", icon: Film },
              { key: "series", label: "Series", icon: Clapperboard },
              { key: "my-list", label: "My List", icon: Bookmark, badge: 2 },
            ]}
            activeKey={tab}
            onPress={setTab}
          />
        </View>
      </Section>
      <Sheet visible={sheet} onClose={() => setSheet(false)} title="A bottom sheet">
        <ListRow title="Option one" onPress={() => setSheet(false)} />
        <ListRow title="Option two" onPress={() => setSheet(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: "row", gap: layout.posterGap, flexWrap: "wrap" },
  bleed: { marginHorizontal: -layout.gutter },
  box: { height: 280 },
});
