// Opening the website (activation, playlist management, verification) in the browser.
import { Linking } from "react-native";

export async function openUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
