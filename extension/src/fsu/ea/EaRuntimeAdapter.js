export const EA_CAPABILITIES = Object.freeze({
  UTAS_SESSION: "authentication.utas-session",
  MARKET_SEARCH: "market.search"
});

/**
 * @typedef {{ name: string, supported: boolean, missing: string[] }} EaCapabilityStatus
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object";
}

/**
 * @param {string} capability
 * @param {string[]} missing
 * @param {unknown} [cause]
 */
function unavailableResult(capability, missing, cause) {
  return {
    success: false,
    data: { items: [] },
    error: {
      code: "EA_CAPABILITY_UNAVAILABLE",
      capability,
      missing,
      cause: cause instanceof Error ? cause.message : undefined
    }
  };
}

/**
 * Lazy boundary around EA-owned runtime globals.
 *
 * The adapter intentionally returns capability diagnostics instead of exposing
 * the raw services object to domain modules.
 */
export class EaRuntimeAdapter {
  /**
   * @param {{ getServices?: () => unknown }} [options]
   */
  constructor({ getServices = () => undefined } = {}) {
    this.getServices = getServices;
  }

  /**
   * @param {string} name
   * @returns {EaCapabilityStatus}
   */
  inspect(name) {
    if (name !== EA_CAPABILITIES.UTAS_SESSION && name !== EA_CAPABILITIES.MARKET_SEARCH) {
      return {
        name,
        supported: false,
        missing: [`capability:${name}`]
      };
    }

    const services = this.getServices();
    if (!isRecord(services)) {
      return { name, supported: false, missing: ["services"] };
    }

    if (name === EA_CAPABILITIES.MARKET_SEARCH) {
      const itemService = services.Item;
      const missing = [];
      if (!isRecord(itemService)) {
        missing.push("services.Item");
      } else {
        if (typeof itemService.clearTransferMarketCache !== "function") {
          missing.push("services.Item.clearTransferMarketCache");
        }
        if (typeof itemService.searchTransferMarket !== "function") {
          missing.push("services.Item.searchTransferMarket");
        }
      }
      return { name, supported: missing.length === 0, missing };
    }

    const authentication = services.Authentication;
    if (!isRecord(authentication)) {
      return { name, supported: false, missing: ["services.Authentication"] };
    }

    const session = authentication.utasSession;
    if (!isRecord(session) || session.id === undefined || session.id === null || session.id === "") {
      return {
        name,
        supported: false,
        missing: ["services.Authentication.utasSession.id"]
      };
    }

    return { name, supported: true, missing: [] };
  }

  /**
   * @param {string} name
   */
  supports(name) {
    return this.inspect(name).supported;
  }

  /**
   * @returns {string | null}
   */
  getUtasSessionId() {
    if (!this.supports(EA_CAPABILITIES.UTAS_SESSION)) {
      return null;
    }

    const services = this.getServices();
    if (!isRecord(services)) return null;
    const authentication = services.Authentication;
    if (!isRecord(authentication)) return null;
    const session = authentication.utasSession;
    if (!isRecord(session)) return null;
    return String(session.id);
  }

  clearTransferMarketCache() {
    if (!this.supports(EA_CAPABILITIES.MARKET_SEARCH)) {
      return false;
    }

    const services = this.getServices();
    if (!isRecord(services) || !isRecord(services.Item)) return false;
    const clear = services.Item.clearTransferMarketCache;
    if (typeof clear !== "function") return false;
    clear.call(services.Item);
    return true;
  }

  /**
   * @param {unknown} criteria
   * @param {number} type
   * @param {unknown} observerContext
   * @returns {Promise<unknown>}
   */
  searchTransferMarket(criteria, type, observerContext) {
    const capability = this.inspect(EA_CAPABILITIES.MARKET_SEARCH);
    if (!capability.supported) {
      return Promise.resolve(unavailableResult(capability.name, capability.missing));
    }

    const services = this.getServices();
    if (!isRecord(services) || !isRecord(services.Item)) {
      return Promise.resolve(unavailableResult(capability.name, ["services.Item"]));
    }

    const search = services.Item.searchTransferMarket;
    if (typeof search !== "function") {
      return Promise.resolve(
        unavailableResult(capability.name, ["services.Item.searchTransferMarket"])
      );
    }

    try {
      const observable = search.call(services.Item, criteria, type);
      if (!isRecord(observable)) {
        return Promise.resolve(
          unavailableResult(capability.name, ["services.Item.searchTransferMarket.observe"])
        );
      }
      const observe = observable.observe;
      if (typeof observe !== "function") {
        return Promise.resolve(
          unavailableResult(capability.name, ["services.Item.searchTransferMarket.observe"])
        );
      }

      return new Promise((resolve) => {
        /**
         * @param {unknown} _sender
         * @param {unknown} response
         */
        const onResponse = (_sender, response) => resolve(response);
        observe.call(observable, observerContext, onResponse);
      });
    } catch (error) {
      return Promise.resolve(unavailableResult(capability.name, [], error));
    }
  }
}
