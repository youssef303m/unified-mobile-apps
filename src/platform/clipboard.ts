// Copying the device id and key (docs/decisions.md D-046).
import { setStringAsync } from "expo-clipboard";

export function copyText(text: string): void {
  void setStringAsync(text);
}
