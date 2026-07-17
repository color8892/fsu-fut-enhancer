import assert from "node:assert/strict";
import { renderAuctionPriceBreakdown } from "../src/fsu/ui/MarketAuctionRenderer.js";

export function runMarketAuctionRendererTests() {
  const appended = [];
  const parent = {
    appendChild(element) {
      appended.push(element);
    }
  };
  const anchor = {
    getRootElement: () => ({ parentNode: parent })
  };
  const controls = [];

  const rendered = renderAuctionPriceBreakdown(
    anchor,
    [
      { price: 1100, count: 2 },
      { price: 1200, count: 1 }
    ],
    {
      createControl() {
        const control = {};
        controls.push(control);
        return control;
      },
      createButton(control, label, onClick, style) {
        assert.strictEqual(control, controls.at(-1));
        assert.equal(label, `price ${controls.length}`);
        assert.equal(typeof onClick, "function");
        assert.equal(style, "accordian");
        const root = { style: {} };
        return {
          getRootElement: () => root,
          setInteractionState: (state) => assert.equal(state, 0),
          setSubtext(text) {
            root.subtext = text;
          },
          displayCurrencyIcon(value) {
            root.currency = value;
          }
        };
      },
      localize: () => "price"
    }
  );

  assert.equal(rendered, true);
  assert.equal(appended.length, 2);
  assert.deepEqual(
    appended.map(({ subtext, currency, style }) => ({
      subtext,
      currency,
      fontSize: style.fontSize
    })),
    [
      { subtext: "1,100 ×2", currency: true, fontSize: "87.5%" },
      { subtext: "1,200 ×1", currency: true, fontSize: "87.5%" }
    ]
  );

  assert.equal(
    renderAuctionPriceBreakdown(anchor, [{ price: 1000, count: 1 }], {
      createControl: () => null,
      createButton: () => null,
      localize: () => "price"
    }),
    false
  );
}
