export const EA_CAPABILITIES = Object.freeze({
  UTAS_SESSION: "authentication.utas-session",
  MARKET_SEARCH: "market.search",
  MARKET_QUERY_MODEL: "market.query-model",
  CURRENCY_STEPS: "market.currency-steps"
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
 * EA classes may expose static methods on either functions or plain objects.
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
function asPropertyBag(value) {
  if (isRecord(value)) return value;
  if (typeof value === "function") {
    return /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (value));
  }
  return null;
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

export class EaMarketSearchSession {
  /**
   * @param {{
   *   criteria: Record<string, unknown>,
   *   model: Record<string, unknown>,
   *   updateCriteria: (criteria: Record<string, unknown>) => void
   * }} options
   */
  constructor({ criteria, model, updateCriteria }) {
    this.criteria = criteria;
    this.model = model;
    this.updateCriteria = updateCriteria;
  }

  /** @param {number} value */
  setMaxBuy(value) {
    this.criteria.maxBuy = Number(value);
    this.updateCriteria(this.criteria);
  }

  getMaxBuy() {
    return Number(this.getCriteria().maxBuy) || 0;
  }

  /** @returns {Record<string, unknown>} */
  getCriteria() {
    return isRecord(this.model.searchCriteria) ? this.model.searchCriteria : this.criteria;
  }
}

/**
 * Lazy boundary around EA-owned runtime globals.
 *
 * The adapter intentionally returns capability diagnostics instead of exposing
 * the raw services object to domain modules.
 */
export class EaRuntimeAdapter {
  /**
   * @param {{ getServices?: () => unknown, getMarketRuntime?: () => unknown }} [options]
   */
  constructor({ getServices = () => undefined, getMarketRuntime = () => undefined } = {}) {
    this.getServices = getServices;
    this.getMarketRuntime = getMarketRuntime;
  }

  /**
   * @param {string} name
   * @returns {EaCapabilityStatus}
   */
  inspect(name) {
    if (
      name !== EA_CAPABILITIES.UTAS_SESSION &&
      name !== EA_CAPABILITIES.MARKET_SEARCH &&
      name !== EA_CAPABILITIES.MARKET_QUERY_MODEL &&
      name !== EA_CAPABILITIES.CURRENCY_STEPS
    ) {
      return {
        name,
        supported: false,
        missing: [`capability:${name}`]
      };
    }

    if (name === EA_CAPABILITIES.MARKET_QUERY_MODEL) {
      const runtime = this.getMarketRuntime();
      if (!isRecord(runtime)) {
        return { name, supported: false, missing: ["marketRuntime"] };
      }
      const requiredConstructors = ["UTSearchCriteriaDTO", "UTBucketedItemSearchViewModel"];
      const requiredEnums = ["SearchType", "SearchCategory", "ItemSearchFeature"];
      const missing = [];
      for (const key of requiredConstructors) {
        if (typeof runtime[key] !== "function") missing.push(`marketRuntime.${key}`);
      }
      for (const key of requiredEnums) {
        if (!isRecord(runtime[key])) missing.push(`marketRuntime.${key}`);
      }
      return { name, supported: missing.length === 0, missing };
    }

    if (name === EA_CAPABILITIES.CURRENCY_STEPS) {
      const runtime = this.getMarketRuntime();
      if (!isRecord(runtime)) {
        return { name, supported: false, missing: ["marketRuntime"] };
      }
      const currencyInput = asPropertyBag(runtime.UTCurrencyInputControl);
      if (!currencyInput) {
        return { name, supported: false, missing: ["marketRuntime.UTCurrencyInputControl"] };
      }
      const missing = [];
      if (typeof currencyInput.getIncrementAboveVal !== "function") {
        missing.push("marketRuntime.UTCurrencyInputControl.getIncrementAboveVal");
      }
      if (typeof currencyInput.getIncrementBelowVal !== "function") {
        missing.push("marketRuntime.UTCurrencyInputControl.getIncrementBelowVal");
      }
      return { name, supported: missing.length === 0, missing };
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

  /**
   * @param {number} definitionId
   * @returns {EaMarketSearchSession | null}
   */
  createPlayerMarketSearch(definitionId) {
    if (!this.supports(EA_CAPABILITIES.MARKET_QUERY_MODEL)) return null;

    const runtime = this.getMarketRuntime();
    if (!isRecord(runtime)) return null;
    const CriteriaConstructor = runtime.UTSearchCriteriaDTO;
    const ModelConstructor = runtime.UTBucketedItemSearchViewModel;
    const searchType = runtime.SearchType;
    const searchCategory = runtime.SearchCategory;
    const itemSearchFeature = runtime.ItemSearchFeature;
    if (
      typeof CriteriaConstructor !== "function" ||
      typeof ModelConstructor !== "function" ||
      !isRecord(searchType) ||
      !isRecord(searchCategory) ||
      !isRecord(itemSearchFeature)
    ) {
      return null;
    }

    try {
      const criteria = Reflect.construct(CriteriaConstructor, []);
      const model = Reflect.construct(ModelConstructor, []);
      if (!isRecord(criteria) || !isRecord(model) || !isRecord(model.defaultSearchCriteria)) {
        return null;
      }
      const update = model.updateSearchCriteria;
      if (typeof update !== "function") return null;

      criteria.defId = [Number(definitionId)];
      criteria.type = searchType.PLAYER;
      criteria.category = searchCategory.ANY;
      model.searchFeature = itemSearchFeature.MARKET;
      model.defaultSearchCriteria.type = criteria.type;
      model.defaultSearchCriteria.category = criteria.category;

      const updateCriteria = (/** @type {Record<string, unknown>} */ nextCriteria) => {
        update.call(model, nextCriteria);
      };
      updateCriteria(criteria);
      return new EaMarketSearchSession({ criteria, model, updateCriteria });
    } catch {
      return null;
    }
  }

  /**
   * @param {number} value
   * @param {"above" | "below"} direction
   * @returns {number | null}
   */
  incrementMarketPrice(value, direction) {
    if (!this.supports(EA_CAPABILITIES.CURRENCY_STEPS)) return null;
    const runtime = this.getMarketRuntime();
    if (!isRecord(runtime)) return null;
    const currencyInput = asPropertyBag(runtime.UTCurrencyInputControl);
    if (!currencyInput) return null;
    const method =
      direction === "above"
        ? currencyInput.getIncrementAboveVal
        : currencyInput.getIncrementBelowVal;
    if (typeof method !== "function") return null;
    const incremented = Number(method.call(currencyInput, Number(value)));
    return Number.isFinite(incremented) ? incremented : null;
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
