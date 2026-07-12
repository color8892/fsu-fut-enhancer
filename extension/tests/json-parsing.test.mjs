import assert from "assert";
import { cloneJson, responseText, safeParseJson } from "../src/fsu/infra/JsonParsing.js";

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

  // Schema validation tests
  const isOkSchema = (v) => typeof v === "object" && v !== null && typeof v.ok === "boolean";
  assert.deepStrictEqual(
    safeParseJson('{"ok":true}', { ok: false }, { schema: isOkSchema }),
    { ok: true }
  );

  const schemaErrors = [];
  assert.deepStrictEqual(
    safeParseJson('{"ok":"not-boolean"}', { ok: false }, {
      label: "remote-schema.json",
      schema: isOkSchema,
      onError(error, context) {
        schemaErrors.push({ message: error.message, label: context.label });
      }
    }),
    { ok: false }
  );
  assert.strictEqual(schemaErrors.length, 1);
  assert.strictEqual(schemaErrors[0].label, "remote-schema.json");
  assert.ok(schemaErrors[0].message.includes("Schema validation failed"));

  const source = { nested: { value: 1 }, list: [1, 2] };
  const copy = cloneJson(source);
  copy.nested.value = 2;
  copy.list.push(3);
  assert.strictEqual(source.nested.value, 1);
  assert.deepStrictEqual(source.list, [1, 2]);
  assert.strictEqual(cloneJson(undefined), undefined);
}
