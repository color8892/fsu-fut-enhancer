import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PatchLifecycleRegistry } from "../src/fsu/core/PatchLifecycleRegistry.js";
import {
  REWARD_PATCH_IDS,
  installRewardChoiceSetPatch
} from "../src/fsu/patches/rewards.js";
import {
  UI_UTILS_PATCH_IDS,
  installPlusPlayStylesPatch
} from "../src/fsu/patches/ui-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FSU_DIR = path.resolve(__dirname, "../src/fsu");

/** Extension-owned Store controller methods are not EA targets. */
const ALLOWLIST_TARGETS = new Set([
  "FsuStorePackListController.prototype",
  "FsuStorePackOpenController.prototype"
]);

/**
 * Scan production sources for Class.prototype.method = assignments.
 * Descriptor generic helpers (Object.defineProperty) are not counted.
 */
function collectPrototypeAssignments(rootDir) {
  /** @type {Map<string, string[]>} */
  const owners = new Map();
  const assignmentRe =
    /\b([A-Za-z0-9_$]+)\.prototype\.([A-Za-z0-9_$]+)\s*=/g;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".js")) continue;
      if (entry.name === "userscript.js") continue;
      const text = fs.readFileSync(full, "utf8");
      const rel = path.relative(FSU_DIR, full);
      let match;
      while ((match = assignmentRe.exec(text))) {
        const target = `${match[1]}.prototype.${match[2]}`;
        if (ALLOWLIST_TARGETS.has(`${match[1]}.prototype`)) continue;
        if (!owners.has(target)) owners.set(target, []);
        owners.get(target).push(rel);
      }
    }
  }

  walk(rootDir);
  return owners;
}

