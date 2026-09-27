import { StyleSheet, View } from "react-native";
import * as Application from "expo-application";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { ListRow } from "@/components/ListRow";
import { Logo } from "@/components/Logo";
import { Screen } from "@/components/Screen";
import { config } from "@/config";
import { openUrl } from "@/platform/links";
import { spacing } from "@/theme/tokens";

// About (03-design/screens.md, Account): the app's name and version, and the website.
export default function AboutScreen() {
  const { t } = useTranslation();
  const version = Application.nativeApplicationVersion ?? "";
  const build = Application.nativeBuildVersion;
  return (
    <Screen title={t("mobile_about")} onBack={() => router.back()} testID="about-screen">
      <View style={styles.head}>
        <Logo size={96} />
        <AppText variant="h3">{Application.applicationName ?? ""}</AppText>
        <AppText color="secondary" testID="about-version">
          {`${t("app_version")}: ${version}${build ? ` (${build})` : ""}`}
        </AppText>
      </View>
      <ListRow
        title={t("mobile_open_website")}
        subtitle={config.app.websiteUrl.replace(/^https?:\/\//, "")}
        chevron
        onPress={() => void openUrl(config.app.websiteUrl)}
        testID="about-website"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
});
