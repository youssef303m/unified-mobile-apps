import { Image } from "expo-image";

// The in-app logo on dark screens (design-system.md §8: logo-dark-bg-512.png). "wide" is the
// horizontal mark for the top bar (style A, docs/decisions.md D-085).
const logo = require("../../assets/brand/logo-dark-bg-512.png") as number;
const wide = require("../../assets/brand/logo-small-239x169.png") as number;
const WIDE_ASPECT = 239 / 169;

export function Logo({
  size = 120,
  align = "center",
  variant = "square",
}: {
  size?: number;
  align?: "center" | "start";
  variant?: "square" | "wide";
}) {
  return (
    <Image
      source={variant === "wide" ? wide : logo}
      style={{
        width: variant === "wide" ? size * WIDE_ASPECT : size,
        height: size,
        alignSelf: align === "center" ? "center" : "flex-start",
      }}
      contentFit="contain"
      accessibilityLabel="IBOPlayer"
    />
  );
}
