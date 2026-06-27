const STORAGE_KEY = "build";

export class BuildPreferencesService {
  constructor({ store, getInfo, debug }) {
    this.store = store;
    this.getInfo = getInfo;
    this.debug = debug;
    this.onSave = null;
  }

  setOnSave(callback) {
    this.onSave = callback;
  }

  init() {
    const info = this.getInfo();
    const stored = this.store.getObject(STORAGE_KEY, {});
    _.merge(info.build, stored);
    this.debug.log(info.build);
  }

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
      set: (key, value) => this.set(key, value)
    };
  }
}