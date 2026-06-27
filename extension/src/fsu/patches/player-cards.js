import { installMiscItemPatch } from "./misc-item.js";
import { installPlayerItemPatch } from "./player-item.js";

export function installPlayerCardPatches(deps) {
  installPlayerItemPatch(deps);
  installMiscItemPatch(deps);
}