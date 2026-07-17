import {
  STORE_PACK_OPEN_ERROR_CODES,
  storePackOpenFailure
} from "../domain/StorePackOpenResults.js";

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object";
}

export class StorePackOpenAdapter {
  /**
   * @param {{
   *   openEvent: unknown,
   *   getMyPacks: () => unknown
   * }} options
   */
  constructor({ openEvent, getMyPacks }) {
    this.openEvent = openEvent;
    this.getMyPacks = getMyPacks;
  }

  /**
   * @param {unknown} controller
   * @param {unknown[]} args
   * @returns {{
   *   success: true,
   *   data: (
   *     { tracked: false } |
   *     {
   *       tracked: true,
   *       key: string,
   *       packId: number,
   *       initialCount: number
   *     }
   *   )
   * } | {
   *   success: false,
   *   error: { code: string, issues: string[] }
   * }}
   */
  prepare(controller, args) {
    const event = args[1];
    const options = args[2];
    if (
      !isRecord(controller) ||
      !isRecord(controller.viewmodel) ||
      typeof controller.viewmodel.getPackById !== "function" ||
      !isRecord(options) ||
      !Number.isInteger(options.articleId) ||
      Number(options.articleId) <= 0 ||
      this.openEvent === undefined
    ) {
      return storePackOpenFailure(
        STORE_PACK_OPEN_ERROR_CODES.PRECONDITION,
        [
          "controller.viewmodel.getPackById",
          "options.articleId",
          "UTStorePackDetailsView.Event.OPEN"
        ]
      );
    }

    const tradable =
      typeof options.tradable === "boolean" ? options.tradable : undefined;
    let pack;
    try {
      pack = controller.viewmodel.getPackById(
        Number(options.articleId),
        event === this.openEvent,
        tradable
      );
    } catch {
      return storePackOpenFailure(
        STORE_PACK_OPEN_ERROR_CODES.PRECONDITION,
        ["controller.viewmodel.getPackById"]
      );
    }
    if (!isRecord(pack) || pack.isMyPack !== true) {
      return {
        success: true,
        data: { tracked: false }
      };
    }
    if (
      !Number.isInteger(pack.id) ||
      Number(pack.id) <= 0 ||
      Number(pack.id) !== Number(options.articleId)
    ) {
      return storePackOpenFailure(
        STORE_PACK_OPEN_ERROR_CODES.PRECONDITION,
        ["pack.id", "pack.selection"]
      );
    }

    const inventory = this.readInventory();
    if (!inventory.success) return inventory;
    const packId = Number(pack.id);
    const initialCount = inventory.data.packIds.filter(
      (id) => id === packId
    ).length;
    if (initialCount <= 0) {
      return storePackOpenFailure(
        STORE_PACK_OPEN_ERROR_CODES.PRECONDITION,
        ["repositories.Store.myPacks.selection"]
      );
    }
    return {
      success: true,
      data: {
        tracked: true,
        key: `${packId}-${tradable === true ? "t" : tradable === false ? "u" : "a"}`,
        packId,
        initialCount
      }
    };
  }

  /**
   * @returns {{
   *   success: true,
   *   data: { packIds: number[] }
   * } | {
   *   success: false,
   *   error: { code: string, issues: string[] }
   * }}
   */
  readInventory() {
    let packs;
    try {
      packs = this.getMyPacks();
    } catch {
      return storePackOpenFailure(
        STORE_PACK_OPEN_ERROR_CODES.INVENTORY,
        ["repositories.Store.myPacks.values"]
      );
    }
    if (!Array.isArray(packs)) {
      return storePackOpenFailure(
        STORE_PACK_OPEN_ERROR_CODES.INVENTORY,
        ["repositories.Store.myPacks"]
      );
    }
    const packIds = [];
    for (const pack of packs) {
      if (
        !isRecord(pack) ||
        !Number.isInteger(pack.id) ||
        Number(pack.id) <= 0
      ) {
        return storePackOpenFailure(
          STORE_PACK_OPEN_ERROR_CODES.INVENTORY,
          ["repositories.Store.myPacks.item.id"]
        );
      }
      packIds.push(Number(pack.id));
    }
    return { success: true, data: { packIds } };
  }

  /**
   * @param {number} packId
   * @returns {{
   *   success: true,
   *   data: { remainingCount: number, availablePackIds: number[] }
   * } | {
   *   success: false,
   *   error: { code: string, issues: string[] }
   * }}
   */
  readCompletion(packId) {
    const inventory = this.readInventory();
    if (!inventory.success) return inventory;
    return {
      success: true,
      data: {
        remainingCount: inventory.data.packIds.filter(
          (id) => id === packId
        ).length,
        availablePackIds: [...new Set(inventory.data.packIds)]
      }
    };
  }
}
