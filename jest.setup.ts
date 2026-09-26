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
