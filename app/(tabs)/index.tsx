import { useTranslation } from "react-i18next";

import { DevFixturesSwitch } from "@/components/DevFixturesSwitch";
import { DevLanguageSwitch } from "@/components/DevLanguageSwitch";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen title={t("mobile_tab_home")}>
      <DevLanguageSwitch />
      <DevFixturesSwitch />
    </PlaceholderScreen>
  );
}
