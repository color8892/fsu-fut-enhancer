import assert from "node:assert/strict";
import { PatchLifecycleRegistry } from "../src/fsu/core/PatchLifecycleRegistry.js";
import { StorePackCatalogService } from "../src/fsu/domain/StorePackCatalogService.js";
import {
  STORE_PACK_ARTICLE_ERROR_CODES,
  StorePackCatalogAdapter
} from "../src/fsu/ea/StorePackCatalogAdapter.js";
import {
  STORE_PATCH_IDS,
  installStorePackListPatch,
  registerStorePackListLifecycleEvents
} from "../src/fsu/patches/store.js";

const COINS = "coins";
const POINTS = "points";

function createArticle({
  id,
  tradable = false,
  packName = `pack.${id}`,
  contentType = "players",
  start = 0,
  preview = false,
  coins = 0,
  points = 0
}) {
  const article = {
    id,
    tradable,
    packName,
    contentType,
    start,
    getPrice(currency) {
      return currency === COINS ? coins : points;
    }
  };
  if (preview) article.previewCreateTime = 0;
  return article;
}

function createCatalog(values) {
  const adapter = new StorePackCatalogAdapter({
    coinsCurrency: COINS,
    pointsCurrency: POINTS,
    localize: (key) => `Localized ${key}`,
    getPackValue: (id) => values[id] ?? 0,
    truncate: (text) => text.slice(0, 18)
  });
  return {
    adapter,
    service: new StorePackCatalogService(adapter)
  };
}

