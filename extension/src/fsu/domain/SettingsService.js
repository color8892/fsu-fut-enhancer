const STORAGE_KEY = "set";

export class SettingsService {
  constructor({ store, getInfo, debug }) {
    this.store = store;
    this.getInfo = getInfo;
    this.debug = debug;
    this.onSave = null;
  }

  setOnSave(callback) {
    this.onSave = callback;
  }

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

  buildDefaults(setfield, isPhone) {
    const defaults = { card_style: 2 };

    for (const group in setfield) {
      for (const item of setfield[group]) {
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

  save(key, value) {
    const info = this.getInfo();
    info.set[key] = value;
    this.store.setJson(STORAGE_KEY, info.set);

    if (this.onSave) {
      this.onSave();
    }
  }

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

  createFacade(ui) {
    return {
      init: () => this.init(typeof isPhone === "function" ? isPhone() : false),
      save: (key, value) => this.save(key, value),
      addToggle: (group, name) => this.createToggle(group, name, ui)
    };
  }
}