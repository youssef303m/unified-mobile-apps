// The phone's model for the Stalker "Device information" card (current-app-inventory.md §8).
import { Dimensions, Platform } from "react-native";

import type { AnalyticsDevice } from "@/api/analytics";

export function deviceModel(): string {
  const constants = Platform.constants as { Brand?: string; Model?: string };
  return [constants.Brand, constants.Model].filter(Boolean).join(" ");
}

/** The analytics `device` block (02-backend/services.md "Analytics") for this phone. */
export function analyticsDevice(): AnalyticsDevice {
  const constants = Platform.constants as { Model?: string; Release?: string };
  const screen = Dimensions.get("screen");
  const width = Math.round(screen.width * screen.scale);
  const height = Math.round(screen.height * screen.scale);
  return {
    platform: "android",
    modelName: deviceModel() || (constants.Model ?? ""),
    version: constants.Release ?? "",
    sdkVersion: String(Platform.Version),
    screenWidth: width,
    screenHeight: height,
    uhd: Math.max(width, height) >= 3840,
  };
}
