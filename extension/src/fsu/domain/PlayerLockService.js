const STORAGE_KEY = "lock_26";

/**
 * Service for locking and unlocking player cards to prevent accidental disposal.
 */
export class PlayerLockService {
  /**
   * @param {{
   *   store: { getArray: (key: string, fallback: any[]) => any[], setJson: (key: string, val: any) => void },
   *   getInfo: () => any,
   *   debug: { log: (...args: any[]) => void }
   * }} options
   */
  constructor({ store, getInfo, debug }) {
    this.store = store;
    this.getInfo = getInfo;
    this.debug = debug;
    /** @type {((action: "lock" | "unlock") => void) | null} */
    this.onToggle = null;
  }

  /**
   * @param {(action: "lock" | "unlock") => void} callback
   */
  setOnToggle(callback) {
    this.onToggle = callback;
  }

  init() {
    const info = this.getInfo();
    const locked = this.store.getArray(STORAGE_KEY, []);
    this.debug.log(locked);
    info.lock = locked;
  }

  /**
   * @param {number|string} playerId
   */
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
      save: (/** @type {number|string} */ playerId) => this.toggle(playerId)
    };
  }
}