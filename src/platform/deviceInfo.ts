// The phone's model for the Stalker "Device information" card (current-app-inventory.md §8).
import { Platform } from "react-native";

export function deviceModel(): string {
  const constants = Platform.constants as { Brand?: string; Model?: string };
  return [constants.Brand, constants.Model].filter(Boolean).join(" ");
}
