export class FsuJsonStore {
  /**
   * @param {any} getValue
   * @param {any} setValue
   */
  constructor(getValue, setValue) {
    this.getValue = getValue;
    this.setValue = setValue;
  }

  /**
   * @param {string} key
   * @param {Record<string, any>} [fallback]
   * @returns {Record<string, any>}
   */
  getObject(key, fallback = {}) {
    const value = this.getJson(key, fallback);
    return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  }

  /**
   * @param {string} key
   * @param {any[]} [fallback]
   * @returns {any[]}
   */
  getArray(key, fallback = []) {
    const value = this.getJson(key, fallback);
    return Array.isArray(value) ? value : fallback;
  }

  /**
   * @param {string} key
   * @param {any} fallback
   * @returns {any}
   */
  getJson(key, fallback) {
    try {
      const raw = this.getValue(key, JSON.stringify(fallback));
      const value = typeof raw === "string" ? JSON.parse(raw) : raw;
      return value === undefined || value === null ? fallback : value;
    } catch (error) {
      console.warn(`[FSU] Failed to read stored value: ${key}`, error);
      return fallback;
    }
  }

  /**
   * @param {string} key
   * @param {any} value
   */
  setJson(key, value) {
    this.setValue(key, JSON.stringify(value));
  }
}