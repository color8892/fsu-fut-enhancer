import assert from "assert";
import { responseText, safeParseJson } from "../src/fsu/infra/JsonParsing.js";

export function runJsonParsingTests() {
  assert.deepStrictEqual(safeParseJson("{\"ok\":true}", {}), { ok: true });
  assert.deepStrictEqual(safeParseJson("", { fallback: true }), { fallback: true });
  assert.deepStrictEqual(safeParseJson(undefined, []), []);

  const errors = [];
  assert.deepStrictEqual(
    safeParseJson("<html>", { ok: false }, {
      label: "remote.json",
      onError(error, context) {
        errors.push({ message: error.message, label: context.label });
      }
    }),
    { ok: false }
  );
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0].label, "remote.json");

  assert.strictEqual(responseText({ responseText: "a", response: "b" }), "a");
  assert.strictEqual(responseText({ response: "b" }), "b");
  assert.strictEqual(responseText(null), "");
}
