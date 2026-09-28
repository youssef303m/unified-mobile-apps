import { TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { EmptyState } from "./EmptyState";

// A load that failed (M8 error states): the EmptyState layout with the TV's "Data loading
// failed" and Try again, so no screen is left blank or spinning.
export function ErrorState({
  onRetry,
  title,
  testID,
}: {
  onRetry: () => void;
  title?: string;
  testID?: string;
}) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={TriangleAlert}
      title={title ?? t("msg_data_loading_failed")}
      action={{ label: t("try_again"), onPress: onRetry }}
      testID={testID ?? "error-state"}
    />
  );
}
