/**
 * @typedef {"installed" | "already-installed" | "unsupported" | "verify-failed" |
 *   "apply-failed" | "apply-failed-restore-failed" | "restored" |
 *   "restored-with-hook-failure" | "restore-failed" | "not-installed" |
 *   "invalid-descriptor"} PatchLifecycleStatus
 */

/**
 * @typedef {{
 *   owner: object,
 *   key: PropertyKey
 * }} PatchTarget
 */

/**
 * @typedef {{
 *   target: PatchTarget,
 *   originalDescriptor: PropertyDescriptor | undefined,
 *   originalValue: unknown
 * }} PatchLifecycleContext
 */

/**
 * @typedef {boolean | { ok: boolean, missing?: string[] }} PatchVerification
 */

/**
 * @typedef {{
 *   id: string,
 *   phase: string,
 *   targetLabel?: string,
 *   resolveTarget: () => PatchTarget | null | undefined,
 *   verify?: (context: PatchLifecycleContext) => PatchVerification,
 *   apply: (context: PatchLifecycleContext) => void,
 *   restore?: (context: PatchLifecycleContext) => void
 * }} PatchDescriptor
 */

/**
 * @typedef {{
 *   id: string,
 *   phase: string,
 *   status: PatchLifecycleStatus,
 *   sequence: number,
 *   missing: string[]
 * }} PatchDiagnostic
 */

/**
 * @typedef {{
 *   descriptor: PatchDescriptor,
 *   context: PatchLifecycleContext,
 *   hadOwnProperty: boolean
 * }} PatchInstallation
 */

const SAFE_DIAGNOSTIC_MEMBER = /^[A-Za-z0-9_$.[\]:-]{1,160}$/;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object";
}

/**
 * Diagnostics accept member identifiers, never arbitrary runtime values or exception text.
 * @param {unknown} values
 * @returns {string[]}
 */
function sanitizeMissing(values) {
  if (!Array.isArray(values)) return [];
  return values
    .filter(
      /** @returns {value is string} */
      (value) => typeof value === "string" && SAFE_DIAGNOSTIC_MEMBER.test(value)
    )
    .slice(0, 20);
}

/**
 * @param {unknown} value
 * @returns {value is PatchTarget}
 */
function isPatchTarget(value) {
  if (!isRecord(value)) return false;
  const owner = value.owner;
  const hasOwner =
    (typeof owner === "object" && owner !== null) || typeof owner === "function";
  return hasOwner && (typeof value.key === "string" || typeof value.key === "symbol");
}

/**
 * @param {PatchLifecycleContext} context
 * @param {boolean} hadOwnProperty
 * @returns {boolean}
 */
function restoreOriginalProperty(context, hadOwnProperty) {
  try {
    if (hadOwnProperty) {
      if (!context.originalDescriptor) return false;
      Object.defineProperty(
        context.target.owner,
        context.target.key,
        context.originalDescriptor
      );
      return true;
    }
    return Reflect.deleteProperty(context.target.owner, context.target.key);
  } catch {
    return false;
  }
}

/**
 * Installs EA prototype patches without exposing runtime objects in diagnostics.
 */
export class PatchLifecycleRegistry {
  /**
   * @param {{ onDiagnostic?: (diagnostic: PatchDiagnostic) => void }} [options]
   */
  constructor({ onDiagnostic = () => {} } = {}) {
    this.onDiagnostic = onDiagnostic;
    /** @type {Map<string, PatchInstallation>} */
    this.installations = new Map();
    /** @type {PatchDiagnostic[]} */
    this.diagnostics = [];
    this.sequence = 0;
  }

  /**
   * @param {string} id
   * @param {string} phase
   * @param {PatchLifecycleStatus} status
   * @param {unknown} [missing]
   * @returns {PatchDiagnostic}
   */
  record(id, phase, status, missing = []) {
    const diagnostic = {
      id: SAFE_DIAGNOSTIC_MEMBER.test(id) ? id : "invalid-patch",
      phase: SAFE_DIAGNOSTIC_MEMBER.test(phase) ? phase : "unknown",
      status,
      sequence: ++this.sequence,
      missing: sanitizeMissing(missing)
    };
    this.diagnostics.push(diagnostic);
    try {
      this.onDiagnostic({
        ...diagnostic,
        missing: [...diagnostic.missing]
      });
    } catch {
      // Diagnostics must not affect patch installation.
    }
    return diagnostic;
  }

