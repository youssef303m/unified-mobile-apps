// Copying the device id and key. React Native's own Clipboard module is deprecated but still in
// the installed development build, so no rebuild is needed; expo-clipboard replaces it at the next
// planned native rebuild (docs/decisions.md D-046).
import { Clipboard } from "react-native";

export function copyText(text: string): void {
  Clipboard.setString(text);
}
