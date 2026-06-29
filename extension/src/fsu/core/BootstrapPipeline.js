import { PatchInstaller } from "./PatchInstaller.js";
import { registerEarlyModules, registerLateModules } from "./ModuleRegistry.js";
import { createCallMaps, createViewCallMap } from "./CallMaps.js";
import { attachServiceNotices, exposeDebugGlobals } from "./StartupFacades.js";
import { HTML_TEMPLATES } from "../data/html-templates.js";
import { registerSettingsScreen } from "../ui/SettingsScreen.js";
import { installAppInitPatches, registerAppInitEvents } from "../patches/app-init.js";

export function runMidBootstrap({ fsuCtx, ctx, events, fy }) {
  installAppInitPatches(fsuCtx.toAppInitPatchesDeps());
  registerEarlyModules(fsuCtx);
  attachServiceNotices(ctx, { events, fy });
  registerAppInitEvents(fsuCtx.toAppInitEventsDeps());
}

export function finalizeBootstrap({ fsuCtx, patchRegistry, html, call }) {
  const { fsuSC } = registerSettingsScreen({
    EAView,
    EAViewController,
    JSUtils,
    ...fsuCtx.toSettingsScreenDeps()
  });
  fsuCtx.fsuSC = fsuSC;

  Object.assign(html, HTML_TEMPLATES);
  call.view = createViewCallMap(patchRegistry);
  Object.assign(call, createCallMaps());

  new PatchInstaller(fsuCtx).installAll();
  registerLateModules(fsuCtx);
  exposeDebugGlobals(fsuCtx);
}