export function runStorePackCatalogTests() {
  const first = createArticle({ id: 1, tradable: true });
  const duplicate = createArticle({ id: 1, tradable: true });
  const second = createArticle({ id: 2 });
  const malformed = { id: "broken", marker: "passthrough" };
  const { adapter, service } = createCatalog({ 1: 100, 2: 300 });

  const myPacks = service.createCatalog(
    [first, duplicate, malformed, second],
    {
      categoryId: "mypacks",
      isMyPacks: true,
      nowSeconds: 100_000,
      sortDirection: "desc"
    }
  );
  assert.equal(myPacks.success, true);
  assert.deepEqual(myPacks.data.articles, [second, first, malformed]);
  assert.deepEqual(myPacks.data.summaries["1-true"], {
    packId: 1,
    tradable: true,
    count: 2,
    isPlayers: true,
    name: "*Localized pack.1",
    fullName: "*Localized pack.1",
    value: 100
  });
  assert.equal(myPacks.data.summaries["2-false"].count, 1);
  assert.deepEqual(myPacks.data.warnings, [
    { index: 2, code: STORE_PACK_ARTICLE_ERROR_CODES.INVALID }
  ]);

  const coinOnly = createArticle({
    id: 10,
    coins: 7500,
    points: 0
  });
  const newPointsPack = createArticle({
    id: 11,
    start: 99_900,
    coins: 5000,
    points: 100
  });
  const previewPack = createArticle({
    id: 12,
    preview: true,
    coins: 5000,
    points: 100
  });
  const regularCatalog = createCatalog({
    10: 100,
    11: 50,
    12: 1000
  }).service.createCatalog(
    [previewPack, newPointsPack, coinOnly],
    {
      categoryId: 2,
      isMyPacks: false,
      nowSeconds: 100_000,
      sortDirection: "desc"
    }
  );
  assert.deepEqual(regularCatalog.data.articles, [
    coinOnly,
    newPointsPack,
    previewPack
  ]);
  assert.equal(
    regularCatalog.data.articleStates.find(
      ({ article }) => article === newPointsPack
    ).isNew,
    true
  );

  const categoryThree = service.createCatalog(
    [createArticle({ id: 1, start: 99_999 })],
    {
      categoryId: 3,
      isMyPacks: false,
      nowSeconds: 100_000,
      sortDirection: "desc"
    }
  );
  assert.equal(categoryThree.data.articleStates[0].isNew, false);

  const throwingPrice = createArticle({ id: 3 });
  throwingPrice.getPrice = () => {
    throw new Error("EA getter drift");
  };
  assert.equal(
    adapter.snapshot(throwingPrice, {
      categoryId: 2,
      nowSeconds: 100_000,
      isMyPacks: false
    }).error.code,
    STORE_PACK_ARTICLE_ERROR_CODES.CAPABILITY
  );
  const frozenArticle = Object.freeze(createArticle({ id: 4 }));
  const frozenCatalog = service.createCatalog([frozenArticle], {
    categoryId: "mypacks",
    isMyPacks: true,
    nowSeconds: 100_000,
    sortDirection: "desc"
  });
  assert.deepEqual(frozenCatalog.data.articles, [frozenArticle]);

  const throwingAdapterService = new StorePackCatalogService({
    snapshot() {
      throw new Error("adapter drift");
    }
  });
  const adapterFailureArticle = createArticle({ id: 5 });
  const adapterFailure = throwingAdapterService.createCatalog(
    [adapterFailureArticle],
    {
      categoryId: "mypacks",
      isMyPacks: true,
      nowSeconds: 100_000,
      sortDirection: "desc"
    }
  );
  assert.deepEqual(adapterFailure.data.articles, [adapterFailureArticle]);
  assert.deepEqual(adapterFailure.data.warnings, [
    { index: 0, code: "STORE_PACK_ARTICLE_ADAPTER_FAILED" }
  ]);
  assert.equal(
    service.createCatalog(null, {
      categoryId: 2,
      isMyPacks: false,
      nowSeconds: 100_000,
      sortDirection: "desc"
    }).success,
    false
  );

  const globalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "UTStoreView"
  );
  try {
    const originalCalls = [];
    class StoreView {
      setPacks(...args) {
        originalCalls.push(args);
        return "ea-original";
      }
    }
    globalThis.UTStoreView = StoreView;
    const originalMethod = StoreView.prototype.setPacks;
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      StoreView.prototype,
      "setPacks"
    );
    const patchedCalls = [];
    function fsuStorePackList(...args) {
      patchedCalls.push(args);
      return "fsu-patched";
    }
    const call = { other: { store: { setPacks: originalMethod } } };
    const registry = new PatchLifecycleRegistry();
    const installOptions = {
      call,
      patchLifecycle: registry,
      patchedMethod: fsuStorePackList
    };

    assert.equal(installStorePackListPatch(installOptions).status, "installed");
    assert.equal(registry.isInstalled(STORE_PATCH_IDS.PACK_LIST), true);
    const storeView = new StoreView();
    assert.equal(storeView.setPacks("packs"), "fsu-patched");
    assert.deepEqual(patchedCalls, [["packs"]]);
    assert.equal(
      installStorePackListPatch(installOptions).status,
      "already-installed"
    );

    const events = {};
    registerStorePackListLifecycleEvents({
      call,
      events,
      patchLifecycle: registry,
      patchedMethod: fsuStorePackList
    });
    assert.equal(events.setStorePackListPatchEnabled(false).status, "restored");
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(StoreView.prototype, "setPacks"),
      originalDescriptor
    );
    assert.equal(storeView.setPacks("restored"), "ea-original");
    assert.deepEqual(originalCalls, [["restored"]]);
    assert.equal(
      events.setStorePackListPatchEnabled(true).status,
      "installed"
    );
    assert.equal(storeView.setPacks("again"), "fsu-patched");
    assert.equal(events.setStorePackListPatchEnabled(false).status, "restored");

    class MismatchedStoreView {
      setPacks() {}
    }
    globalThis.UTStoreView = MismatchedStoreView;
    const mismatchMethod = MismatchedStoreView.prototype.setPacks;
    assert.equal(
      installStorePackListPatch({
        ...installOptions,
        patchLifecycle: new PatchLifecycleRegistry()
      }).status,
      "verify-failed"
    );
    assert.strictEqual(
      MismatchedStoreView.prototype.setPacks,
      mismatchMethod
    );

    delete globalThis.UTStoreView;
    assert.equal(
      installStorePackListPatch({
        ...installOptions,
        patchLifecycle: new PatchLifecycleRegistry()
      }).status,
      "unsupported"
    );
  } finally {
    if (globalDescriptor) {
      Object.defineProperty(globalThis, "UTStoreView", globalDescriptor);
    } else {
      delete globalThis.UTStoreView;
    }
  }
}
