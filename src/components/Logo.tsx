import { Image } from "expo-image";

// The in-app logo on dark screens (design-system.md §8: logo-dark-bg-512.png).
const logo = require("../../assets/brand/logo-dark-bg-512.png") as number;

export function Logo({
  size = 120,
  align = "center",
}: {
  size?: number;
  align?: "center" | "start";
}) {
  return (
    <Image
      source={logo}
      style={{ width: size, height: size, alignSelf: align === "center" ? "center" : "flex-start" }}
      contentFit="contain"
      accessibilityLabel="IBOPlayer"
    />
  );
}
