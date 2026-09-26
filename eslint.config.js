// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const tseslint = require("typescript-eslint");
const prettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "node_modules/**",
      "iboplayer-mobile-kit/**",
      "android/**",
      "ios/**",
      ".expo/**",
      "coverage/**",
      "expo-env.d.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.strict],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Design tokens only (03-design/design-system.md): no colour literals outside src/theme.
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    ignores: ["src/theme/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message: "Use a colour token from src/theme/tokens.ts.",
        },
        {
          selector: "Literal[value=/^rgba?[(]/]",
          message: "Use a colour token from src/theme/tokens.ts.",
        },
      ],
    },
  },
  prettierRecommended,
]);
