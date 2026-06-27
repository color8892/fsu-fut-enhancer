/**
 * Central runtime context for FSU futweb wiring.
 * Replaces ad-hoc patchCtx objects with typed dependency picking.
 */
export class FsuContext {
  /**
   * @param {Record<string, unknown>} fields
   */
  constructor(fields) {
    Object.assign(this, fields);
  }

  /**
   * @param {...string} keys
   * @returns {Record<string, unknown>}
   */
  pick(...keys) {
    const out = {};
    for (const key of keys) {
      out[key] = this[key];
    }
    return out;
  }

  toEarlyModuleDeps() {
    return this.pick("events", "info", "repositories", "services", "debug", "fy", "SBCEligibilityKey");
  }

  toLateModuleDeps() {
    return this.pick(
      "events",
      "info",
      "repositories",
      "services",
      "cntlr",
      "debug",
      "fy",
      "eafy",
      "futbinId",
      "pdb",
      "isPhone",
      "httpClient",
      "priceService"
    );
  }

  toAppInitPatchesDeps() {
    return this.pick(
      "events",
      "info",
      "fy",
      "services",
      "cntlr",
      "isPhone",
      "SBCCount",
      "set",
      "build",
      "lock",
      "futbinId",
      "debug",
      "GM_getValue",
      "GM_setValue",
      "GM_xmlhttpRequest",
      "GM_info"
    );
  }

  toAppInitEventsDeps() {
    return this.pick(
      "events",
      "info",
      "fy",
      "cntlr",
      "isPhone",
      "services",
      "repositories",
      "debug",
      "SBCCount",
      "set",
      "build",
      "lock",
      "GM_getValue",
      "GM_setValue",
      "GM_xmlhttpRequest",
      "GM_info"
    );
  }

  toSettingsScreenDeps() {
    return this.pick(
      "events",
      "fy",
      "cntlr",
      "info",
      "set",
      "GM_openInTab",
      "isPhone",
      "enums"
    );
  }

  toDebugExpose() {
    return this.pick("call", "info", "cntlr", "events", "fy");
  }
}