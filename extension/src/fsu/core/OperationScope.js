/**
 * Owns one-shot cleanup for UI-bound async work.
 * Does not know about EA globals — callers inject cleanup callbacks.
 *
 * @typedef {{
 *   id: number,
 *   isActive: () => boolean
 * }} ScopeToken
 */

import { CancellableOperation } from "./CancellableOperation.js";

export class OperationScope {
  /**
   * @param {{ operation?: CancellableOperation }} [options]
   */
  constructor({ operation = new CancellableOperation() } = {}) {
    this.operation = operation;
    /** @type {Map<number, { onSupersede?: () => void, onCleanup?: () => void }>} */
    this.cleanups = new Map();
  }

  /**
   * @param {{ onSupersede?: () => void, onCleanup?: () => void }} [options]
   * @returns {ScopeToken}
   */
  start({ onSupersede, onCleanup } = {}) {
    const previousId = this.operation.activeId;
    if (previousId) {
      this._runSupersede(previousId);
    }
    const token = this.operation.start();
    if (
      typeof onSupersede === "function" ||
      typeof onCleanup === "function"
    ) {
      this.cleanups.set(token.id, { onSupersede, onCleanup });
    }
    return token;
  }

  cancel() {
    const activeId = this.operation.activeId;
    const cancelled = this.operation.cancel();
    if (cancelled && activeId) {
      this._runCleanup(activeId);
    }
    return cancelled;
  }

  /**
   * @param {ScopeToken | null | undefined} token
   */
  finish(token) {
    if (!token) return false;
    const finished = this.operation.finish(token);
    if (finished) {
      this._runCleanup(token.id);
    } else {
      // Superseded work already released its local resources at start().
      this.cleanups.delete(token.id);
    }
    return finished;
  }

  isRunning() {
    return this.operation.isRunning();
  }

  /**
   * @param {number} id
   */
  _runCleanup(id) {
    const cleanup = this.cleanups.get(id);
    this.cleanups.delete(id);
    if (typeof cleanup?.onCleanup === "function") {
      cleanup.onCleanup();
    }
  }

  /**
   * @param {number} id
   */
  _runSupersede(id) {
    const cleanup = this.cleanups.get(id);
    this.cleanups.delete(id);
    if (typeof cleanup?.onSupersede === "function") {
      cleanup.onSupersede();
    }
  }
}
