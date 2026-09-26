import { StyleSheet, View } from "react-native";
import { Heart, HeartOff, Info, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { create } from "zustand";

import { isFavouriteItem } from "@/browse/library";
import type { CatalogueItem } from "@/content/types";
import { browseContext } from "@/hooks/useBrowse";
import { useToggleFavourite } from "@/hooks/useFavourite";
import { colors, layout } from "@/theme/tokens";

import { ListRow } from "./ListRow";
import { Sheet } from "./Sheet";

// QuickActionsSheet (design-system.md §5 PosterCard, user-flows.md "Gestures"): a long press on a
// card or channel opens Add to / Remove from Favourites, Remove from Continue Watching (where it
// applies) and Info.
export interface QuickActionsRequest {
  item: CatalogueItem;
  isAdult: boolean;
  onInfo?: () => void;
  onRemoveFromRow?: () => void;
}

const useQuickActions = create<{ request?: QuickActionsRequest }>()(() => ({}));

export function openQuickActions(request: QuickActionsRequest): void {
  useQuickActions.setState({ request });
}

const close = () => useQuickActions.setState({ request: undefined });

export function QuickActionsSheet() {
  const { t } = useTranslation();
  const request = useQuickActions((s) => s.request);
  const toggle = useToggleFavourite();
  const ctx = browseContext();
  const favourite = request && ctx ? isFavouriteItem(ctx, request.item) : false;
  const run = (action: () => void) => () => {
    close();
    action();
  };
  const icon = (Icon: typeof Heart) => (
    <View style={styles.icon}>
      <Icon size={layout.iconSize} color={colors.text.primary} />
    </View>
  );
  return (
    <Sheet
      visible={request !== undefined}
      onClose={close}
      title={request?.item.name}
      testID="quick-actions"
    >
      {request ? (
        <View>
          <ListRow
            title={favourite ? t("remove_favorites") : t("add_to_favorite")}
            leading={icon(favourite ? HeartOff : Heart)}
            onPress={run(() => toggle(request.item, request.isAdult))}
            testID="quick-favourite"
          />
          {request.onRemoveFromRow ? (
            <ListRow
              title={t("mobile_remove_from_continue")}
              leading={icon(X)}
              onPress={run(request.onRemoveFromRow)}
              testID="quick-remove"
            />
          ) : null}
          {request.onInfo ? (
            <ListRow
              title={t("info")}
              leading={icon(Info)}
              onPress={run(request.onInfo)}
              testID="quick-info"
            />
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  icon: { width: layout.touchTarget, alignItems: "center" },
});
