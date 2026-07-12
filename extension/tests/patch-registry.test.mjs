import assert from "assert";
import { PatchRegistry } from "../src/fsu/core/PatchRegistry.js";

export function runPatchRegistryTests() {
  const registry = new PatchRegistry();
  const target = {
    value: 0,
    increment() {
      this.value++;
      return this.value;
    }
  };
  const result = registry.install({
    id: "counter.increment",
    resolveTarget: () => target,
    verify: (resolved) => typeof resolved.increment === "function",
    apply: (resolved) => {
      const original = resolved.increment;
      resolved.increment = function () {
        return original.call(this) + 10;
      };
      return () => {
        resolved.increment = original;
      };
    }
  });
  assert.deepStrictEqual(result, { id: "counter.increment", status: "installed" });
  assert.strictEqual(target.increment(), 11);
  assert.deepStrictEqual(
    registry.install({
      id: "counter.increment",
      resolveTarget: () => target,
      apply: () => {}
    }),
    { id: "counter.increment", status: "already-installed" }
  );
  assert.deepStrictEqual(registry.restore("counter.increment"), {
    id: "counter.increment",
    status: "restored"
  });
  assert.strictEqual(target.increment(), 2);
  assert.deepStrictEqual(registry.restore("counter.increment"), {
    id: "counter.increment",
    status: "not-installed"
  });
  assert.deepStrictEqual(
    registry.install({
      id: "missing-target",
      resolveTarget: () => null,
      apply: () => {}
    }),
    { id: "missing-target", status: "skipped", reason: "target-unavailable" }
  );
  assert.deepStrictEqual(
    registry.install({
      id: "invalid-target",
      resolveTarget: () => target,
      verify: () => false,
      apply: () => {}
    }),
    { id: "invalid-target", status: "skipped", reason: "verification-failed" }
  );
}
