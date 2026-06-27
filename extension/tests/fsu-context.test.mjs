import assert from "assert";
import { FsuContext } from "../src/fsu/core/FsuContext.js";
import { createDomainHelpers } from "../src/fsu/core/DomainHelpers.js";

export function runFsuContextTests() {
  const events = { getCachePrice: () => 1, notice: () => {} };
  const info = { build: {}, set: {}, lock: [] };
  const cntlr = { current: () => null, left: () => null };
  const repositories = { Item: { club: { items: { values: () => [] } }, getStorageItems: () => [] }, Squad: {} };
  const priceService = { getFutbinUrl: (url) => url };

  const ctx = new FsuContext({
    events,
    info,
    cntlr,
    repositories,
    services: {},
    debug: {},
    fy: (k) => k,
    eafy: (k) => k,
    futbinId: {},
    pdb: {},
    isPhone: () => false,
    priceService,
    SBCEligibilityKey: {},
    GM_xmlhttpRequest: () => {}
  });

  const picked = ctx.pick("events", "info", "fy");
  assert.strictEqual(picked.events, events);
  assert.strictEqual(picked.info, info);
  assert.strictEqual(picked.fy("x"), "x");
  assert.ok(!("cntlr" in picked));

  const early = ctx.toEarlyModuleDeps();
  assert.ok("SBCEligibilityKey" in early);
  assert.ok(!("eafy" in early));

  const helpers = createDomainHelpers(ctx);
  assert.strictEqual(helpers.market().getInfo(), info);
  assert.strictEqual(helpers.pack().fy("pack"), "pack");
  assert.strictEqual(helpers.autoBuy.getFutbinUrl("/x"), "/x");
  assert.strictEqual(helpers.playerSearch().getBuild(), info.build);
}