import { PatchLifecycleRegistry } from "../../../src/fsu/core/PatchLifecycleRegistry.js";
import {
  MARKET_PATCH_IDS,
  registerMarketLifecycleEvents
} from "../../../src/fsu/patches/market.js";
import {
  STORE_PATCH_IDS,
  installStorePackAnimationPatch,
  registerStorePackOpenLifecycleEvents,
  registerStorePackListLifecycleEvents
} from "../../../src/fsu/patches/store.js";

const MarketSearchView = globalThis.UTMarketSearchView;
const originalGenerate = MarketSearchView?.prototype?._generate;
const diagnostics = [];
const patchLifecycle = new PatchLifecycleRegistry({
  onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)
});
const events = {};

registerMarketLifecycleEvents({
  call: { view: { market: originalGenerate } },
  events,
  patchLifecycle
});

const initialInstall = events.setMarketSearchGenerateEnabled(true);

const StoreView = globalThis.UTStoreView;
const originalSetPacks = StoreView?.prototype?.setPacks;
const storeEvents = {};
function fsuStorePackList(...args) {
  globalThis.__FSU_STORE_PATCH_CALLS__.push([...args]);
  return "fsu-store";
}
registerStorePackListLifecycleEvents({
  call: { other: { store: { setPacks: originalSetPacks } } },
  events: storeEvents,
  patchLifecycle,
  patchedMethod: fsuStorePackList
});
const initialStoreInstall = storeEvents.setStorePackListPatchEnabled(true);

const StoreViewController = globalThis.UTStoreViewController;
const originalOpenPack = StoreViewController?.prototype?.eOpenPack;
const storeOpenEvents = {};
registerStorePackOpenLifecycleEvents({
  call: { other: { store: { eOpenPack: originalOpenPack } } },
  events: storeOpenEvents,
  patchLifecycle,
  transactionService: {
    intercept(options) {
      globalThis.__FSU_STORE_OPEN_PATCH_CALLS__.push([...options.args]);
      return options.invoke();
    }
  },
  onSuccess: () => {},
  onDiagnostic: () => {}
});
const initialStoreOpenInstall =
  storeOpenEvents.setStorePackOpenPatchEnabled(true);

const PackAnimationViewController =
  globalThis.UTPackAnimationViewController;
function fsuStorePackAnimation(...args) {
  globalThis.__FSU_STORE_ANIMATION_PATCH_CALLS__.push([...args]);
  return "fsu-animation";
}
const installStoreAnimation = () =>
  installStorePackAnimationPatch({
    patchLifecycle,
    patchedMethod: fsuStorePackAnimation
  });
const initialStoreAnimationInstall = installStoreAnimation();

globalThis.__FSU_USERSCRIPT_SMOKE__ = true;
globalThis.__FSU_EA_SHELL__ = Object.freeze({
  patchId: MARKET_PATCH_IDS.SEARCH_VIEW_GENERATE,
  initialInstall,
  setEnabled(enabled) {
    return events.setMarketSearchGenerateEnabled(enabled);
  },
  invoke(generated, ...args) {
    const view = new MarketSearchView();
    view._generated = generated;
    return view._generate(...args);
  },
  state() {
    return {
      installed: patchLifecycle.isInstalled(
        MARKET_PATCH_IDS.SEARCH_VIEW_GENERATE
      ),
      methodName: MarketSearchView.prototype._generate.name,
      diagnostics: patchLifecycle.getDiagnostics(),
      shellCalls: globalThis.__FSU_EA_SHELL_CALLS__.map((args) => [...args])
    };
  },
  store: Object.freeze({
    patchId: STORE_PATCH_IDS.PACK_LIST,
    initialInstall: initialStoreInstall,
    setEnabled(enabled) {
      return storeEvents.setStorePackListPatchEnabled(enabled);
    },
    invoke(...args) {
      const view = new StoreView();
      return view.setPacks(...args);
    },
    state() {
      return {
        installed: patchLifecycle.isInstalled(STORE_PATCH_IDS.PACK_LIST),
        methodName: StoreView.prototype.setPacks.name,
        originalCalls: globalThis.__FSU_STORE_ORIGINAL_CALLS__.map(
          (args) => [...args]
        ),
        patchedCalls: globalThis.__FSU_STORE_PATCH_CALLS__.map(
          (args) => [...args]
        )
      };
    }
  }),
  storeOpen: Object.freeze({
    patchId: STORE_PATCH_IDS.PACK_OPEN_TRANSACTION,
    initialInstall: initialStoreOpenInstall,
    setEnabled(enabled) {
      return storeOpenEvents.setStorePackOpenPatchEnabled(enabled);
    },
    invoke(...args) {
      const controller = new StoreViewController();
      return controller.eOpenPack(...args);
    },
    state() {
      return {
        installed: patchLifecycle.isInstalled(
          STORE_PATCH_IDS.PACK_OPEN_TRANSACTION
        ),
        methodName: StoreViewController.prototype.eOpenPack.name,
        originalCalls: globalThis.__FSU_STORE_OPEN_ORIGINAL_CALLS__.map(
          (args) => [...args]
        ),
        patchedCalls: globalThis.__FSU_STORE_OPEN_PATCH_CALLS__.map(
          (args) => [...args]
        )
      };
    }
  }),
  storeAnimation: Object.freeze({
    patchId: STORE_PATCH_IDS.PACK_ANIMATION,
    initialInstall: initialStoreAnimationInstall,
    setEnabled(enabled) {
      return enabled
        ? installStoreAnimation()
        : patchLifecycle.restore(STORE_PATCH_IDS.PACK_ANIMATION);
    },
    invoke(...args) {
      const controller = new PackAnimationViewController();
      return controller.runAnimation(...args);
    },
    state() {
      return {
        installed: patchLifecycle.isInstalled(
          STORE_PATCH_IDS.PACK_ANIMATION
        ),
        hasOwnMethod: Object.hasOwn(
          PackAnimationViewController.prototype,
          "runAnimation"
        ),
        methodName:
          PackAnimationViewController.prototype.runAnimation?.name ?? null,
        patchedCalls:
          globalThis.__FSU_STORE_ANIMATION_PATCH_CALLS__.map(
            (args) => [...args]
          )
      };
    }
  })
});
