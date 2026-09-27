// Two projects (docs/decisions.md D-022, D-033):
// - app: React Native code, on the jest-expo preset.
// - core: the platform-free layers (src/api, src/browse, src/content, src/db, and the flows in
//   src/player and src/session) in plain Node, where MSW intercepts fetch and better-sqlite3 stands in for
//   expo-sqlite.
const ignored = ["/node_modules/", "/iboplayer-mobile-kit/", "/android/", "/ios/"];
const alias = { "^@/(.*)$": "<rootDir>/src/$1" };
const coreRoots = [
  "<rootDir>/src/api",
  "<rootDir>/src/browse",
  "<rootDir>/src/content",
  "<rootDir>/src/db",
  "<rootDir>/src/player",
  "<rootDir>/src/session",
];

module.exports = {
  projects: [
    {
      displayName: "app",
      preset: "jest-expo",
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
      testPathIgnorePatterns: [...ignored, ...coreRoots],
      moduleNameMapper: {
        ...alias,
        "^lucide-react-native$":
          "<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js",
      },
    },
    {
      displayName: "core",
      testEnvironment: "node",
      roots: coreRoots,
      testPathIgnorePatterns: ignored,
      transform: { "\\.[cm]?[jt]sx?$": ["babel-jest", { presets: ["babel-preset-expo"] }] },
      // MSW 2 depends on ESM-only packages; transform those, nothing else in node_modules.
      transformIgnorePatterns: ["/node_modules/(?!(rettime|until-async|@open-draft)/)"],
      setupFilesAfterEnv: ["<rootDir>/src/api/__fixtures__/jest.server.ts"],
      moduleNameMapper: alias,
    },
  ],
};
