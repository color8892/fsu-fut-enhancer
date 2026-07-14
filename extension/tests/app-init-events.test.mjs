import assert from "assert";
import { PatchRegistry } from "../src/fsu/core/PatchRegistry.js";
import { registerAppInitEvents } from "../src/fsu/patches/app-init.js";

export function runAppInitEventTests() {
  const originalHomeHub = globalThis.UTHomeHubView;
  class HomeHubView {
    getAcademyTile() {
      return "original";
    }
  }
  globalThis.UTHomeHubView = HomeHubView;

  try {
    const rendered = [];
    const events = { createDF: (html) => ({ html }) };
    const deps = {
      events,
      info: {
        evolutions: { newCount: 1, html: "New evolution" },
        base: {}
      },
      fy: (key) => key
    };
    const registry = new PatchRegistry();
    assert.deepStrictEqual(registerAppInitEvents(deps, registry), [
      { id: "home-hub.academy-tile", status: "installed" }
    ]);

    const view = new HomeHubView();
    view._academyTile = {
      __root: { querySelector: () => null },
      __tileContent: { before: (element) => rendered.push(element) }
    };
    assert.strictEqual(view.getAcademyTile(), view._academyTile);
    assert.deepStrictEqual(rendered, [{ html: '<div class="fsu-task">New evolution</div>' }]);

    assert.deepStrictEqual(registerAppInitEvents(deps, registry), [
      { id: "home-hub.academy-tile", status: "already-installed" }
    ]);
    assert.deepStrictEqual(registry.restore("home-hub.academy-tile"), {
      id: "home-hub.academy-tile",
      status: "restored"
    });
    assert.strictEqual(view.getAcademyTile(), "original");
  } finally {
    globalThis.UTHomeHubView = originalHomeHub;
  }
}
