import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function MoviesScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t("movies")} />;
}
