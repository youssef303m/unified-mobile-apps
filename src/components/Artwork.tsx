import { useState } from "react";
import {
  StyleSheet,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image, type ImageContentFit } from "expo-image";

import { artwork, colors, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";

// Artwork (design-system.md §4): expo-image with memory and disk caching, a 200 ms fade and the
// surface.2 colour as the placeholder. IPTV artwork is often broken or http://, so a failed or
// missing image falls back silently to the brand placeholder, or, with `fallbackTitle`, to a grey
// card with the title (style A posters, docs/decisions.md D-085).
export const POSTER_FALLBACK: ImageSourcePropType = require("../../assets/brand/splash-portrait-720x1280.png");
export const BACKDROP_FALLBACK: ImageSourcePropType = require("../../assets/images/backdrop-placeholder-1920x1080.png");

export interface ArtworkProps {
  uri?: string;
  fallback?: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  fallbackTitle?: string;
  testID?: string;
}

export function Artwork({
  uri,
  fallback = POSTER_FALLBACK,
  style,
  contentFit = "cover",
  fallbackTitle,
  testID,
}: ArtworkProps) {
  // Keyed by URL: a recycled cell with a new URL tries it again.
  const [failed, setFailed] = useState<string | undefined>();
  const usable = uri && failed !== uri ? uri : undefined;
  if (!usable && fallbackTitle !== undefined)
    return (
      // The title is already said by the card around it.
      <View
        style={[styles.titled, style as StyleProp<ViewStyle>]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        testID={testID}
      >
        <AppText variant="meta" color="secondary" numberOfLines={4} style={styles.center}>
          {fallbackTitle}
        </AppText>
      </View>
    );
  return (
    <Image
      testID={testID}
      source={usable ? { uri: usable } : fallback}
      style={[styles.image, style]}
      contentFit={contentFit}
      transition={artwork.imageFadeMs}
      cachePolicy="memory-disk"
      recyclingKey={usable ?? "fallback"}
      onError={() => setFailed(uri)}
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surface[2] },
  titled: {
    backgroundColor: colors.surface[1],
    experimental_backgroundImage: `linear-gradient(160deg, ${colors.surface[2]} 0%, ${colors.card.bg} 100%)`,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
  },
  center: { textAlign: "center" },
});
