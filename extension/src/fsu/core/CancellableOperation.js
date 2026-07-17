/**
 * @typedef {{
 *   id: number,
 *   isActive: () => boolean
 * }} OperationToken
 */

export class CancellableOperation {
  constructor() {
    this.sequence = 0;
    this.activeId = 0;
  }

  /** @returns {OperationToken} */
  start() {
    const id = ++this.sequence;
    this.activeId = id;
    return Object.freeze({
      id,
      isActive: () => this.activeId === id
    });
  }

  cancel() {
    const wasActive = this.activeId !== 0;
    this.activeId = 0;
    return wasActive;
  }

  /** @param {OperationToken | null | undefined} operation */
  finish(operation) {
    if (operation?.id === this.activeId) {
      this.activeId = 0;
      return true;
    }
    return false;
  }

  isRunning() {
    return this.activeId !== 0;
  }
}
