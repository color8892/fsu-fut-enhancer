import { CancellableOperation } from "../core/CancellableOperation.js";
import {
  IN_PACKS_SEARCH_ERROR_CODES,
  inPacksSearchFailure
} from "./InPacksSearchResults.js";

/**
 * @param {unknown} values
 * @returns {values is number[]}
 */
function isPositiveIntegerArray(values) {
  return (
    Array.isArray(values) &&
    values.every((value) => Number.isInteger(value) && value > 0)
  );
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object";
}

export class InPacksSearchService {
  /**
   * @param {{
   *   adapter: {
   *     requestPage: (options: {
   *       offset: number,
   *       limit: number,
   *       definitionIds: number[],
   *       rarityIds: number[],
   *       observerContext: object
   *     }) => Promise<unknown>
   *   },
   *   operation?: CancellableOperation,
   *   pageSize?: number,
   *   maxPages?: number,
   *   pageDelayMs?: number,
   *   delay?: (delayMs: number) => Promise<void>
   * }} options
   */
  constructor({
    adapter,
    operation = new CancellableOperation(),
    pageSize = 200,
    maxPages = 10,
    pageDelayMs = 100,
    delay = (delayMs) =>
      new Promise((resolve) => setTimeout(resolve, delayMs))
  }) {
    this.adapter = adapter;
    this.operation = operation;
    this.pageSize = pageSize;
    this.maxPages = maxPages;
    this.pageDelayMs = pageDelayMs;
    this.delay = delay;
  }

  cancel() {
    return this.operation.cancel();
  }

  isRunning() {
    return this.operation.isRunning();
  }

  /**
   * @param {{
   *   definitionIds: unknown,
   *   rarityIds: unknown,
   *   observerContext: object,
   *   isActive?: () => boolean
   * }} options
   */
  async search({
    definitionIds,
    rarityIds,
    observerContext,
    isActive = () => true
  }) {
    if (
      !isPositiveIntegerArray(definitionIds) ||
      definitionIds.length === 0 ||
      !isPositiveIntegerArray(rarityIds)
    ) {
      return inPacksSearchFailure(
        IN_PACKS_SEARCH_ERROR_CODES.INVALID_INPUT,
        ["definitionIds", "rarityIds"]
      );
    }
    const token = this.operation.start();
    /** @type {Record<string, unknown>[]} */
    const items = [];
    let pagesCompleted = 0;
    const remainsActive = () => {
      try {
        return token.isActive() && isActive();
      } catch {
        return false;
      }
    };

    try {
      for (let page = 0; page < this.maxPages; page++) {
        if (!remainsActive()) {
          return inPacksSearchFailure(
            IN_PACKS_SEARCH_ERROR_CODES.CANCELLED,
            ["operation.cancelled"],
            { items, pagesCompleted }
          );
        }
        let result;
        try {
          result = await this.adapter.requestPage({
            offset: page * this.pageSize,
            limit: this.pageSize,
            definitionIds: [...definitionIds],
            rarityIds: [...rarityIds],
            observerContext
          });
        } catch {
          return inPacksSearchFailure(
            IN_PACKS_SEARCH_ERROR_CODES.INVALID_RESPONSE,
            ["page.request-threw"],
            { items, pagesCompleted }
          );
        }
        if (!remainsActive()) {
          return inPacksSearchFailure(
            IN_PACKS_SEARCH_ERROR_CODES.CANCELLED,
            ["operation.cancelled"],
            { items, pagesCompleted }
          );
        }
        if (
          !isRecord(result) ||
          result.success !== true ||
          !isRecord(result.data) ||
          !Array.isArray(result.data.items)
        ) {
          return {
            ...(isRecord(result)
              ? result
              : inPacksSearchFailure(
                  IN_PACKS_SEARCH_ERROR_CODES.INVALID_RESPONSE,
                  ["page.result"]
                )),
            partial: { items: [...items], pagesCompleted }
          };
        }

        const pageItems =
          /** @type {Record<string, unknown>[]} */ (result.data.items);
        items.push(...pageItems);
        pagesCompleted++;
        if (pageItems.length < this.pageSize) {
          return {
            success: true,
            data: {
              items,
              pagesCompleted
            }
          };
        }
        if (page + 1 < this.maxPages) {
          try {
            await this.delay(this.pageDelayMs);
          } catch {
            return inPacksSearchFailure(
              IN_PACKS_SEARCH_ERROR_CODES.INVALID_RESPONSE,
              ["pagination.delay"],
              { items, pagesCompleted }
            );
          }
        }
      }
      return inPacksSearchFailure(
        IN_PACKS_SEARCH_ERROR_CODES.MAX_PAGES,
        ["pagination.max-pages"],
        { items, pagesCompleted }
      );
    } finally {
      this.operation.finish(token);
    }
  }

  /**
   * @param {Record<string, unknown>[]} items
   * @param {number[]} definitionIds
   */
  selectConfiguredPlayers(items, definitionIds) {
    const byDefinitionId = new Map();
    for (const item of items) {
      if (!byDefinitionId.has(item.definitionId)) {
        byDefinitionId.set(item.definitionId, item);
      }
    }
    return definitionIds
      .map((definitionId) => byDefinitionId.get(definitionId))
      .filter(
        /** @returns {value is Record<string, unknown>} */
        (value) => value !== undefined
      );
  }
}
