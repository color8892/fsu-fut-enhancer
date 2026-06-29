/**
 * Service facades and save/toggle notice wiring during futweb bootstrap.
 */

import { getWasmCoreVersion, isWasmCoreReady } from "../infra/WasmCore.js";

export function createStartupFacades(ctx, { events, isPhone, fy, priceService }) {
  const set = ctx.settingsService.createFacade({
    createToggle: (...args) => events.createToggle(...args),
    fy
  });
  const build = ctx.buildPreferencesService.createFacade();
  const lock = ctx.playerLockService.createFacade();
  const SBCCount = ctx.sbcCountService.createFacade({
    isPhone,
    fy,
    createButton: (...args) => events.createButton(...args),
    popup: (...args) => events.popup(...args)
  });
  const futbinId = priceService.createFutbinIdFacade();

  return { set, build, lock, SBCCount, futbinId };
}

export function attachServiceNotices(ctx, { events, fy }) {
  ctx.settingsService.setOnSave(() => events.notice(fy("notice.setsuccess"), 0));
  ctx.buildPreferencesService.setOnSave(() => events.notice(fy("notice.setsuccess"), 0));
  ctx.playerLockService.setOnToggle((action) => {
    events.notice(fy(action === "unlock" ? "notice.unlockplayer" : "notice.lockplayer"), 0);
  });
}

export function exposeDebugGlobals(fsuCtx) {
  if (typeof FSU_DEBUG === "undefined" || !FSU_DEBUG) {
    return;
  }

  const exposed = fsuCtx.toDebugExpose();
  unsafeWindow.call = exposed.call;
  unsafeWindow.info = exposed.info;
  unsafeWindow.cntlr = exposed.cntlr;
  unsafeWindow.events = exposed.events;
  unsafeWindow.fy = exposed.fy;
  unsafeWindow.GM_addStyle = GM_addStyle;
  unsafeWindow.fsuWasmReady = isWasmCoreReady;
  unsafeWindow.fsuWasmVersion = getWasmCoreVersion;
}