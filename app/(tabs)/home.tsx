import { useEffect, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Film, TriangleAlert } from "lucide-react-native";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import type { HomeRow } from "@/browse/home";
import { removeFromContinueWatching } from "@/browse/library";
import { expirySheetDue, providerExpiryNotice } from "@/browse/settings";
import { AppText } from "@/components/AppText";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { CategoryChips } from "@/components/CategoryChips";
import { EmptyState } from "@/components/EmptyState";
import { ContentRow } from "@/components/ContentRow";
import { ContinueCard } from "@/components/ContinueCard";
import { HeroBanner } from "@/components/HeroBanner";
import { LiveNowCard } from "@/components/LiveNowCard";
import { PosterCard } from "@/components/PosterCard";
import { Sheet } from "@/components/Sheet";
import { openQuickActions } from "@/components/QuickActionsSheet";
import { showToast } from "@/components/Toast";
import { TopBar } from "@/components/TopBar";
import type { ExpiryNotice } from "@/content/rules/app";
import { isNewlyAdded } from "@/content/rules/content";
import { favouriteIds } from "@/content/rules/library";
import type { CatalogueItem } from "@/content/types";
import { refreshBrowse } from "@/hooks/queryClient";
import { browseContext } from "@/hooks/useBrowse";
import { useHome } from "@/hooks/useBrowseQueries";
import { useMovieDetails } from "@/hooks/useDetails";
import { useEpgNow } from "@/hooks/useEpgNow";
import { useIsFavourite, useToggleFavourite } from "@/hooks/useFavourite";
import { prefetchForHome, refreshCatalogue, useSection } from "@/hooks/useSection";
import { useTabBack } from "@/hooks/useTabBack";
import { useSession } from "@/session/store";
import { kvStore } from "@/storage/kv";
import { artwork, colors, layout, spacing } from "@/theme/tokens";
import { openItem, playItem } from "@/utils/content";
import { genreList } from "@/utils/format";
import { playlistTitle, switchPlaylist } from "@/utils/playlists";

const posterSize = { width: artwork.poster.width, height: artwork.poster.height };
const continueSize = { width: artwork.continueCard.width, height: artwork.continueCard.height };
const liveSize = { width: artwork.liveNowCard.width, height: artwork.liveNowCard.height };

const nowSeconds = () => Math.floor(Date.now() / 1000);

// This launch's memory of the expiry notice (user-flows.md §17 Mobile): the sheet opens once per
// playlist, and a dismissed banner stays away until the next launch.
const expirySheetShown = new Set<string>();
const expiryBannerDismissed = new Set<string>();

function expiryLabel(t: TFunction, notice: ExpiryNotice): string {
  if (notice.kind === "hours") return t("msg_a_few_hours");
  if (notice.kind === "unknown") return t("unknown");
  return `${notice.days} ${t(notice.days === 1 ? "day" : "days")}`;
}

function ExpirySheet({
  label,
  visible,
  onClose,
}: {
  label: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} onClose={onClose} title={t("notification")} testID="expiry-sheet">
      <AppText>
        {t("expiry_notice_a")} <AppText variant="bodyStrong">{label}</AppText>
        {t("expiry_notice_b")}
      </AppText>
      <AppText variant="meta" color="secondary">
        {t("expiry_notice_footer")}
      </AppText>
      <Button label={t("dismiss")} onPress={onClose} testID="expiry-dismiss" />
    </Sheet>
  );
}

function quickActions(item: CatalogueItem, onRemoveFromRow?: () => void) {
  // Home rows never hold adult items (N-01).
  openQuickActions({ item, isAdult: false, onInfo: () => openItem(item), onRemoveFromRow });
}

function Poster({ item }: { item: CatalogueItem }) {
  return (
    <PosterCard
      title={item.name}
      image={item.icon}
      badge={item.kind !== "live" && isNewlyAdded(item.added, nowSeconds()) ? "new" : undefined}
      onPress={() => openItem(item)}
      onLongPress={() => quickActions(item)}
      testID={`poster-${item.item_id}`}
    />
  );
}

