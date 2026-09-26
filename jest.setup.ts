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
