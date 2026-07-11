export const EA_CAPABILITIES = Object.freeze({
  UTAS_SESSION: "authentication.utas-session",
  MARKET_SEARCH: "market.search",
  MARKET_QUERY_MODEL: "market.query-model",
  CURRENCY_STEPS: "market.currency-steps",
  ITEM_MOVE_TO_CLUB: "item.move-to-club",
  ITEM_PURCHASE_TO_CLUB: "item.purchase-to-club"
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

/**
 * @param {string} capability
 * @param {string[]} missing
 * @param {unknown} [cause]
 */
function unavailableMoveResult(capability, missing, cause) {
  return {
    success: false,
    movedCount: 0,
    error: {
      code: "EA_CAPABILITY_UNAVAILABLE",
      capability,
      missing,
      cause: cause instanceof Error ? cause.message : undefined
    }
  };
}

/**
 * @param {string[]} missing
 * @param {unknown} [cause]
 */
function unavailablePurchaseResult(missing, cause) {
  return {
    success: false,
    reason: "capability-unavailable",
    error: {
      code: "EA_CAPABILITY_UNAVAILABLE",
      capability: EA_CAPABILITIES.ITEM_PURCHASE_TO_CLUB,
      missing,
      cause: cause instanceof Error ? cause.message : undefined
    }
  };
}

/**
 * @param {number} price
 * @param {string[]} [missing]
 * @param {unknown} [cause]
 */
function purchasedMoveFailure(price, missing = [], cause) {
  const error =
    missing.length > 0 || cause instanceof Error
      ? {
          code: "EA_PURCHASED_ITEM_MOVE_FAILED",
          capability: EA_CAPABILITIES.ITEM_PURCHASE_TO_CLUB,
          missing,
          cause: cause instanceof Error ? cause.message : undefined
        }
      : null;
  return {
    success: false,
    reason: "move-failed",
    purchased: true,
    price: Number(price),
    ...(error ? { error } : {})
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
   * @param {{
   *   getServices?: () => unknown,
   *   getMarketRuntime?: () => unknown,
   *   getItemRuntime?: () => unknown
   * }} [options]
   */
  constructor({
    getServices = () => undefined,
    getMarketRuntime = () => undefined,
    getItemRuntime = () => undefined
  } = {}) {
    this.getServices = getServices;
    this.getMarketRuntime = getMarketRuntime;
    this.getItemRuntime = getItemRuntime;
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
      name !== EA_CAPABILITIES.CURRENCY_STEPS &&
      name !== EA_CAPABILITIES.ITEM_MOVE_TO_CLUB &&
      name !== EA_CAPABILITIES.ITEM_PURCHASE_TO_CLUB
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

    if (name === EA_CAPABILITIES.ITEM_MOVE_TO_CLUB) {
      const runtime = this.getItemRuntime();
      const missing = [];
      const itemService = services.Item;
      const localization = services.Localization;
      const notification = services.Notification;
      if (!isRecord(itemService) || typeof itemService.move !== "function") {
        missing.push("services.Item.move");
      }
      if (!isRecord(localization) || typeof localization.localize !== "function") {
        missing.push("services.Localization.localize");
      }
      if (!isRecord(notification) || typeof notification.queue !== "function") {
        missing.push("services.Notification.queue");
      }
      if (!isRecord(runtime)) {
        missing.push("itemRuntime");
      } else {
        if (!isRecord(runtime.ItemPile) || runtime.ItemPile.CLUB === undefined) {
          missing.push("itemRuntime.ItemPile.CLUB");
        }
        if (
          !isRecord(runtime.UINotificationType) ||
          runtime.UINotificationType.NEUTRAL === undefined ||
          runtime.UINotificationType.NEGATIVE === undefined
        ) {
          missing.push("itemRuntime.UINotificationType");
        }
        if (
          !isRecord(runtime.NetworkErrorManager) ||
          typeof runtime.NetworkErrorManager.handleStatus !== "function"
        ) {
          missing.push("itemRuntime.NetworkErrorManager.handleStatus");
        }
      }
      return { name, supported: missing.length === 0, missing };
    }

    if (name === EA_CAPABILITIES.ITEM_PURCHASE_TO_CLUB) {
      const runtime = this.getItemRuntime();
      const missing = [];
      const itemService = services.Item;
      const userService = services.User;
      if (!isRecord(itemService) || typeof itemService.bid !== "function") {
        missing.push("services.Item.bid");
      }
      if (!isRecord(itemService) || typeof itemService.move !== "function") {
        missing.push("services.Item.move");
      }
      if (!isRecord(userService) || typeof userService.getUser !== "function") {
        missing.push("services.User.getUser");
      }
      if (!isRecord(runtime)) {
        missing.push("itemRuntime");
      } else {
        if (!isRecord(runtime.ItemPile) || runtime.ItemPile.CLUB === undefined) {
          missing.push("itemRuntime.ItemPile.CLUB");
        }
        if (!isRecord(runtime.GameCurrency) || runtime.GameCurrency.COINS === undefined) {
          missing.push("itemRuntime.GameCurrency.COINS");
        }
        if (
          !isRecord(runtime.UtasErrorCode) ||
          runtime.UtasErrorCode.PERMISSION_DENIED === undefined
        ) {
          missing.push("itemRuntime.UtasErrorCode.PERMISSION_DENIED");
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

  /**
   * @param {unknown} items
   * @param {unknown} observerContext
   * @returns {Promise<unknown>}
   */
  moveItemsToClub(items, observerContext) {
    const capability = this.inspect(EA_CAPABILITIES.ITEM_MOVE_TO_CLUB);
    if (!capability.supported) {
      return Promise.resolve(unavailableMoveResult(capability.name, capability.missing));
    }

    const services = this.getServices();
    const runtime = this.getItemRuntime();
    if (!isRecord(services) || !isRecord(runtime)) {
      return Promise.resolve(unavailableMoveResult(capability.name, ["services", "itemRuntime"]));
    }
    const itemService = services.Item;
    const localization = services.Localization;
    const notification = services.Notification;
    const itemPile = runtime.ItemPile;
    const notificationType = runtime.UINotificationType;
    const networkErrorManager = runtime.NetworkErrorManager;
    if (
      !isRecord(itemService) ||
      !isRecord(localization) ||
      !isRecord(notification) ||
      !isRecord(itemPile) ||
      !isRecord(notificationType) ||
      !isRecord(networkErrorManager)
    ) {
      return Promise.resolve(unavailableMoveResult(capability.name, capability.missing));
    }
    const move = itemService.move;
    const localize = localization.localize;
    const queue = notification.queue;
    const handleStatus = networkErrorManager.handleStatus;
    if (
      typeof move !== "function" ||
      typeof localize !== "function" ||
      typeof queue !== "function" ||
      typeof handleStatus !== "function"
    ) {
      return Promise.resolve(unavailableMoveResult(capability.name, capability.missing));
    }

    try {
      const observable = move.call(itemService, items, itemPile.CLUB);
      if (!isRecord(observable) || typeof observable.observe !== "function") {
        return Promise.resolve(
          unavailableMoveResult(capability.name, ["services.Item.move.observe"])
        );
      }
      const observe = observable.observe;

      return new Promise((resolve) => {
        let settled = false;
        /**
         * @param {unknown} sender
         * @param {unknown} response
         */
        const onResponse = (sender, response) => {
          if (settled) return;
          settled = true;
          try {
            if (isRecord(sender) && typeof sender.unobserve === "function") {
              sender.unobserve(observerContext);
            }
            if (!isRecord(response)) {
              resolve(unavailableMoveResult(capability.name, ["move.response"]));
              return;
            }

            if (response.success) {
              const data = response.data;
              const movedCount =
                isRecord(data) && Array.isArray(data.itemIds) ? data.itemIds.length : 0;
              const messageKey =
                movedCount > 1
                  ? "notification.item.allToClub"
                  : "notification.item.oneToClub";
              const message =
                movedCount > 1
                  ? localize.call(localization, messageKey, [movedCount])
                  : localize.call(localization, messageKey);
              queue.call(notification, [message, notificationType.NEUTRAL]);
              resolve({ success: true, movedCount });
              return;
            }

            const message = localize.call(localization, "notification.item.moveFailed");
            queue.call(notification, [message, notificationType.NEGATIVE]);
            const data = response.data;
            const untradeableSwap = Boolean(isRecord(data) && data.untradeableSwap);
            if (!untradeableSwap) {
              handleStatus.call(networkErrorManager, response.status);
            }
            resolve({
              success: false,
              movedCount: 0,
              untradeableSwap,
              status: response.status
            });
          } catch (error) {
            resolve(unavailableMoveResult(capability.name, [], error));
          }
        };
        try {
          observe.call(observable, observerContext, onResponse);
        } catch (error) {
          settled = true;
          resolve(unavailableMoveResult(capability.name, [], error));
        }
      });
    } catch (error) {
      return Promise.resolve(unavailableMoveResult(capability.name, [], error));
    }
  }

  /**
   * @param {unknown} item
   * @param {number} price
   * @param {unknown} observerContext
   * @param {() => void} [onBeforeBid]
   * @returns {Promise<unknown>}
   */
  purchaseItemToClub(item, price, observerContext, onBeforeBid = () => {}) {
    const capability = this.inspect(EA_CAPABILITIES.ITEM_PURCHASE_TO_CLUB);
    if (!capability.supported) {
      return Promise.resolve(unavailablePurchaseResult(capability.missing));
    }

    const services = this.getServices();
    const runtime = this.getItemRuntime();
    if (!isRecord(services) || !isRecord(runtime) || !isRecord(item)) {
      return Promise.resolve(unavailablePurchaseResult(["services", "itemRuntime", "item"]));
    }
    const itemService = services.Item;
    const userService = services.User;
    const itemPile = runtime.ItemPile;
    const gameCurrency = runtime.GameCurrency;
    const utasErrorCode = runtime.UtasErrorCode;
    if (
      !isRecord(itemService) ||
      !isRecord(userService) ||
      !isRecord(itemPile) ||
      !isRecord(gameCurrency) ||
      !isRecord(utasErrorCode)
    ) {
      return Promise.resolve(unavailablePurchaseResult(capability.missing));
    }
    const getAuctionData = item.getAuctionData;
    const getUser = userService.getUser;
    const bid = itemService.bid;
    const move = itemService.move;
    if (
      typeof getAuctionData !== "function" ||
      typeof getUser !== "function" ||
      typeof bid !== "function" ||
      typeof move !== "function"
    ) {
      return Promise.resolve(
        unavailablePurchaseResult([
          "item.getAuctionData",
          "services.User.getUser",
          "services.Item.bid",
          "services.Item.move"
        ])
      );
    }

    try {
      const auction = getAuctionData.call(item);
      const user = getUser.call(userService);
      if (!isRecord(auction) || !isRecord(user) || typeof user.getCurrency !== "function") {
        return Promise.resolve(
          unavailablePurchaseResult(["item.auctionData", "services.User.getUser().getCurrency"])
        );
      }
      const currency = user.getCurrency(gameCurrency.COINS);
      const canBuy = auction.canBuy;
      const getSecondsRemaining = auction.getSecondsRemaining;
      if (
        !isRecord(currency) ||
        typeof canBuy !== "function" ||
        typeof getSecondsRemaining !== "function"
      ) {
        return Promise.resolve(
          unavailablePurchaseResult([
            "user.currency.amount",
            "auction.canBuy",
            "auction.getSecondsRemaining"
          ])
        );
      }
      if (!canBuy.call(auction, Number(currency.amount) || 0)) {
        return Promise.resolve({ success: false, reason: "insufficient-funds" });
      }
      if (Number(getSecondsRemaining.call(auction)) <= 0) {
        return Promise.resolve({ success: false, reason: "expired" });
      }

      onBeforeBid();
      const bidObservable = bid.call(itemService, item, Number(price));
      if (!isRecord(bidObservable) || typeof bidObservable.observe !== "function") {
        return Promise.resolve(unavailablePurchaseResult(["services.Item.bid.observe"]));
      }
      const observeBid = bidObservable.observe;

      return new Promise((resolve) => {
        let settled = false;
        /**
         * @param {unknown} sender
         * @param {unknown} bidResponse
         */
        const onBid = (sender, bidResponse) => {
          if (settled) return;
          try {
            if (isRecord(sender) && typeof sender.unobserve === "function") {
              sender.unobserve(observerContext);
            }
            if (!isRecord(bidResponse) || !bidResponse.success) {
              settled = true;
              const error = isRecord(bidResponse) ? bidResponse.error : undefined;
              const permissionDenied =
                isRecord(error) && error.code === utasErrorCode.PERMISSION_DENIED;
              resolve({ success: false, reason: "bid-failed", permissionDenied });
              return;
            }

            const moveObservable = move.call(itemService, item, itemPile.CLUB);
            if (!isRecord(moveObservable) || typeof moveObservable.observe !== "function") {
              settled = true;
              resolve(purchasedMoveFailure(price, ["services.Item.move.observe"]));
              return;
            }
            const observeMove = moveObservable.observe;
            /**
             * @param {unknown} moveSender
             * @param {unknown} moveResponse
             */
            const onMove = (moveSender, moveResponse) => {
              if (settled) return;
              settled = true;
              try {
                if (isRecord(moveSender) && typeof moveSender.unobserve === "function") {
                  moveSender.unobserve(observerContext);
                }
                if (isRecord(moveResponse) && moveResponse.success) {
                  resolve({ success: true, price: Number(price) });
                } else {
                  resolve(purchasedMoveFailure(price));
                }
              } catch (error) {
                resolve(purchasedMoveFailure(price, [], error));
              }
            };
            try {
              observeMove.call(moveObservable, observerContext, onMove);
            } catch (error) {
              settled = true;
              resolve(purchasedMoveFailure(price, [], error));
            }
          } catch (error) {
            settled = true;
            resolve(
              isRecord(bidResponse) && bidResponse.success
                ? purchasedMoveFailure(price, [], error)
                : unavailablePurchaseResult([], error)
            );
          }
        };
        try {
          observeBid.call(bidObservable, observerContext, onBid);
        } catch (error) {
          settled = true;
          resolve(unavailablePurchaseResult([], error));
        }
      });
    } catch (error) {
      return Promise.resolve(unavailablePurchaseResult([], error));
    }
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
