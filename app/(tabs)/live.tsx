import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function LiveScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t("live_tv")} />;
}