export async function runPatchSingleOwnerTests() {
  // Inventory: no multi-owner prototype assignments in production.
  const owners = collectPrototypeAssignments(path.join(FSU_DIR, "patches"));
  // Also scan installer for direct assignments.
  const installerPath = path.join(FSU_DIR, "core", "PatchInstaller.js");
  const installerText = fs.readFileSync(installerPath, "utf8");
  const installerRe = /\b([A-Za-z0-9_$]+)\.prototype\.([A-Za-z0-9_$]+)\s*=/g;
  let m;
  while ((m = installerRe.exec(installerText))) {
    const target = `${m[1]}.prototype.${m[2]}`;
    if (!owners.has(target)) owners.set(target, []);
    owners.get(target).push("core/PatchInstaller.js");
  }

  const duplicates = [...owners.entries()].filter(([, files]) => files.length > 1);
  assert.deepEqual(
    duplicates,
    [],
    `Multiple production owners for prototype members: ${JSON.stringify(duplicates)}`
  );

  // Specifically the two PR21 targets must not appear as direct assignments.
  assert.equal(
    owners.has("UTRewardSelectionChoiceView.prototype.expandRewardSet"),
    false,
    "expandRewardSet must be descriptor-owned, not a direct assignment"
  );
  assert.equal(
    owners.has("UTItemEntity.prototype.getPlusPlayStyles"),
    false,
    "getPlusPlayStyles must be descriptor-owned, not a direct assignment"
  );

  // Reward composition lifecycle tests.
  const globalRewardDesc = Object.getOwnPropertyDescriptor(
    globalThis,
    "UTRewardSelectionChoiceView"
  );
  const globalButtonDesc = Object.getOwnPropertyDescriptor(
    globalThis,
    "UTStandardButtonControl"
  );
  const globalLodash = globalThis._;
  try {
    let originalCalls = 0;
    class RewardView {
      constructor() {
        this.__expandedReward = {
          querySelectorAll: () => [{}, {}]
        };
        this.__title = {
          children: [],
          appendChild(child) {
            this.children.push(child);
          }
        };
        this._rewardsCarousel = {
          _tnsCarousel: {
            __root: {
              classList: {
                length: 2,
                contains(name) {
                  return name === "slider" || name === "rewards-slider-container";
                }
              },
              querySelector: () => ({
                children: [],
                appendChild(child) {
                  this.children.push(child);
                }
              })
            }
          }
        };
      }
      expandRewardSet(_e, _t) {
        originalCalls += 1;
        return "ea-result";
      }
    }
    globalThis.UTRewardSelectionChoiceView = RewardView;
    globalThis.UTStandardButtonControl = class {};
    globalThis._ = {
      map: (items, iteratee) => items.map(iteratee)
    };

    const registry = new PatchLifecycleRegistry();
    const valueCalls = [];
    const futbinCalls = [];
    let valueShouldThrow = false;
    let futbinShouldThrow = false;
    const events = {
      setRewardOddo(target, reward, type) {
        valueCalls.push({ target, reward, type });
        if (valueShouldThrow) throw new Error("value boom");
        return 100;
      },
      createButton(_btn, _text, _handler, className) {
        if (futbinShouldThrow) throw new Error("futbin boom");
        futbinCalls.push(className);
        return { __root: { classList: { add() {} } } };
      },
      createElementWithConfig(tag, config) {
        return {
          tag,
          ...config,
          appendChild() {},
          style: {}
        };
      },
      openFutbinPlayerUrl() {}
    };
    const info = { set: { player_futbin: true } };
    const install = () =>
      installRewardChoiceSetPatch({
        call: {},
        events,
        info,
        fy: (k) => k,
        isPhone: () => false,
        patchLifecycle: registry
      });

    assert.equal(install().status, "installed");
    assert.equal(install().status, "already-installed");

    const view = new RewardView();
    const rewards = {
      rewards: [
        {
          count: 1,
          isItem: true,
          item: { isPlayer: () => true }
        },
        { count: 0 }
      ]
    };
    const returned = view.expandRewardSet("e", rewards);
    assert.equal(returned, "ea-result");
    assert.equal(originalCalls, 1);
    assert.equal(valueCalls.length, 2);
    assert.equal(futbinCalls.length, 1);

    // Isolation: value throw still runs futbin.
    valueCalls.length = 0;
    futbinCalls.length = 0;
    originalCalls = 0;
    valueShouldThrow = true;
    assert.equal(view.expandRewardSet("e", rewards), "ea-result");
    assert.equal(originalCalls, 1);
    assert.equal(futbinCalls.length, 1);
    valueShouldThrow = false;

    // Isolation: futbin throw still runs value.
    valueCalls.length = 0;
    futbinCalls.length = 0;
    originalCalls = 0;
    futbinShouldThrow = true;
    assert.equal(view.expandRewardSet("e", rewards), "ea-result");
    assert.equal(originalCalls, 1);
    assert.equal(valueCalls.length, 2);
    futbinShouldThrow = false;

    // Exact restore.
    const before = RewardView.prototype.expandRewardSet;
    assert.equal(
      registry.restore(REWARD_PATCH_IDS.CHOICE_SET_RENDER).status,
      "restored"
    );
    assert.notEqual(RewardView.prototype.expandRewardSet, before);
    originalCalls = 0;
    assert.equal(view.expandRewardSet("e", rewards), "ea-result");
    assert.equal(originalCalls, 1);
    assert.equal(valueCalls.length, 2); // unchanged after restore (no augments)

    // Reinstall.
    assert.equal(install().status, "installed");
  } finally {
    if (globalRewardDesc) {
      Object.defineProperty(globalThis, "UTRewardSelectionChoiceView", globalRewardDesc);
    } else {
      delete globalThis.UTRewardSelectionChoiceView;
    }
    if (globalButtonDesc) {
      Object.defineProperty(globalThis, "UTStandardButtonControl", globalButtonDesc);
    } else {
      delete globalThis.UTStandardButtonControl;
    }
    if (globalLodash === undefined) delete globalThis._;
    else globalThis._ = globalLodash;
  }

  // Plus play styles lifecycle.
  const globalItemDesc = Object.getOwnPropertyDescriptor(globalThis, "UTItemEntity");
  try {
    let originalCalls = 0;
    class ItemEntity {
      getPlusPlayStyles() {
        originalCalls += 1;
        return this._styles;
      }
    }
    globalThis.UTItemEntity = ItemEntity;
    globalThis._ = {
      uniqWith(items, comparator) {
        const out = [];
        for (const item of items) {
          if (!out.some((existing) => comparator(existing, item))) {
            out.push(item);
          }
        }
        return out;
      }
    };
    const registry = new PatchLifecycleRegistry();
    assert.equal(
      installPlusPlayStylesPatch({ patchLifecycle: registry }).status,
      "installed"
    );
    assert.equal(
      installPlusPlayStylesPatch({ patchLifecycle: registry }).status,
      "already-installed"
    );

    const a = { id: 1, equals(other) { return other.id === this.id; } };
    const b = { id: 1, equals(other) { return other.id === this.id; } };
    const c = { id: 2, equals(other) { return other.id === this.id; } };
    const item = new ItemEntity();
    item._styles = [a, b, c];
    const normalized = item.getPlusPlayStyles();
    assert.equal(originalCalls, 1);
    assert.equal(normalized.length, 2);

    item._styles = null;
    assert.deepEqual(item.getPlusPlayStyles(), []);

    item._styles = [{ id: 3 }]; // no equals
    assert.deepEqual(item.getPlusPlayStyles().length, 1);

    assert.equal(
      registry.restore(UI_UTILS_PATCH_IDS.PLUS_PLAYSTYLES).status,
      "restored"
    );
    item._styles = [a, b];
    originalCalls = 0;
    const restored = item.getPlusPlayStyles();
    assert.equal(originalCalls, 1);
    assert.equal(restored.length, 2);
  } finally {
    if (globalItemDesc) {
      Object.defineProperty(globalThis, "UTItemEntity", globalItemDesc);
    } else {
      delete globalThis.UTItemEntity;
    }
    if (globalLodash === undefined) delete globalThis._;
    else globalThis._ = globalLodash;
  }
}
