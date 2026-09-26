import { Pressable, StyleSheet, View } from "react-native";
import { Heart } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { artwork, colors, layout, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";
import { Artwork } from "./Artwork";
import { IconButton } from "./IconButton";
import { ProgressBar } from "./ProgressBar";

// ChannelRow (design-system.md §5): the logo (56), the channel number and name, the programme on
// now with a thin progress bar and its times, and a ♥ favourite toggle. Pressed: surface.2. The
// channel playing in the preview is highlighted.
export interface ChannelRowProps {
  name: string;
  number?: number;
  logo?: string;
  now?: { title: string; times: string; progress: number };
  favourite: boolean;
  onToggleFavourite: () => void;
  onPress: () => void;
  onLongPress?: () => void;
  playing?: boolean;
  testID?: string;
}

export function ChannelRow({
  name,
  number,
  logo,
  now,
  favourite,
  onToggleFavourite,
  onPress,
  onLongPress,
  playing = false,
  testID,
}: ChannelRowProps) {
  const { t } = useTranslation();
  const title = number !== undefined ? `${number} ${name}` : name;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={now ? `${title}, ${now.title}` : title}
      accessibilityState={{ selected: playing }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.root, (pressed || playing) && styles.pressed]}
    >
      <View style={styles.logo}>
        <Artwork uri={logo} style={StyleSheet.absoluteFill} contentFit="contain" />
      </View>
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={1} color={playing ? "brandLight" : "primary"}>
          {title}
        </AppText>
        {now ? (
          <>
            <AppText variant="meta" color="secondary" numberOfLines={1}>
              {now.title}
            </AppText>
            <ProgressBar fraction={now.progress / 100} style={styles.progress} />
            <AppText variant="caption" color="tertiary">
              {now.times}
            </AppText>
          </>
        ) : null}
      </View>
      <IconButton
        icon={Heart}
        label={favourite ? t("remove_favorites") : t("add_to_favorite")}
        onPress={onToggleFavourite}
        filled={favourite}
        color={favourite ? colors.brand.light : colors.text.secondary}
        testID={testID ? `${testID}-favourite` : undefined}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingStart: layout.gutter,
    paddingEnd: spacing.xs,
    paddingVertical: spacing.sm,
    minHeight: artwork.channelLogo.height + spacing.lg,
  },
  pressed: { backgroundColor: colors.surface[2] },
  logo: {
    width: artwork.channelLogo.width,
    height: artwork.channelLogo.height,
    borderRadius: radius.card,
    backgroundColor: colors.surface[1],
    overflow: "hidden",
  },
  text: { flex: 1, gap: spacing.xxs },
  progress: { borderRadius: radius.chip, marginVertical: spacing.xxs },
});
