export class FsuJsonStore {
  constructor(getValue, setValue) {
    this.getValue = getValue;
    this.setValue = setValue;
  }

  getObject(key, fallback = {}) {
    const value = this.getJson(key, fallback);
    return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  }

  getArray(key, fallback = []) {
    const value = this.getJson(key, fallback);
    return Array.isArray(value) ? value : fallback;
  }

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

  setJson(key, value) {
    this.setValue(key, JSON.stringify(value));
  }
}