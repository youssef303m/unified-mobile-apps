// Global test setup.

// react-native-mmkv returns its in-memory mock under Jest, but imports Nitro at load time.
// Nitro's native module does not exist in Jest; MMKV never calls it in a test environment.
jest.mock("react-native-nitro-modules", () => ({
  NitroModules: {
    createHybridObject: () => {
      throw new Error("Nitro native modules are not available in tests");
    },
  },
}));

jest.mock("expo-secure-store", () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
});

// Reanimated and Worklets ship Jest mocks; their native modules do not exist in tests.
jest.mock("react-native-worklets", () => jest.requireActual("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => jest.requireActual("react-native-reanimated/mock"));

// @gorhom/bottom-sheet ships a Jest mock (a sheet renders its content inline).
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@gorhom/bottom-sheet/mock"));
// FlashList measures its views, which have no size in Jest; this gives them one (as the library's
// jestSetup.js does; its FlashList replacement points at an export v2 no longer has).
jest.mock("@shopify/flash-list/dist/recyclerview/utils/measureLayout", () => {
  const actual = jest.requireActual("@shopify/flash-list/dist/recyclerview/utils/measureLayout");
  const box = (width: number, height: number) => () => ({ x: 0, y: 0, width, height });
  return {
    ...actual,
    measureParentSize: jest.fn(box(400, 900)),
    measureFirstChildLayout: jest.fn(box(400, 900)),
    measureItemLayout: jest.fn(box(100, 100)),
  };
});

// The player's native modules (M5). The video renders a View that keeps its props, so tests can
// fire its events (onLoad, onProgress, onEnd...) and read what it was given.
jest.mock("react-native-video", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const methods = {
    seek: jest.fn(),
    getCurrentPosition: jest.fn(async () => 0),
    enterPictureInPicture: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  };
  const Video = React.forwardRef(function Video(props: Record<string, unknown>, ref) {
    React.useImperativeHandle(ref, () => methods);
    return React.createElement(View, props);
  });
  return {
    __esModule: true,
    default: Video,
    videoMethods: methods,
    SelectedTrackType: {
      SYSTEM: "system",
      DISABLED: "disabled",
      TITLE: "title",
      LANGUAGE: "language",
      INDEX: "index",
    },
  };
});
jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(async () => undefined),
  unlockAsync: jest.fn(async () => undefined),
  OrientationLock: { DEFAULT: 0, PORTRAIT_UP: 3, LANDSCAPE: 5 },
}));
jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn(async () => 0.5),
  setBrightnessAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));
jest.mock("expo-navigation-bar", () => ({ NavigationBar: () => null }));
jest.mock("react-native-volume-manager", () => ({
  VolumeManager: {
    getVolume: jest.fn(async () => ({ volume: 0.5 })),
    setVolume: jest.fn(async () => undefined),
  },
}));