function LiveCard({ item }: { item: CatalogueItem }) {
  const { t } = useTranslation();
  const now = useEpgNow(item);
  return (
    <LiveNowCard
      name={item.name}
      logo={item.icon}
      programme={now?.current?.title}
      progress={now?.current ? now.progress : undefined}
      liveLabel={t("live")}
      onPress={() => openItem(item)}
      onLongPress={() => quickActions(item)}
      testID={`live-now-${item.item_id}`}
    />
  );
}

function Row({ row }: { row: HomeRow }) {
  const { t } = useTranslation();
  switch (row.style) {
    case "continue": {
      const kind = row.id === "continue_movies" ? "movie" : "series";
      return (
        <ContentRow
          title={t(
            row.id === "continue_movies" ? "continue_watching" : "mobile_row_continue_series",
          )}
          data={row.entries}
          keyExtractor={(e) => e.item.item_id}
          itemSize={continueSize}
          testID={`home-row-${row.id}`}
          renderItem={(e) => {
            const remove = () => {
              const ctx = browseContext();
              if (!ctx) return;
              removeFromContinueWatching(ctx, kind, e.item.item_id);
              refreshBrowse(ctx.catalogue.playlistId);
            };
            return (
              <ContinueCard
                title={e.item.name}
                image={(e.item.data?.backdrop as string | undefined) || e.item.icon}
                fraction={e.fraction}
                caption={
                  e.episode
                    ? t("mobile_episode_short", { s: e.episode.season, e: e.episode.episode })
                    : undefined
                }
                onPress={() => openItem(e.item)}
                onMenu={() => quickActions(e.item, remove)}
                testID={`continue-${e.item.item_id}`}
              />
            );
          }}
        />
      );
    }
    case "live":
      return (
        <ContentRow
          title={t("mobile_row_live_now")}
          data={row.items}
          keyExtractor={(i) => i.item_id}
          itemSize={liveSize}
          onSeeAll={() => router.navigate({ pathname: "/live", params: { category: "favourite" } })}
          testID="home-row-live_now"
          renderItem={(item) => <LiveCard item={item} />}
        />
      );
    case "poster": {
      const title =
        "name" in row
          ? row.name
          : t(
              row.id === "my_list"
                ? "mobile_tab_my_list"
                : row.id === "recent_movies"
                  ? "mobile_row_recent_movies"
                  : "mobile_row_recent_series",
            );
      const seeAll =
        "categoryId" in row
          ? () =>
              router.push({
                pathname: "/category",
                params: { kind: row.kind, type: "category", id: row.categoryId, name: row.name },
              })
          : row.id === "my_list"
            ? () => router.navigate("/my-list")
            : undefined;
      return (
        <ContentRow
          title={title}
          data={row.items}
          keyExtractor={(i) => `${i.kind}:${i.item_id}`}
          itemSize={posterSize}
          onSeeAll={seeAll}
          testID={`home-row-${row.id}`}
          renderItem={(item) => <Poster item={item} />}
        />
      );
    }
  }
}

function SkeletonRow({ title }: { title: string }) {
  return (
    <ContentRow
      title={title}
      data={[]}
      renderItem={() => <View />}
      keyExtractor={() => ""}
      itemSize={posterSize}
      loading
    />
  );
}

function Hero({ item }: { item: CatalogueItem }) {
  const { info } = useMovieDetails(item.kind, item.item_id);
  const inMyList = useIsFavourite(item);
  const toggle = useToggleFavourite();
  const genres = genreList(info.data?.genre ?? (item.data?.genre as string | undefined));
  return (
    <HeroBanner
      title={item.name}
      image={info.data?.backdrop || item.icon}
      genres={genres}
      inMyList={inMyList}
      onToggleMyList={() => toggle(item, false)}
      onPlay={() => void playItem(item)}
      onInfo={() => openItem(item)}
      testID="home-hero"
    />
  );
}

