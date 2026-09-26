// Two projects (docs/decisions.md D-022):
// - app: React Native code, on the jest-expo preset.
// - api: the platform-free API layer (src/api), in plain Node, where MSW intercepts fetch.
const ignored = ["/node_modules/", "/iboplayer-mobile-kit/", "/android/", "/ios/"];
const alias = { "^@/(.*)$": "<rootDir>/src/$1" };

module.exports = {
  projects: [
    {
      displayName: "app",
      preset: "jest-expo",
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
      testPathIgnorePatterns: [...ignored, "<rootDir>/src/api/"],
      moduleNameMapper: {
        ...alias,
        "^lucide-react-native$":
          "<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js",
      },
    },
    {
      displayName: "api",
      testEnvironment: "node",
      roots: ["<rootDir>/src/api"],
      testPathIgnorePatterns: ignored,
      transform: { "\.[cm]?[jt]sx?$": ["babel-jest", { presets: ["babel-preset-expo"] }] },
      // MSW 2 depends on ESM-only packages; transform those, nothing else in node_modules.
      transformIgnorePatterns: ["/node_modules/(?!(rettime|until-async|@open-draft)/)"],
      setupFilesAfterEnv: ["<rootDir>/src/api/__fixtures__/jest.server.ts"],
      moduleNameMapper: alias,
    },
  ],
};
