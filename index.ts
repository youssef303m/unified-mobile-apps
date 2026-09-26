// App entry: polyfills first, then expo-router (docs/decisions.md D-026).
import "./src/platform/polyfills";
import "expo-router/entry";
