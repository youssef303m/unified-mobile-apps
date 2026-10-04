import { Pressable, StyleSheet, View } from "react-native";
import { EllipsisVertical } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import type { Playlist } from "@/api/ibo/types";
import { colors, layout, radius, spacing } from "@/theme/tokens";
import { formatDate } from "@/utils/format";
import { playlistTitle } from "@/utils/playlists";

import { AppText } from "./AppText";
import { ListRow } from "./ListRow";

export interface PlaylistRowProps {
  playlist: Playlist;
  subtitle?: string;
  /** The CURRENT / Selected badge text, when this is the active entry. */
  badge?: string;
  onPress: () => void;
  onMore: () => void;
}

/** R-027: "Expires at …", "Unlimited", or nothing when unknown. */
export function useExpiryText(): (p: Playlist) => string | undefined {
  const { t, i18n } = useTranslation();
  return (p) => {
    const value = p.expiration_date;
    if (!value) return undefined;
    if (value === "null" || value.toLowerCase() === "unlimited") return t("msg_unlimited");
    return t("mobile_expires_at", { date: formatDate(value, i18n.language) });
  };
}

// A playlist or portal card: name, subtitle, the active badge and an overflow button (Delete).
export function PlaylistRow({ playlist, subtitle, badge, onPress, onMore }: PlaylistRowProps) {
  const { t } = useTranslation();
  const title = playlistTitle(playlist);
  return (
    <ListRow
      testID={`playlist-${playlist.id}`}
      title={title}
      subtitle={subtitle}
      selected={badge !== undefined}
      onPress={onPress}
      trailing={
        <>
          {badge ? (
            <View style={styles.badge}>
              <AppText variant="caption" color="onPrimary">
                {badge}
              </AppText>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t("mobile_more_options")}: ${title}`}
            onPress={onMore}
            style={styles.more}
            testID={`playlist-${playlist.id}-more`}
          >
            <EllipsisVertical size={layout.iconSize} color={colors.text.secondary} />
          </Pressable>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.brand.vivid,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  more: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
});
