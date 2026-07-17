export const EA_OBSERVABLE_ERROR_CODES = Object.freeze({
  UNAVAILABLE: "EA_CAPABILITY_UNAVAILABLE",
  TIMEOUT: "EA_OBSERVABLE_TIMEOUT",
  FAILED: "EA_OBSERVABLE_FAILED"
});

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object";
}

/**
 * @param {string} code
 * @param {string} capability
 * @param {string[]} missing
 */
function failure(code, capability, missing) {
  return {
    success: false,
    error: { code, capability, missing }
  };
}

export class EaObservableAdapter {
  /**
   * @param {{
   *   timeoutMs?: number,
   *   setTimer?: (callback: () => void, timeoutMs: number) => unknown,
   *   clearTimer?: (timer: unknown) => void
   * }} [options]
   */
  constructor({
    timeoutMs = 15_000,
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = (timer) => clearTimeout(/** @type {ReturnType<typeof setTimeout>} */ (timer))
  } = {}) {
    this.timeoutMs = timeoutMs;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
  }

  /**
   * @param {unknown} observable
   * @param {object} observerContext
   * @param {string} capability
   */
  observeOnce(observable, observerContext, capability) {
    if (!isRecord(observable) || typeof observable.observe !== "function") {
      return Promise.resolve(
        failure(EA_OBSERVABLE_ERROR_CODES.UNAVAILABLE, capability, [
          `${capability}.observe`
        ])
      );
    }
    const observe = observable.observe;

    return new Promise((resolve) => {
      let settled = false;
      /** @type {unknown} */
      let timer;
      /**
       * @param {unknown} result
       * @param {unknown} sender
       */
      const finish = (result, sender) => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) {
          this.clearTimer(timer);
        }
        try {
          if (isRecord(sender) && typeof sender.unobserve === "function") {
            sender.unobserve(observerContext);
          } else if (typeof observable.unobserve === "function") {
            observable.unobserve(observerContext);
          }
        } catch {
          // Cleanup failure must not change the operation result.
        }
        resolve(result);
      };
      timer = this.setTimer(() => {
        finish(
          failure(EA_OBSERVABLE_ERROR_CODES.TIMEOUT, capability, [
            `${capability}.timeout`
          ]),
          observable
        );
      }, this.timeoutMs);

      try {
        /**
         * @param {unknown} sender
         * @param {unknown} response
         */
        const onObserved = (sender, response) => {
          finish({ success: true, data: response }, sender);
        };
        observe.call(observable, observerContext, onObserved);
      } catch {
        finish(
          failure(EA_OBSERVABLE_ERROR_CODES.FAILED, capability, [
            `${capability}.observe-threw`
          ]),
          observable
        );
      }
    });
  }
}
