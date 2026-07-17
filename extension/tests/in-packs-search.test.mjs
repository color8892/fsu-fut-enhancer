import assert from "node:assert/strict";
import {
  IN_PACKS_SEARCH_ERROR_CODES,
  parseInPacksConceptPage
} from "../src/fsu/domain/InPacksSearchResults.js";
import { InPacksSearchService } from "../src/fsu/domain/InPacksSearchService.js";
import { InPacksSearchAdapter } from "../src/fsu/ea/InPacksSearchAdapter.js";
import { commitInPacksPlayers } from "../src/fsu/patches/store.js";

function player(definitionId) {
  return { id: definitionId + 1000, definitionId, concept: true };
}

export async function runInPacksSearchTests() {
  assert.deepEqual(
    parseInPacksConceptPage({
      success: true,
      response: { items: [player(1), player(2)] }
    }),
    {
      success: true,
      data: { items: [player(1), player(2)] }
    }
  );
  assert.equal(
    parseInPacksConceptPage({
      success: true,
      response: { items: [{ definitionId: "bad" }] }
    }).error.code,
    IN_PACKS_SEARCH_ERROR_CODES.INVALID_RESPONSE
  );
  assert.equal(
    parseInPacksConceptPage({ success: false }).error.code,
    IN_PACKS_SEARCH_ERROR_CODES.REJECTED
  );

  class SearchCriteria {}
  const criteriaSeen = [];
  const pageObservable = { marker: "observable" };
  const adapter = new InPacksSearchAdapter({
    CriteriaConstructor: SearchCriteria,
    searchConceptItems(criteria) {
      criteriaSeen.push(criteria);
      return pageObservable;
    },
    observableAdapter: {
      async observeOnce(observable, context, capability) {
        assert.strictEqual(observable, pageObservable);
        assert.equal(context.name, "store-controller");
        assert.equal(capability, "store.in-packs-search");
        return {
          success: true,
          data: {
            success: true,
            response: { items: [player(7)] }
          }
        };
      }
    }
  });
  assert.deepEqual(
    await adapter.requestPage({
      offset: 200,
      limit: 200,
      definitionIds: [7],
      rarityIds: [1, 2],
      observerContext: { name: "store-controller" }
    }),
    { success: true, data: { items: [player(7)] } }
  );
  assert.deepEqual({ ...criteriaSeen[0] }, {
    count: 200,
    offset: 200,
    defId: [7],
    rarities: [1, 2]
  });

  const pages = [
    { success: true, data: { items: [player(1), player(2)] } },
    { success: true, data: { items: [player(3)] } }
  ];
  const requested = [];
  const delays = [];
  const service = new InPacksSearchService({
    adapter: {
      async requestPage(options) {
        requested.push(options);
        return pages.shift();
      }
    },
    pageSize: 2,
    maxPages: 3,
    pageDelayMs: 100,
    delay: async (delayMs) => {
      delays.push(delayMs);
    }
  });
  const success = await service.search({
    definitionIds: [3, 1],
    rarityIds: [],
    observerContext: {}
  });
  assert.equal(success.success, true);
  assert.equal(success.data.pagesCompleted, 2);
  assert.deepEqual(
    requested.map(({ offset, limit }) => ({ offset, limit })),
    [
      { offset: 0, limit: 2 },
      { offset: 2, limit: 2 }
    ]
  );
  assert.deepEqual(delays, [100]);
  assert.deepEqual(
    service.selectConfiguredPlayers(success.data.items, [3, 1]),
    [player(3), player(1)]
  );

  const info = { inpacks: { players: [player(99)] } };
  const selected = service.selectConfiguredPlayers(
    success.data.items,
    [3, 1]
  );
  assert.equal(commitInPacksPlayers(info, selected), true);
  assert.deepEqual(
    info.inpacks.players.map(
      ({ definitionId, concept, isInPacks }) => ({
        definitionId,
        concept,
        isInPacks
      })
    ),
    [
      { definitionId: 3, concept: false, isInPacks: true },
      { definitionId: 1, concept: false, isInPacks: true }
    ]
  );
  const frozenInfo = { inpacks: { players: [player(99)] } };
  assert.equal(
    commitInPacksPlayers(frozenInfo, [Object.freeze(player(5))]),
    false
  );
  assert.equal(frozenInfo.inpacks.players[0].definitionId, 99);

  let resolveCancelledPage;
  const cancellable = new InPacksSearchService({
    adapter: {
      requestPage() {
        return new Promise((resolve) => {
          resolveCancelledPage = resolve;
        });
      }
    },
    pageSize: 2,
    delay: async () => {}
  });
  const cancelledPromise = cancellable.search({
    definitionIds: [1],
    rarityIds: [],
    observerContext: {}
  });
  assert.equal(cancellable.cancel(), true);
  resolveCancelledPage({
    success: true,
    data: { items: [player(1)] }
  });
  const cancelled = await cancelledPromise;
  assert.equal(
    cancelled.error.code,
    IN_PACKS_SEARCH_ERROR_CODES.CANCELLED
  );

  let resolveOldPage;
  let requestCount = 0;
  const superseding = new InPacksSearchService({
    adapter: {
      requestPage() {
        requestCount++;
        if (requestCount === 1) {
          return new Promise((resolve) => {
            resolveOldPage = resolve;
          });
        }
        return Promise.resolve({
          success: true,
          data: { items: [player(2)] }
        });
      }
    },
    pageSize: 2,
    delay: async () => {}
  });
  const oldSearch = superseding.search({
    definitionIds: [1],
    rarityIds: [],
    observerContext: {}
  });
  const newSearch = superseding.search({
    definitionIds: [2],
    rarityIds: [],
    observerContext: {}
  });
  const newResult = await newSearch;
  resolveOldPage({
    success: true,
    data: { items: [player(1)] }
  });
  const oldResult = await oldSearch;
  assert.equal(newResult.success, true);
  assert.equal(
    oldResult.error.code,
    IN_PACKS_SEARCH_ERROR_CODES.CANCELLED
  );

  let maxPageCalls = 0;
  const maxPagesService = new InPacksSearchService({
    adapter: {
      async requestPage() {
        maxPageCalls++;
        return {
          success: true,
          data: { items: [player(maxPageCalls), player(maxPageCalls + 10)] }
        };
      }
    },
    pageSize: 2,
    maxPages: 2,
    delay: async () => {}
  });
  const maxPages = await maxPagesService.search({
    definitionIds: [1],
    rarityIds: [],
    observerContext: {}
  });
  assert.equal(maxPages.error.code, IN_PACKS_SEARCH_ERROR_CODES.MAX_PAGES);
  assert.equal(maxPages.partial.pagesCompleted, 2);
  assert.equal(maxPages.partial.items.length, 4);

  let partialPage = 0;
  const partialService = new InPacksSearchService({
    adapter: {
      async requestPage() {
        partialPage++;
        if (partialPage === 1) {
          return {
            success: true,
            data: { items: [player(1), player(2)] }
          };
        }
        return {
          success: false,
          error: { code: "EA_OBSERVABLE_TIMEOUT", issues: ["timeout"] }
        };
      }
    },
    pageSize: 2,
    maxPages: 3,
    delay: async () => {}
  });
  const partial = await partialService.search({
    definitionIds: [1],
    rarityIds: [],
    observerContext: {}
  });
  assert.equal(partial.error.code, "EA_OBSERVABLE_TIMEOUT");
  assert.equal(partial.partial.pagesCompleted, 1);
  assert.deepEqual(partial.partial.items, [player(1), player(2)]);

  const thrown = await new InPacksSearchService({
    adapter: {
      async requestPage() {
        throw new Error("EA drift");
      }
    }
  }).search({
    definitionIds: [1],
    rarityIds: [],
    observerContext: {}
  });
  assert.equal(
    thrown.error.code,
    IN_PACKS_SEARCH_ERROR_CODES.INVALID_RESPONSE
  );

  const inactive = await new InPacksSearchService({
    adapter: {
      async requestPage() {
        assert.fail("Inactive navigation must not request a page");
      }
    }
  }).search({
    definitionIds: [1],
    rarityIds: [],
    observerContext: {},
    isActive: () => {
      throw new Error("controller drift");
    }
  });
  assert.equal(
    inactive.error.code,
    IN_PACKS_SEARCH_ERROR_CODES.CANCELLED
  );
}
