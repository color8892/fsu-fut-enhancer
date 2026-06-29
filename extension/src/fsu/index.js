import { futweb } from "./legacy/futweb.js";
import { applyFsuLodashMixins } from "./domain/lodashMixins.js";
import { initWasmCore } from "./infra/WasmCore.js";

class FsuUserscriptApp {
  constructor(windowRef, lodashRef) {
    this.windowRef = windowRef;
    this.lodashRef = lodashRef;
    this.href = windowRef.location.href;
  }

  run() {
    this.exposeLodash();
    applyFsuLodashMixins(this.lodashRef);

    if (this.isFutWebApp()) {
      initWasmCore();
      futweb();
    }
  }

  exposeLodash() {
    unsafeWindow._ = this.lodashRef;
  }

  isFutWebApp() {
    return this.lodashRef.includes(this.href, "ultimate-team/web-app");
  }
}

new FsuUserscriptApp(window, _).run();