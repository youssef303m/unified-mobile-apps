import { useTranslation } from "react-i18next";

import { DevLanguageSwitch } from "@/components/DevLanguageSwitch";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen title={t("mobile_tab_home")}>
      <DevLanguageSwitch />
    </PlaceholderScreen>
  );
}
