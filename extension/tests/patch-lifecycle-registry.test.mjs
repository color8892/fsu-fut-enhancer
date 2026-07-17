import assert from "assert";
import { PatchLifecycleRegistry } from "../src/fsu/core/PatchLifecycleRegistry.js";

function replacementDescriptor(context, value) {
  return {
    ...(context.originalDescriptor || {
      configurable: true,
      enumerable: false,
      writable: true
    }),
    value
  };
}

export function runPatchLifecycleRegistryTests() {
  const target = {};
  const original = function original(value) {
    return value + 1;
  };
  Object.defineProperty(target, "run", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: original
  });
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, "run");
  const registry = new PatchLifecycleRegistry();
  const descriptor = {
    id: "test.wrapper",
    phase: "early",
    targetLabel: "TestTarget.prototype.run",
    resolveTarget: () => ({ owner: target, key: "run" }),
    verify: ({ originalValue }) => ({
      ok: typeof originalValue === "function",
      missing: ["TestTarget.prototype.run"]
    }),
    apply(context) {
      Object.defineProperty(
        context.target.owner,
        context.target.key,
        replacementDescriptor(context, function wrapped(value) {
          return context.originalValue.call(this, value) * 2;
        })
      );
    }
  };

  assert.strictEqual(registry.install(descriptor).status, "installed");
  assert.strictEqual(target.run(2), 6);
  assert.strictEqual(registry.isInstalled("test.wrapper"), true);
  const duplicate = registry.install({ ...descriptor, phase: "wrong-phase" });
  assert.strictEqual(duplicate.status, "already-installed");
  assert.strictEqual(duplicate.phase, "early");
  assert.strictEqual(target.run(2), 6);
  assert.strictEqual(registry.restore("test.wrapper").status, "restored");
  assert.strictEqual(target.run, original);
  assert.deepStrictEqual(
    Object.getOwnPropertyDescriptor(target, "run"),
    originalDescriptor
  );
  assert.strictEqual(registry.restore("test.wrapper").status, "not-installed");

  const unsupportedRegistry = new PatchLifecycleRegistry();
  const unsupported = unsupportedRegistry.install({
    id: "test.unsupported",
    phase: "early",
    targetLabel: "MissingTarget.prototype.run",
    resolveTarget: () => null,
    apply() {}
  });
  assert.deepStrictEqual(unsupported.missing, ["MissingTarget.prototype.run"]);

  const resolutionFailure = unsupportedRegistry.install({
    id: "test.resolution-failure",
    phase: "early",
    resolveTarget() {
      throw new ReferenceError("secret runtime value must not enter diagnostics");
    },
    apply() {}
  });
  assert.strictEqual(resolutionFailure.status, "unsupported");
  assert.deepStrictEqual(resolutionFailure.missing, ["target-resolution-threw"]);
  assert.ok(
    !JSON.stringify(unsupportedRegistry.getDiagnostics()).includes("secret")
  );

  const inspectionProxy = new Proxy(
    {},
    {
      getOwnPropertyDescriptor() {
        throw new Error("inspection failed");
      }
    }
  );
  const inspectionFailure = unsupportedRegistry.install({
    id: "test.inspection-failure",
    phase: "early",
    resolveTarget: () => ({ owner: inspectionProxy, key: "run" }),
    apply() {}
  });
  assert.strictEqual(inspectionFailure.status, "unsupported");
  assert.deepStrictEqual(inspectionFailure.missing, ["target-inspection-threw"]);

  const verifyTarget = { run() {} };
  const verifyFailure = unsupportedRegistry.install({
    id: "test.verify",
    phase: "early",
    resolveTarget: () => ({ owner: verifyTarget, key: "run" }),
    verify: () => ({
      ok: false,
      missing: [
        "UTExample.prototype.run",
        "session=must-not-appear",
        "repositories.Item"
      ]
    }),
    apply() {
      assert.fail("apply must not run after verification failure");
    }
  });
  assert.strictEqual(verifyFailure.status, "verify-failed");
  assert.deepStrictEqual(verifyFailure.missing, [
    "UTExample.prototype.run",
    "repositories.Item"
  ]);

  const applyTarget = { value: "original" };
  const applyFailureRegistry = new PatchLifecycleRegistry();
  const applyFailure = applyFailureRegistry.install({
    id: "test.apply-failure",
    phase: "hub",
    resolveTarget: () => ({ owner: applyTarget, key: "value" }),
    apply({ target: patchTarget }) {
      patchTarget.owner[patchTarget.key] = "partial";
      throw new Error("apply failed");
    }
  });
  assert.strictEqual(applyFailure.status, "apply-failed");
  assert.strictEqual(applyTarget.value, "original");
  assert.strictEqual(applyFailureRegistry.isInstalled("test.apply-failure"), false);

  const newTarget = {};
  const newPropertyRegistry = new PatchLifecycleRegistry();
  assert.strictEqual(
    newPropertyRegistry.install({
      id: "test.new-property",
      phase: "hub",
      resolveTarget: () => ({ owner: newTarget, key: "added" }),
      apply({ target: patchTarget }) {
        Object.defineProperty(patchTarget.owner, patchTarget.key, {
          configurable: true,
          value: 7
        });
      }
    }).status,
    "installed"
  );
  assert.strictEqual(newTarget.added, 7);
  assert.strictEqual(newPropertyRegistry.restore("test.new-property").status, "restored");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(newTarget, "added"), false);

  const order = [];
  const phaseTarget = { early: 0, late: 0 };
  const phaseRegistry = new PatchLifecycleRegistry();
  const phaseResults = phaseRegistry.installMany([
    {
      id: "phase.early",
      phase: "early",
      resolveTarget: () => ({ owner: phaseTarget, key: "early" }),
      apply({ target: patchTarget }) {
        patchTarget.owner[patchTarget.key] = 1;
      },
      restore() {
        order.push("early");
      }
    },
    {
      id: "phase.unsupported",
      phase: "hub",
      resolveTarget: () => null,
      apply() {}
    },
    {
      id: "phase.late",
      phase: "late",
      resolveTarget: () => ({ owner: phaseTarget, key: "late" }),
      apply({ target: patchTarget }) {
        patchTarget.owner[patchTarget.key] = 1;
      },
      restore() {
        order.push("late");
      }
    }
  ]);
  assert.deepStrictEqual(
    phaseResults.map((result) => result.status),
    ["installed", "unsupported", "installed"]
  );
  assert.deepStrictEqual(
    phaseResults.map((result) => result.phase),
    ["early", "hub", "late"]
  );
  assert.deepStrictEqual(
    phaseRegistry.restoreAll().map((result) => result.status),
    ["restored", "restored"]
  );
  assert.deepStrictEqual(order, ["late", "early"]);
  assert.deepStrictEqual(phaseTarget, { early: 0, late: 0 });

  const diagnosticRegistry = new PatchLifecycleRegistry({
    onDiagnostic(diagnostic) {
      diagnostic.missing.push("callback-mutation");
      throw new Error("diagnostic callback failure");
    }
  });
  assert.strictEqual(
    diagnosticRegistry.install({
      id: "test.callback",
      phase: "early",
      resolveTarget: () => null,
      apply() {}
    }).status,
    "unsupported"
  );
  assert.ok(
    !diagnosticRegistry.getDiagnostics()[0].missing.includes("callback-mutation")
  );

  const hookTarget = { value: 1 };
  const hookRegistry = new PatchLifecycleRegistry();
  hookRegistry.install({
    id: "test.restore-hook",
    phase: "late",
    resolveTarget: () => ({ owner: hookTarget, key: "value" }),
    apply({ target: patchTarget }) {
      patchTarget.owner[patchTarget.key] = 2;
    },
    restore() {
      throw new Error("hook failed");
    }
  });
  const hookRestore = hookRegistry.restore("test.restore-hook");
  assert.strictEqual(hookRestore.status, "restored-with-hook-failure");
  assert.strictEqual(hookTarget.value, 1);

  assert.strictEqual(
    new PatchLifecycleRegistry().install({}).status,
    "invalid-descriptor"
  );
  const unsafeDiagnostic = new PatchLifecycleRegistry().install({
    id: "session=must-not-appear",
    phase: "early",
    resolveTarget: () => null,
    apply() {}
  });
  assert.strictEqual(unsafeDiagnostic.status, "invalid-descriptor");
  assert.strictEqual(unsafeDiagnostic.id, "invalid-patch");
}
