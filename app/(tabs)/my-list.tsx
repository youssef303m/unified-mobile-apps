import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function MyListScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t("mobile_tab_my_list")} />;
}
