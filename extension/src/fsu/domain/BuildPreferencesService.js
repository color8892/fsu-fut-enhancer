const STORAGE_KEY = "build";

/**
 * Service for managing user build preferences.
 */
export class BuildPreferencesService {
  /**
   * @param {{
   *   store: { getObject: (key: string, fallback: any) => any, setJson: (key: string, val: any) => void },
   *   getInfo: () => any,
   *   debug: { log: (...args: any[]) => void }
   * }} options
   */
  constructor({ store, getInfo, debug }) {
    this.store = store;
    this.getInfo = getInfo;
    this.debug = debug;
    /** @type {(() => void) | null} */
    this.onSave = null;
  }

  /**
   * @param {() => void} callback
   */
  setOnSave(callback) {
    this.onSave = callback;
  }

  init() {
    const info = this.getInfo();
    const stored = this.store.getObject(STORAGE_KEY, {});
    info.build = { ...info.build, ...stored };
    this.debug.log(info.build);
  }

  /**
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    const info = this.getInfo();
    info.build[key] = value;
    this.debug.log(info.build);
    this.store.setJson(STORAGE_KEY, info.build);

    if (this.onSave) {
      this.onSave();
    }
  }

  createFacade() {
    return {
      init: () => this.init(),
      set: (/** @type {string} */ key, /** @type {any} */ value) => this.set(key, value)
    };
  }
}