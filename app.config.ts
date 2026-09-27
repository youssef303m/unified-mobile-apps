import type { ExpoConfig } from "expo/config";

// colors.bg.base in src/theme/colors.ts (the config loader cannot import app TS modules).
const BG_BASE = "#000000";

const config: ExpoConfig = {
  name: "IBO Player",
  slug: "iboplayer-mobile",
  scheme: "iboplayer",
  version: "1.0.0",
  orientation: "portrait",
  // Q-vector-logo: no vector source exists; the kit's PNGs are used as provided.
  icon: "./assets/brand/icon-1024.png",
  // Dark only in v1 (03-design/design-system.md §1).
  userInterfaceStyle: "dark",
  backgroundColor: BG_BASE,
  android: {
    // Q-package-id: placeholder until the owner confirms it before the first store upload.
    package: "com.iboplayer.mobile",
    adaptiveIcon: {
      foregroundImage: "./assets/brand/adaptive-icon-foreground-1024.png",
      backgroundColor: "#FFFFFF",
    },
    predictiveBackGestureEnabled: false,
    // The encrypted MMKV file must not be restored without its key (secure-store is excluded
    // from backups), and it holds playlist credentials. See docs/decisions.md.
    allowBackup: false,
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-localization",
    "expo-status-bar",
    "expo-image",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        image: "./assets/brand/splash-logo-dark-bg-1024.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: BG_BASE,
      },
    ],
    [
      "react-native-video",
      {
        // N-05 Picture-in-Picture and N-06 background audio with media notification controls.
        enableAndroidPictureInPicture: true,
        enableNotificationControls: true,
        enableBackgroundAudio: true,
        // HLS and DASH (player.md §2.6); no Smooth Streaming or RTSP (IPTV does not use them).
        androidExtensions: {
          useExoplayerHls: true,
          useExoplayerDash: true,
          useExoplayerSmoothStreaming: false,
          useExoplayerRtsp: false,
        },
      },
    ],
    // Quick start on raw MPEG-TS live streams (player.md §2.6; docs/decisions.md D-066).
    "./plugins/withTsExtractorFlags",
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 24,
          // Most IPTV servers and artwork hosts are plain http:// (04-build/tech-stack.md).
          usesCleartextTraffic: true,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  // Owner (EAS account) and project for EAS Build (docs/decisions.md D-019).
  owner: "youssef303m",
  extra: {
    eas: {
      projectId: "857544d9-6b6d-4a7b-acc2-ad4c0360eb8f",
    },
  },
};

export default config;
