import { StyleSheet, View } from "react-native";
import { EllipsisVertical } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { artwork, colors, radius, spacing } from "@/theme/tokens";
import { maxFontSizeMultiplier } from "@/theme/typography";

import { AppText } from "./AppText";
import { Artwork } from "./Artwork";
import { IconButton } from "./IconButton";
import { PressableScale } from "./PressableScale";
import { ProgressBar } from "./ProgressBar";

// ContinueCard (design-system.md §5): the 16:9 image with a progress bar pinned to the bottom,
// the title and "S2:E5" under it, and a ⋮ button for "Remove from row" and "Details".
export interface ContinueCardProps {
  title: string;
  image?: string;
  /** 0…1 */
  fraction: number;
  caption?: string;
  width?: number;
  onPress: () => void;
  onMenu: () => void;
  testID?: string;
}

const MENU_ICON = 20;

export function ContinueCard({
  title,
  image,
  fraction,
  caption,
  width = artwork.continueCard.width,
  onPress,
  onMenu,
  testID,
}: ContinueCardProps) {
  const { t } = useTranslation();
  const height = width / artwork.continueCard.aspect;
  return (
    <View style={{ width }} testID={testID}>
      <PressableScale accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
        <View style={[styles.image, { width, height }]}>
          <Artwork uri={image} style={StyleSheet.absoluteFill} />
          <ProgressBar fraction={fraction} style={styles.progress} />
        </View>
      </PressableScale>
      <View style={styles.footer}>
        <View style={styles.text}>
          <AppText variant="meta" numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {title}
          </AppText>
          {caption ? (
            <AppText
              variant="caption"
              color="secondary"
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {caption}
            </AppText>
          ) : null}
        </View>
        <IconButton
          icon={EllipsisVertical}
          label={t("mobile_more_actions")}
          onPress={onMenu}
          size={MENU_ICON}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { borderRadius: radius.poster, overflow: "hidden", backgroundColor: colors.surface[2] },
  progress: { position: "absolute", start: 0, end: 0, bottom: 0 },
  footer: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs },
  text: { flex: 1 },
});
