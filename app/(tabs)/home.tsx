import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CircleUserRound, ListVideo } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { DevLanguageSwitch } from "@/components/DevLanguageSwitch";
import { DevNetworkSwitch } from "@/components/DevNetworkSwitch";
import { Logo } from "@/components/Logo";
import type { ContentKind } from "@/content/types";
import { categories } from "@/db/queries/catalogue";
import { catalogueDb } from "@/session/boot";
import { useSession } from "@/session/store";
import { colors, layout, radius, spacing } from "@/theme/tokens";

const SECTION_KEYS = { live: "live_tv", movie: "movies", series: "series" } as const;
const PREVIEW_CATEGORIES = 5;

type SectionState =
  { kind: "loading" } | { kind: "ready"; total: number; names: string[] } | { kind: "error" };

// Home placeholder (M3): the playlist chip, the Account avatar, and the first live categories
// of the active playlist, loaded in the background after Home appears (user-flows.md §4 Mobile).
// The rows (N-01) replace the summary in M4.
function useLiveSummary(): SectionState {
  const active = useSession((s) => s.active);
  // Keyed by playlist: a switch shows "loading" until the new summary arrives.
  const [result, setResult] = useState<{ playlistId: string; state: SectionState } | undefined>();
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const kind: ContentKind = "live";
    const playlistId = active.catalogue.playlistId;
    const setState = (state: SectionState) => {
      if (!cancelled) setResult({ playlistId, state });
    };
    (async () => {
      await active.catalogue.ensureSection(kind);
      const rows = await categories(await catalogueDb(), playlistId, kind);
      setState({
        kind: "ready",
        total: rows.length,
        names: rows.slice(0, PREVIEW_CATEGORIES).map((r) => r.category_name),
      });
    })().catch(() => setState({ kind: "error" }));
    return () => {
      cancelled = true;
    };
  }, [active]);
  return result && result.playlistId === active?.catalogue.playlistId
    ? result.state
    : { kind: "loading" };
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const active = useSession((s) => s.active);
  const offline = useSession((s) => s.offline);
  const live = useLiveSummary();
  const name = active?.playlist.playlist_name ?? active?.playlist.portal_name ?? "";
  const section = t(SECTION_KEYS.live);
  return (
    <SafeAreaView style={styles.root} edges={["top"]} testID="home-screen">
      <View style={styles.header}>
        <Logo size={layout.topBarLogoHeight + spacing.md} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("mobile_home_playlist")}: ${name}`}
          onPress={() => router.push("/playlists")}
          style={styles.chip}
          testID="home-playlist-chip"
        >
          <ListVideo size={layout.iconSize - spacing.xs} color={colors.text.primary} />
          <AppText variant="meta" numberOfLines={1} style={styles.chipText}>
            {name}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("account")}
          onPress={() => router.push("/account")}
          style={styles.avatar}
          testID="home-account"
        >
          <CircleUserRound size={layout.iconSize + spacing.xs} color={colors.text.primary} />
        </Pressable>
      </View>
      <View style={styles.body}>
        {offline ? (
          <AppText variant="meta" color="warning">
            {t("mobile_offline_notice")}
          </AppText>
        ) : null}
        <Card title={section}>
          {live.kind === "loading" ? (
            <AppText color="secondary">{t("mobile_home_loading_section", { section })}</AppText>
          ) : null}
          {live.kind === "error" ? (
            <AppText color="danger">{t("msg_data_loading_failed")}</AppText>
          ) : null}
          {live.kind === "ready" ? (
            <>
              <AppText variant="bodyStrong" testID="home-live-count">
                {t("mobile_home_categories", { section, count: live.total })}
              </AppText>
              {live.names.map((n) => (
                <AppText key={n} color="secondary">
                  {n}
                </AppText>
              ))}
            </>
          ) : null}
        </Card>
        <AppText color="tertiary">{t("mobile_placeholder_title")}</AppText>
        <DevLanguageSwitch />
        <DevNetworkSwitch />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: layout.gutter,
    minHeight: layout.touchTarget + spacing.sm,
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: layout.touchTarget - spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.text.tertiary,
  },
  chipText: { flex: 1 },
  avatar: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, padding: layout.gutter, gap: spacing.lg },
});