  /**
   * @param {unknown} descriptorValue
   * @returns {PatchDiagnostic}
   */
  install(descriptorValue) {
    if (!isRecord(descriptorValue)) {
      return this.record("invalid-patch", "unknown", "invalid-descriptor");
    }

    const id =
      typeof descriptorValue.id === "string" &&
      SAFE_DIAGNOSTIC_MEMBER.test(descriptorValue.id)
        ? descriptorValue.id
        : "invalid-patch";
    const phase =
      typeof descriptorValue.phase === "string" &&
      SAFE_DIAGNOSTIC_MEMBER.test(descriptorValue.phase)
        ? descriptorValue.phase
        : "unknown";

    if (
      id === "invalid-patch" ||
      phase === "unknown" ||
      typeof descriptorValue.resolveTarget !== "function" ||
      typeof descriptorValue.apply !== "function" ||
      (descriptorValue.verify !== undefined &&
        typeof descriptorValue.verify !== "function") ||
      (descriptorValue.restore !== undefined &&
        typeof descriptorValue.restore !== "function")
    ) {
      return this.record(id, phase, "invalid-descriptor");
    }

    const descriptor = /** @type {PatchDescriptor} */ (descriptorValue);
    const existingInstallation = this.installations.get(descriptor.id);
    if (existingInstallation) {
      return this.record(
        descriptor.id,
        existingInstallation.descriptor.phase,
        "already-installed"
      );
    }

    /** @type {PatchTarget | null | undefined} */
    let target;
    try {
      target = descriptor.resolveTarget();
    } catch {
      return this.record(descriptor.id, descriptor.phase, "unsupported", [
        "target-resolution-threw"
      ]);
    }

    if (!isPatchTarget(target)) {
      return this.record(descriptor.id, descriptor.phase, "unsupported", [
        descriptor.targetLabel || "target"
      ]);
    }

    let hadOwnProperty;
    /** @type {PatchLifecycleContext} */
    let context;
    try {
      hadOwnProperty = Object.prototype.hasOwnProperty.call(
        target.owner,
        target.key
      );
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        target.owner,
        target.key
      );
      context = {
        target,
        originalDescriptor,
        originalValue: Reflect.get(target.owner, target.key)
      };
    } catch {
      return this.record(descriptor.id, descriptor.phase, "unsupported", [
        "target-inspection-threw"
      ]);
    }

    if (descriptor.verify) {
      /** @type {PatchVerification} */
      let verification;
      try {
        verification = descriptor.verify(context);
      } catch {
        return this.record(descriptor.id, descriptor.phase, "verify-failed", [
          "verify-threw"
        ]);
      }

      const verificationPassed =
        verification === true ||
        (isRecord(verification) && verification.ok === true);
      if (!verificationPassed) {
        const missing =
          isRecord(verification) && verification.ok === false
            ? verification.missing
            : [];
        return this.record(
          descriptor.id,
          descriptor.phase,
          "verify-failed",
          missing
        );
      }
    }

    try {
      descriptor.apply(context);
    } catch {
      const restored = restoreOriginalProperty(context, hadOwnProperty);
      return this.record(
        descriptor.id,
        descriptor.phase,
        restored ? "apply-failed" : "apply-failed-restore-failed",
        restored ? ["apply-threw"] : ["apply-threw", "target.restore"]
      );
    }

    this.installations.set(descriptor.id, {
      descriptor,
      context,
      hadOwnProperty
    });
    return this.record(descriptor.id, descriptor.phase, "installed");
  }

  /**
   * Installs descriptors in caller-provided order. Runtime failure in one descriptor
   * does not prevent later descriptors from being attempted.
   * @param {unknown[]} descriptors
   * @returns {PatchDiagnostic[]}
   */
  installMany(descriptors) {
    return descriptors.map((descriptor) => this.install(descriptor));
  }

  /**
   * @param {string} id
   * @returns {PatchDiagnostic}
   */
  restore(id) {
    const installation = this.installations.get(id);
    if (!installation) {
      return this.record(id, "unknown", "not-installed");
    }

    let hookFailed = false;
    if (installation.descriptor.restore) {
      try {
        installation.descriptor.restore(installation.context);
      } catch {
        hookFailed = true;
      }
    }

    const restored = restoreOriginalProperty(
      installation.context,
      installation.hadOwnProperty
    );
    if (!restored) {
      return this.record(id, installation.descriptor.phase, "restore-failed", [
        "target.restore"
      ]);
    }

    this.installations.delete(id);
    return this.record(
      id,
      installation.descriptor.phase,
      hookFailed ? "restored-with-hook-failure" : "restored",
      hookFailed ? ["restore-hook-threw"] : []
    );
  }

  /**
   * Restores in reverse installation order so nested wrappers unwind correctly.
   * @returns {PatchDiagnostic[]}
   */
  restoreAll() {
    return [...this.installations.keys()]
      .reverse()
      .map((id) => this.restore(id));
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  isInstalled(id) {
    return this.installations.has(id);
  }

  /**
   * @returns {PatchDiagnostic[]}
   */
  getDiagnostics() {
    return this.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      missing: [...diagnostic.missing]
    }));
  }
}
