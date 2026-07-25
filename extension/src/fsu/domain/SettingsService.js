const STORAGE_KEY = "set";

/**
 * Service for loading, building default values, and saving user extension settings.
 */
export class SettingsService {
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

  /**
   * @param {boolean} [isPhone]
   */
  init(isPhone = false) {
    const info = this.getInfo();
    const defaults = this.buildDefaults(info.setfield, isPhone);
    const stored = this.store.getObject(STORAGE_KEY, {});

    for (const [key, value] of Object.entries(defaults)) {
      if (!Object.prototype.hasOwnProperty.call(stored, key)) {
        stored[key] = value;
      }
    }

    this.debug.log(stored);
    info.set = stored;
  }

  /**
   * @param {Record<string, string[]>} setfield
   * @param {boolean} isPhone
   * @returns {Record<string, any>}
   */
  buildDefaults(setfield, isPhone) {
    /** @type {Record<string, any>} */
    const defaults = { card_style: 2 };

    for (const group in setfield) {
      const items = setfield[group] || [];
      for (const item of items) {
        defaults[`${group}_${item}`] = true;
      }
    }

    defaults.shield_league = [31, 16, 13, 19, 53];
    defaults.shield_flag = [];
    defaults.queries_number = 5;
    defaults.headentrance_number = isPhone ? 3 : 5;
    defaults.goldenrange = 83;

    return defaults;
  }

  /**
   * @param {string} key
   * @param {any} value
   */
  save(key, value) {
    const info = this.getInfo();
    info.set[key] = value;
    this.store.setJson(STORAGE_KEY, info.set);

    if (this.onSave) {
      this.onSave();
    }
  }

  /**
   * @param {string} group
   * @param {string} name
   * @param {{ createToggle: (text: string, cb: (control: any) => Promise<void>) => any, fy: (key: string) => string }} ui
   * @returns {any}
   */
  createToggle(group, name, { createToggle, fy }) {
    const info = this.getInfo();
    const settingKey = `${group}_${name}`;
    const toggle = createToggle(fy(`set.${group}.${name}`), async (control) => {
      this.save(settingKey, control.getToggleState() ? true : false);
    });

    toggle._sName = settingKey;

    if (info.set[settingKey]) {
      toggle.toggle(1);
    }

    return toggle;
  }

  /**
   * @param {{ createToggle: (text: string, cb: (control: any) => Promise<void>) => any, fy: (key: string) => string }} ui
   * @param {() => boolean} [isPhoneHelper]
   */
  createFacade(ui, isPhoneHelper) {
    return {
      init: () => this.init(typeof isPhoneHelper === "function" ? isPhoneHelper() : false),
      save: (/** @type {string} */ key, /** @type {any} */ value) => this.save(key, value),
      addToggle: (/** @type {string} */ group, /** @type {string} */ name) => this.createToggle(group, name, ui)
    };
  }
}