import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.js", "tests/**/*.mjs", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
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
        EAView: "readonly",
        EAViewController: "readonly",
        EATargetActionView: "readonly",
        JSUtils: "readonly",
        SBCEligibilityKey: "readonly",
        AssetLocationUtils: "readonly",
        FSU_DEBUG: "readonly",
        ItemRarity: "readonly",
        ItemAttribute: "readonly",
        ItemSubAttribute: "readonly",
        ItemPile: "readonly",
        ItemState: "readonly",
        PINEventType: "readonly",
        PIN_PAGEVIEW_EVT_TYPE: "readonly",
        SearchSortID: "readonly",
        SearchSortType: "readonly",
        UINotificationType: "readonly",
        getAppMain: "readonly",
        gClickShield: "readonly",
        MAX_NEW_ITEMS: "writable",
        APP_YEAR_SHORT: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-empty": "warn"
    }
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly"
      }
    }
  },
  {
    files: ["src/background.js", "src/content-bridge.js", "src/page-runtime.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        URL: "readonly",
        Blob: "readonly",
        FormData: "readonly",
        URLSearchParams: "readonly",
        AbortController: "readonly",
        fetch: "readonly",
        chrome: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly"
      }
    }
  },
  {
    ignores: ["src/userscript.js", "vendor/**", "tests/load-background.cjs"]
  }
];