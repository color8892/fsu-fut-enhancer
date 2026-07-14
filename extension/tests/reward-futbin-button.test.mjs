import assert from "assert";
import { addRewardFutbinButton } from "../src/fsu/patches/panel-patches.js";

export function runRewardFutbinButtonTests() {
  const originalButtonControl = globalThis.UTStandardButtonControl;
  globalThis.UTStandardButtonControl = class {};

  try {
    const appended = [];
    const classNames = [];
    const button = {
      __root: {
        classList: { add: (name) => classNames.push(name) }
      }
    };
    const player = { isPlayer: () => true };
    const view = {
      _rewardsCarousel: {
        _tnsCarousel: {
          __root: {
            classList: {
              length: 2,
              contains: (name) => ["slider", "rewards-slider-container"].includes(name)
            },
            querySelector: () => ({ appendChild: (element) => appended.push(element) })
          }
        }
      }
    };
    addRewardFutbinButton({
      events: { createButton: () => button, openFutbinPlayerUrl: () => {} },
      fy: (key) => key,
      isPhone: () => false
    }, view, { rewards: [{ count: 1, isItem: true, item: player }] });

    assert.strictEqual(view._fsuPlayer, button);
    assert.deepStrictEqual(appended, [button.__root]);
    assert.deepStrictEqual(classNames, ["pcr"]);
  } finally {
    globalThis.UTStandardButtonControl = originalButtonControl;
  }
}
