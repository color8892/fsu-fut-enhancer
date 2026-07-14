export class PatchRegistry {
  constructor() {
    this.backups = {};
    this.installed = new Map();
  }

  backup(key, original) {
    this.backups[key] = original;
    return original;
  }

  call(key, thisArg, ...args) {
    const original = this.backups[key];
    if (typeof original !== "function") {
      throw new Error(`Patch backup not found: ${key}`);
    }
    return original.call(thisArg, ...args);
  }

  createViewMap(entries) {
    const view = {};
    for (const [key, original] of Object.entries(entries)) {
      view[key] = this.backup(key, original);
    }
    return view;
  }

  /**
   * @param {{
   *   id: string,
   *   resolveTarget: () => unknown,
   *   verify?: (target: unknown) => boolean,
   *   apply: (target: unknown) => void | (() => void)
   * }} descriptor
   */
  install({ id, resolveTarget, verify = () => true, apply }) {
    if (this.installed.has(id)) {
      return { id, status: "already-installed" };
    }
    try {
      const target = resolveTarget();
      if (!target) {
        return { id, status: "skipped", reason: "target-unavailable" };
      }
      if (!verify(target)) {
        return { id, status: "skipped", reason: "verification-failed" };
      }
      const restore = apply(target);
      this.installed.set(id, { restore: typeof restore === "function" ? restore : null });
      return { id, status: "installed" };
    } catch (error) {
      return {
        id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /** @param {string} id */
  restore(id) {
    const patch = this.installed.get(id);
    if (!patch) return { id, status: "not-installed" };
    try {
      patch.restore?.();
      this.installed.delete(id);
      return { id, status: "restored" };
    } catch (error) {
      return {
        id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * Installs descriptor patches through a registry when available, while preserving
 * the legacy direct-install behavior for callers outside the bootstrap lifecycle.
 * @param {Array<{id: string, resolveTarget: () => unknown, verify?: (target: unknown) => boolean, apply: (target: unknown) => void | (() => void)}>} descriptors
 * @param {PatchRegistry | null} patchRegistry
 */
export function installPatchDescriptors(descriptors, patchRegistry = null) {
  if (patchRegistry) return descriptors.map((descriptor) => patchRegistry.install(descriptor));

  return descriptors.map((descriptor) => {
    try {
      const target = descriptor.resolveTarget();
      if (!target) return { id: descriptor.id, status: "skipped", reason: "target-unavailable" };
      if (descriptor.verify && !descriptor.verify(target)) {
        return { id: descriptor.id, status: "skipped", reason: "verification-failed" };
      }
      descriptor.apply(target);
      return { id: descriptor.id, status: "installed" };
    } catch (error) {
      return {
        id: descriptor.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
}
