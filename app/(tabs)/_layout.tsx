import type { ColorValue } from "react-native";
import Tabs from "expo-router/js-tabs";
import { Bookmark, Clapperboard, Film, House, Tv, type LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { colors, layout } from "@/theme/tokens";
import { maxFontSizeMultiplier } from "@/theme/typography";

// Placeholder tab bar (M0). The design-system TabBar component replaces it in M4.
function tabIcon(Icon: LucideIcon) {
  function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return (
      <Icon
        size={layout.iconSize}
        strokeWidth={layout.iconStroke}
        color={color}
        fill={focused ? color : "none"}
      />
    );
  }
  return TabIcon;
}

function TabLabel({ focused, children }: { focused: boolean; children: string }) {
  return (
    <AppText
      variant="caption"
      color={focused ? "primary" : "secondary"}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
    >
      {children}
    </AppText>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarStyle: { backgroundColor: colors.bg.elevated, borderTopColor: colors.border.subtle },
        tabBarLabel: TabLabel,
        sceneStyle: { backgroundColor: colors.bg.base },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: t("mobile_tab_home"), tabBarIcon: tabIcon(House) }}
      />
      <Tabs.Screen name="live" options={{ title: t("live_tv"), tabBarIcon: tabIcon(Tv) }} />
      <Tabs.Screen name="movies" options={{ title: t("movies"), tabBarIcon: tabIcon(Film) }} />
      <Tabs.Screen
        name="series"
        options={{ title: t("series"), tabBarIcon: tabIcon(Clapperboard) }}
      />
      <Tabs.Screen
        name="my-list"
        options={{ title: t("mobile_tab_my_list"), tabBarIcon: tabIcon(Bookmark) }}
      />
    </Tabs>
  );
}