// Home (N-01, screens.md): the hero and the rows, from the local catalogue. Movies and series
// download in the background after Home appears (Q-home-prefetch); pull to refresh re-syncs the
// playlist (N-09).
export default function HomeScreen() {
  const { t } = useTranslation();
  useTabBack(true);
  const insets = useSafeAreaInsets();
  const active = useSession((s) => s.active);
  const offline = useSession((s) => s.offline);
  const home = useHome();
  const movies = useSection("movie", false);
  const series = useSection("series", false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const pid = active?.catalogue.playlistId;
  // R-114: an Xtream playlist expiring within 5 days.
  const notice = providerExpiryNotice(active?.provider);
  const [expirySheet, setExpirySheet] = useState(
    () => notice !== undefined && pid !== undefined && expirySheetDue(expirySheetShown, pid),
  );
  const [bannerDismissed, setBannerDismissed] = useState(
    () => pid !== undefined && expiryBannerDismissed.has(pid),
  );
  const expiry = notice ? expiryLabel(t, notice) : undefined;
  const dismissBanner = () => {
    if (pid) expiryBannerDismissed.add(pid);
    setBannerDismissed(true);
  };
  useEffect(() => {
    if (!pid) return;
    void prefetchForHome(favouriteIds(kvStore, pid, "live").length > 0);
  }, [pid]);

  const syncing = movies.state === "loading" || series.state === "loading";
  const failed = movies.state === "error" || series.state === "error";
  const data = home.data;
  const empty = !data || data.rows.length === 0;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshCatalogue();
    } catch {
      showToast({ text: t("msg_data_loading_failed") });
    } finally {
      setRefreshing(false);
      if (pid) refreshBrowse(pid);
    }
  };

  const playlist = active ? playlistTitle(active.playlist) : "";
  return (
    <View style={styles.root} testID="home-screen">
      <TopBar
        overlay
        scrollY={scrollY}
        onSearch={() => router.push("/search")}
        onAccount={() => router.push("/account")}
      />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            progressViewOffset={insets.top + layout.touchTarget}
            colors={[colors.brand.primary]}
            progressBackgroundColor={colors.surface[1]}
          />
        }
      >
        {data?.hero ? (
          <Hero item={data.hero} />
        ) : (
          <View style={{ height: insets.top + layout.touchTarget + spacing.lg }} />
        )}
        <CategoryChips
          chips={[
            { key: "playlist", label: playlist, dropdown: true, testID: "home-playlist-chip" },
            { key: "live", label: t("live_tv") },
            { key: "movies", label: t("movies") },
            { key: "series", label: t("series") },
          ]}
          onPress={(key) => {
            if (key === "playlist") router.push("/playlists");
            else router.navigate(`/${key as "live" | "movies" | "series"}`);
          }}
        />
        {expiry && !bannerDismissed ? (
          <View style={styles.banners}>
            <Banner
              tone="warning"
              lines={[`${t("playlist_will_expire_in")} ${expiry}`]}
              action={{ label: t("dismiss"), onPress: dismissBanner }}
              testID="home-expiry-banner"
            />
          </View>
        ) : null}
        {offline || failed || active?.offline ? (
          <View style={styles.banners}>
            {offline ? <Banner tone="warning" lines={[t("mobile_offline_notice")]} /> : null}
            {active?.offline ? (
              <Banner
                tone="warning"
                lines={[t("mobile_offline_content")]}
                action={{ label: t("try_again"), onPress: () => switchPlaylist(active.playlist) }}
                testID="home-offline-banner"
              />
            ) : null}
            {failed ? (
              <Banner
                lines={[t("msg_data_loading_failed")]}
                action={{ label: t("try_again"), onPress: () => void prefetchForHome(false) }}
                testID="home-sync-failed"
              />
            ) : null}
          </View>
        ) : null}
        {data?.rows.map((row) => (
          <Row key={row.id} row={row} />
        ))}
        {empty && (syncing || home.isPending) ? (
          <>
            <SkeletonRow title={t("mobile_row_recent_movies")} />
            <SkeletonRow title={t("mobile_row_recent_series")} />
          </>
        ) : null}
        {home.isError ? (
          <EmptyState
            icon={TriangleAlert}
            title={t("msg_data_loading_failed")}
            action={{ label: t("try_again"), onPress: () => void home.refetch() }}
            testID="home-error"
          />
        ) : empty && !syncing && !home.isPending && !failed ? (
          <EmptyState icon={Film} title={t("mobile_home_empty")} testID="home-empty" />
        ) : null}
      </Animated.ScrollView>
      {expiry ? (
        <ExpirySheet label={expiry} visible={expirySheet} onClose={() => setExpirySheet(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  content: { gap: layout.rowGap, paddingBottom: spacing.xxxl },
  banners: { gap: spacing.sm, paddingHorizontal: layout.gutter },
});
