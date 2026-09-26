import { useState } from "react";
import {
  StyleSheet,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
} from "react-native";
import { Image, type ImageContentFit } from "expo-image";

import { artwork, colors } from "@/theme/tokens";

// Artwork (design-system.md §4): expo-image with memory and disk caching, a 200 ms fade and the
// surface.2 colour as the placeholder. IPTV artwork is often broken or http://, so a failed or
// missing image falls back silently to the brand placeholder.
export const POSTER_FALLBACK: ImageSourcePropType = require("../../assets/brand/splash-portrait-720x1280.png");
export const BACKDROP_FALLBACK: ImageSourcePropType = require("../../assets/images/backdrop-placeholder-1920x1080.png");

export interface ArtworkProps {
  uri?: string;
  fallback?: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  testID?: string;
}

export function Artwork({
  uri,
  fallback = POSTER_FALLBACK,
  style,
  contentFit = "cover",
  testID,
}: ArtworkProps) {
  // Keyed by URL: a recycled cell with a new URL tries it again.
  const [failed, setFailed] = useState<string | undefined>();
  const usable = uri && failed !== uri ? uri : undefined;
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
});
