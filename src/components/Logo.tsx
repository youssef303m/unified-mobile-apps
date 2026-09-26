import { Image } from "expo-image";

// The in-app logo on dark screens (design-system.md §8: logo-dark-bg-512.png).
const logo = require("../../assets/brand/logo-dark-bg-512.png") as number;

export function Logo({ size = 120 }: { size?: number }) {
  return (
    <Image
      source={logo}
      style={{ width: size, height: size, alignSelf: "center" }}
      contentFit="contain"
      accessibilityLabel="IBOPlayer"
    />
  );
}
