import assert from "node:assert/strict";
import { PatchLifecycleRegistry } from "../src/fsu/core/PatchLifecycleRegistry.js";
import { PlayerMetaCacheService } from "../src/fsu/domain/PlayerMetaCacheService.js";
import {
  PLAYER_META_CACHE_PATCH_IDS,
  installPlayerMetaCachePatches
} from "../src/fsu/patches/player-meta-cache.js";

function saveGlobals(names) {
  return new Map(
    names.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name)
    ])
  );
}

function restoreGlobals(descriptors) {
  for (const [name, descriptor] of descriptors) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      delete globalThis[name];
    }
  }
}

export function runPlayerMetaCacheTests() {
  const info = {
    base: { year: 26 },
    playerMetaData: {}
  };
  const writes = [];
  const service = new PlayerMetaCacheService({
    info,
    persist: (key, value) => writes.push([key, value]),
    getYear: () => info.base.year,
    debug: { log() {} }
  });
  assert.equal(
    service.capture([
      {
        defId: 123,
        ingameattribs: [80, 90],
        rolePlus: [{ id: 1 }],
        rolePlusPlus: [2]
      },
      { defId: "bad", ingameattribs: [] }
    ]),
    true
  );
  assert.deepEqual(info.playerMetaData[123], {
    a: [80, 90],
    b: [{ id: 1 }],
    c: [2]
  });
  assert.equal(writes[0][0], "playerMetaData_26");

  const hydrated = service.hydrate(
    { definitionId: 123 },
    { name: "meta" },
    {
      createSubAttribute: (key, value) => ({ key, value }),
      createRole: (value) => ({ role: value })
    }
  );
  assert.deepEqual(hydrated, {
    name: "meta",
    attributes: [
      { key: 0, value: 80 },
      { key: 1, value: 90 }
    ],
    rolePlus: [{ role: { id: 1 } }],
    rolePlusPlus: [{ role: 2 }],
    isLocal: true
  });
  assert.equal(service.capture({}), false);

  const globals = saveGlobals([
    "XMLHttpRequest",
    "UTItemEntityFactory",
    "UTItemEntity",
    "UTPlayerSubAttributeVO",
    "UTAcademyUtils",
    "AcademyStatEnum",
    "ItemSubAttribute",
    "ItemType"
  ]);
  try {
    class FakeXhr {
      constructor() {
        this.listeners = new Map();
        this.responseText = "[]";
      }

      addEventListener(name, listener) {
        this.listeners.set(name, listener);
      }

      open(method, url) {
        return [method, url];
      }
    }
    class FakeFactory {
      generateItemConstructorOptions(input) {
        return { ...input };
      }
    }
    class FakeEntity {
      setMetaData(value) {
        this._metaData = value;
        return "ea-meta";
      }
    }
    class FakeSubAttribute {
      constructor(key, value) {
        this.key = key;
        this.value = value;
      }
    }
    const academyEnums = {
      GK_SUB_DIVING: 1,
      GK_SUB_HANDLING: 2,
      GK_SUB_KICKING: 3,
      GK_SUB_REFLEXES: 4,
      GK_SUB_POSITIONING_SUB: 5
    };
    const academyUtils = {
      getSubAttributeByUpgradeId: (value) => `ea-${value}`
    };
    Object.assign(globalThis, {
      XMLHttpRequest: FakeXhr,
      UTItemEntityFactory: FakeFactory,
      UTItemEntity: FakeEntity,
      UTPlayerSubAttributeVO: FakeSubAttribute,
      UTAcademyUtils: academyUtils,
      AcademyStatEnum: academyEnums,
      ItemSubAttribute: {
        gkdiving: "diving",
        gkhandling: "handling",
        gkkicking: "kicking",
        gkreflexes: "reflexes",
        gkpositioning: "positioning"
      },
      ItemType: { PLAYER: "player" }
    });
    const lifecycle = new PatchLifecycleRegistry();
    const patchInfo = {
      base: { year: 26 },
      playerMetaData: {
        123: { a: [91], b: [1], c: [2] }
      }
    };
    installPlayerMetaCachePatches({
      info: patchInfo,
      services: {
        PlayerMetaData: {
          metaDAO: {
            generatePlayerRoleVO: (value) => ({ role: value })
          }
        }
      },
      repositories: {
        PlayerMeta: { has: () => false }
      },
      GM_setValue() {},
      patchLifecycle: lifecycle,
      debug: { log() {} }
    });
    for (const id of Object.values(PLAYER_META_CACHE_PATCH_IDS)) {
      assert.equal(lifecycle.isInstalled(id), true);
    }
    const options = new FakeFactory().generateItemConstructorOptions({
      definitionId: 123,
      type: "player",
      metaData: {}
    });
    assert.equal(options.metaData.isLocal, true);
    assert.equal(options.metaData.attributes[0].key, 0);
    assert.equal(options.metaData.attributes[0].value, 91);
    const entity = new FakeEntity();
    entity.definitionId = 123;
    entity.type = "player";
    assert.equal(entity.setMetaData({}), "ea-meta");
    assert.equal(entity._metaData.isLocal, true);
    assert.equal(
      academyUtils.getSubAttributeByUpgradeId(
        academyEnums.GK_SUB_POSITIONING_SUB
      ),
      "positioning"
    );
    assert.equal(academyUtils.getSubAttributeByUpgradeId(99), "ea-99");
    const xhr = new FakeXhr();
    assert.deepEqual(xhr.open("GET", "/attributes/metadata"), [
      "GET",
      "/attributes/metadata"
    ]);
    xhr.responseText = JSON.stringify([
      {
        defId: 456,
        ingameattribs: [70],
        rolePlus: [],
        rolePlusPlus: []
      }
    ]);
    xhr.listeners.get("load")();
    assert.deepEqual(patchInfo.playerMetaData[456].a, [70]);
    for (const id of Object.values(PLAYER_META_CACHE_PATCH_IDS).reverse()) {
      assert.equal(lifecycle.restore(id).status, "restored");
    }
  } finally {
    restoreGlobals(globals);
  }
}
