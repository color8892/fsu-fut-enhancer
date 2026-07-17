import {
  IN_PACKS_SEARCH_ERROR_CODES,
  inPacksSearchFailure,
  parseInPacksConceptPage
} from "../domain/InPacksSearchResults.js";

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object";
}

export class InPacksSearchAdapter {
  /**
   * @param {{
   *   CriteriaConstructor: unknown,
   *   searchConceptItems: (criteria: Record<string, unknown>) => unknown,
   *   observableAdapter: {
   *     observeOnce: (
   *       observable: unknown,
   *       context: object,
   *       capability: string
   *     ) => Promise<unknown>
   *   }
   * }} options
   */
  constructor({
    CriteriaConstructor,
    searchConceptItems,
    observableAdapter
  }) {
    this.CriteriaConstructor = CriteriaConstructor;
    this.searchConceptItems = searchConceptItems;
    this.observableAdapter = observableAdapter;
  }

  /**
   * @param {{
   *   offset: number,
   *   limit: number,
   *   definitionIds: number[],
   *   rarityIds: number[],
   *   observerContext: object
   * }} options
   */
  async requestPage({
    offset,
    limit,
    definitionIds,
    rarityIds,
    observerContext
  }) {
    if (
      typeof this.CriteriaConstructor !== "function" ||
      typeof this.searchConceptItems !== "function"
    ) {
      return inPacksSearchFailure(
        IN_PACKS_SEARCH_ERROR_CODES.INVALID_INPUT,
        ["UTSearchCriteriaDTO", "services.Item.searchConceptItems"]
      );
    }

    /** @type {Record<string, unknown>} */
    let criteria;
    let observable;
    try {
      const CriteriaConstructor =
        /** @type {new () => Record<string, unknown>} */ (
          this.CriteriaConstructor
        );
      criteria = new CriteriaConstructor();
      criteria.count = limit;
      criteria.offset = offset;
      criteria.defId = [...definitionIds];
      criteria.rarities = [...rarityIds];
      observable = this.searchConceptItems(criteria);
    } catch {
      return inPacksSearchFailure(
        IN_PACKS_SEARCH_ERROR_CODES.INVALID_INPUT,
        ["concept-search.invoke"]
      );
    }

    const observed = await this.observableAdapter.observeOnce(
      observable,
      observerContext,
      "store.in-packs-search"
    );
    if (
      !isRecord(observed) ||
      observed.success !== true ||
      !Object.prototype.hasOwnProperty.call(observed, "data")
    ) {
      return observed;
    }
    return parseInPacksConceptPage(observed.data);
  }
}
