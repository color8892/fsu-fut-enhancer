const STORAGE_KEY = "SBCCount";

/**
 * Service for tracking and displaying daily completed SBC counts.
 */
export class SbcCountService {
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
  }

  init() {
    const info = this.getInfo();
    const dayTimestamp = this.getStartOfDayTimestamp();
    const stored = this.store.getObject(STORAGE_KEY, {});
    const state = {
      count: 0,
      time: dayTimestamp
    };

    if (stored && typeof stored === "object" && stored.time == dayTimestamp) {
      state.count = stored.count;
    } else {
      this.store.setJson(STORAGE_KEY, state);
    }

    this.debug.log(state);
    info.SBCCount = state;
  }

  /**
   * @returns {number}
   */
  getStartOfDayTimestamp() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }

  recordCompletion() {
    const info = this.getInfo();
    const dayTimestamp = this.getStartOfDayTimestamp();

    if (dayTimestamp == info.SBCCount.time) {
      info.SBCCount.count += 1;
    } else {
      info.SBCCount.time = dayTimestamp;
      info.SBCCount.count = 1;
    }

    this.store.setJson(STORAGE_KEY, info.SBCCount);
    return info.SBCCount;
  }

  /**
   * @param {any} ui
   */
  updateNavLabel(ui) {
    const info = this.getInfo();

    if (!info.nave || !Object.prototype.hasOwnProperty.call(info.nave, "SBCCount")) {
      return;
    }

    const label = ui.isPhone()
      ? String(info.SBCCount.count)
      : ui.fy(["sbccount.btntext", info.SBCCount.count]);

    info.nave.SBCCount.setText(label);
  }

  /**
   * @param {any} navElement
   * @param {any} ui
   */
  mountNavButton(navElement, ui) {
    const info = this.getInfo();
    info.nave = navElement;

    if (!Object.prototype.hasOwnProperty.call(info.nave, "SBCCount")) {
      const label = ui.isPhone()
        ? String(info.SBCCount.count)
        : ui.fy(["sbccount.btntext", info.SBCCount.count]);

      info.nave.SBCCount = ui.createButton(
        new (/** @type {any} */ (window).UTButtonControl || function() {})(),
        label,
        async () => {
          ui.popup(ui.fy("sbccount.popupt"), ui.fy("sbccount.popupm"), () => {});
        },
        ui.isPhone() ? "fsu-navsbccount" : ""
      );

      info.nave.SBCCount.getRootElement().style.cursor = "pointer";

      if (ui.isPhone()) {
        const existingElement = info.nave._navbar.__currencies.firstChild;
        info.nave._navbar.__currencies.insertBefore(
          info.nave.SBCCount.getRootElement(),
          existingElement
        );
      } else {
        info.nave._navbar.__clubInfo.querySelector(".view-navbar-clubinfo-est").style.display =
          "none";
        info.nave._navbar.__clubInfo
          .querySelector(".view-navbar-clubinfo-data")
          .appendChild(info.nave.SBCCount.getRootElement());
      }
    } else {
      const label = ui.isPhone()
        ? String(info.SBCCount.count)
        : ui.fy(["sbccount.btntext", info.SBCCount.count]);
      info.nave.SBCCount.getRootElement().innerText = label;
    }
  }

  /**
   * @param {any} ui
   */
  createFacade(ui) {
    return {
      init: () => this.init(),
      changeCount: () => this.updateNavLabel(ui),
      createElement: (/** @type {any} */ navElement) => this.mountNavButton(navElement, ui)
    };
  }
}