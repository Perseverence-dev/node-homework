const { defineConfig } = require("eslint/config");
const js = require("@eslint/js");
const globals = require("globals");
// Jest provides globals such as describe, it, and expect in test files.
const pluginJest = require("eslint-plugin-jest");

module.exports = defineConfig([
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"] },
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs", globals: { ...globals.node} } },
  { files: ["**/*.{js,mjs,cjs}"], languageOptions: { globals: globals.browser } },
  {
    // Apply Jest globals and test-specific rules only to test files.
    files: ["test/**/*.js"],
    plugins: {
      jest: pluginJest,
    },
    languageOptions: {
      globals: pluginJest.environments.globals.globals,
    },
    rules: {
      "jest/no-disabled-tests": "warn",
      "jest/no-focused-tests": "error",
      "jest/no-identical-title": "error",
      "jest/prefer-to-have-length": "warn",
      "jest/valid-expect": "error",
    },
  },
]);