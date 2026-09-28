import Tabs, { type BottomTabBarProps } from "expo-router/js-tabs";
import { Bookmark, Clapperboard, Film, House, Tv } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { TabBar, type TabItem } from "@/components/TabBar";
import { useDownloads } from "@/downloads";
import { colors } from "@/theme/tokens";

// The bottom tabs (03-design/screens.md): Home · Live TV · Movies · Series · My List, drawn by the
// design-system TabBar.
function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  // design-system.md TabBar: the number of downloads still to finish.
  const running = useDownloads().filter(
    (r) => r.status === "queued" || r.status === "downloading",
  ).length;
  const tabs: TabItem[] = [
    { key: "home", label: t("mobile_tab_home"), icon: House },
    { key: "live", label: t("live_tv"), icon: Tv },
    { key: "movies", label: t("movies"), icon: Film },
    { key: "series", label: t("series"), icon: Clapperboard },
    {
      key: "my-list",
      label: t("mobile_tab_my_list"),
      icon: Bookmark,
      badge: running > 0 ? running : undefined,
    },
  ];
  const active = state.routes[state.index]?.name ?? "home";
  return (
    <TabBar
      tabs={tabs}
      activeKey={active}
      onPress={(key) => {
        const route = state.routes.find((r) => r.name === key);
        if (!route) return;
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });
        if (key !== active && !event.defaultPrevented) navigation.navigate(key);
      }}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg.base } }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="live" />
      <Tabs.Screen name="movies" />
      <Tabs.Screen name="series" />
      <Tabs.Screen name="my-list" />
    </Tabs>
  );
}
