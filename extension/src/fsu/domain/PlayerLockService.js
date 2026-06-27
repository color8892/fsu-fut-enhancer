const STORAGE_KEY = "lock_26";

export class PlayerLockService {
  constructor({ store, getInfo, debug }) {
    this.store = store;
    this.getInfo = getInfo;
    this.debug = debug;
    this.onToggle = null;
  }

  setOnToggle(callback) {
    this.onToggle = callback;
  }

  init() {
    const info = this.getInfo();
    const locked = this.store.getArray(STORAGE_KEY, []);
    this.debug.log(locked);
    info.lock = locked;
  }

  toggle(playerId) {
    const info = this.getInfo();
    const isLocked = info.lock.includes(playerId);

    if (isLocked) {
      info.lock.splice(info.lock.indexOf(playerId), 1);
      if (this.onToggle) {
        this.onToggle("unlock");
      }
    } else {
      info.lock.push(playerId);
      if (this.onToggle) {
        this.onToggle("lock");
      }
    }

    this.store.setJson(STORAGE_KEY, info.lock);
  }

  createFacade() {
    return {
      init: () => this.init(),
      save: (playerId) => this.toggle(playerId)
    };
  }
}