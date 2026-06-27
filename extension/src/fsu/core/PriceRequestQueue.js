/**
 * Deduplicates in-flight price API requests by batch key.
 */
export class PriceRequestQueue {
  constructor() {
    /** @type {Map<string, Promise<unknown>>} */
    this.inFlight = new Map();
  }

  /**
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} task
   * @returns {Promise<T>}
   */
  run(key, task) {
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = task().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }

  clear() {
    this.inFlight.clear();
  }
}