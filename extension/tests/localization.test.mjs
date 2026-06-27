import assert from "assert";
import { createLocalization } from "../src/fsu/domain/Localization.js";

export function runLocalizationTests() {
  globalThis._ = {
    cloneDeep(value) {
      return Array.isArray(value) ? [...value] : value;
    }
  };

  const state = {
    language: 2,
    localization: {
      "notice.setsuccess": ["", "", "Saved"],
      greeting: ["", "", "Hello %1"]
    }
  };
  const { fy, eafy } = createLocalization(() => state);

  assert.strictEqual(fy(undefined), "");
  assert.strictEqual(fy(null), "");
  assert.strictEqual(fy("notice.setsuccess"), "Saved");
  assert.strictEqual(fy(["greeting", "World"]), "Hello World");
  assert.strictEqual(eafy(undefined), "");
}