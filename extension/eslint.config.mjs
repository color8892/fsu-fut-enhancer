import js from "@eslint/js";

const eaGlobals = {
  GM_getValue: "readonly",
  GM_setValue: "readonly",
  GM_xmlhttpRequest: "readonly",
  GM_addStyle: "readonly",
  GM_openInTab: "readonly",
  GM_info: "readonly",
  unsafeWindow: "readonly",
  _: "readonly",
  repositories: "readonly",
  services: "readonly",
  isPhone: "readonly",
  enums: "readonly",
  ItemRarity: "readonly",
  ItemAttribute: "readonly",
  ItemSubAttribute: "readonly",
  ItemPile: "readonly",
  ItemState: "readonly",
  MAX_NEW_ITEMS: "writable",
  APP_YEAR_SHORT: "readonly"
};

const nodeGlobals = {
  console: "readonly",
  process: "readonly",
  module: "readonly",
  __dirname: "readonly",
  URL: "readonly",
  Response: "readonly",
  globalThis: "readonly"
};

export default [
  js.configs.recommended,
  {
    files: ["src/fsu/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: eaGlobals
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-empty": "warn",
      "no-prototype-builtins": "off",
      "no-case-declarations": "off",
      "no-async-promise-executor": "off",
      "no-fallthrough": "off",
      "no-constant-binary-expression": "off",
      "no-extra-boolean-cast": "off",
      "no-redeclare": "off",
      "no-unreachable": "off",
      "no-constant-condition": "off",
      "no-useless-escape": "off"
    }
  },
  {
    files: ["tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...nodeGlobals,
        ...eaGlobals,
        assert: "readonly"
      }
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
    }
  },
  {
    files: ["scripts/build-userscript.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: nodeGlobals
    }
  },
  {
    files: ["src/background.js", "src/content-bridge.js", "src/page-runtime.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...nodeGlobals,
        Blob: "readonly",
        FormData: "readonly",
        URLSearchParams: "readonly",
        AbortController: "readonly",
        fetch: "readonly",
        chrome: "readonly",
        document: "readonly",
        window: "readonly",
        self: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly"
      }
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
    }
  },
  {
    ignores: ["src/userscript.js", "vendor/**", "tests/load-background.cjs"]
  }
];