import { EaObservableAdapter } from "./EaObservableAdapter.js";
import { BULK_PACK_ERROR_CODES } from "../domain/BulkPackOpenService.js";

function failure(code, issues) {
  return { success: false, error: { code, issues } };
}

export class BulkPackOpenAdapter {
  constructor({
    repositories,
    services,
    getClubItems,
    itemPile,
    playerInjury,
    purchasePackType,
    storageCapacity = 100,
    observableAdapter = new EaObservableAdapter()
  }) {
    this.repositories = repositories;
    this.services = services;
    this.getClubItems = getClubItems;
    this.itemPile = itemPile;
    this.playerInjury = playerInjury;
    this.purchasePackType = purchasePackType;
    this.storageCapacity = storageCapacity;
    this.observableAdapter = observableAdapter;
  }

  async observe(observable, context, capability) {
    const observed = await this.observableAdapter.observeOnce(
      observable,
      context,
      capability
    );
    if (!observed?.success) return observed;
    return observed.data;
  }

  async prepare({ packId, count, context }) {
    try {
      this.repositories.Item.unassigned.reset();
      const unassigned = await this.observe(
        this.services.Item.requestUnassignedItems(),
        context,
        "store.bulk-open.unassigned"
      );
      if (
        !unassigned?.success ||
        !Array.isArray(unassigned.response?.items) ||
        unassigned.response.items.length > 0
      ) {
        return failure(BULK_PACK_ERROR_CODES.PRECONDITION, [
          "unassigned-items"
        ]);
      }
      const refreshed = await this.observe(
        this.services.Store.getPacks(
          this.purchasePackType.ALL,
          true,
          true
        ),
        context,
        "store.bulk-open.catalog"
      );
      if (!refreshed?.success) {
        return failure(BULK_PACK_ERROR_CODES.PRECONDITION, [
          "store-catalog"
        ]);
      }
      const packs = this.repositories.Store.myPacks
        .values()
        .filter((pack) => Number(pack.id) === packId)
        .slice(0, count);
      if (packs.length !== count) {
        return failure(BULK_PACK_ERROR_CODES.PRECONDITION, [
          "pack-inventory"
        ]);
      }
      return { success: true, data: { packs } };
    } catch {
      return failure(BULK_PACK_ERROR_CODES.PRECONDITION, [
        "bulk-pack-capability"
      ]);
    }
  }

  async openAndAssign({ pack, context, packIndex }) {
    const open = await this.observe(
      pack.open(),
      context,
      "store.bulk-open.pack"
    );
    if (!open?.success || !Array.isArray(open.response?.items)) {
      return failure(BULK_PACK_ERROR_CODES.OPEN_FAILED, ["pack.open"]);
    }
    if (pack.isMyPack === true) {
      try {
        this.services.User.getUser().decrementNumUnopenedPacks();
      } catch {
        // The pack is already open. Keep assigning its items even if EA's
        // local unopened-pack counter cannot be refreshed immediately.
      }
    }
    const club = [];
    const storage = [];
    const storageRatings = this.repositories.Item.storage
      .values()
      .map((item) => Number(item.rating))
      .filter(Number.isFinite);
    const minimumStorageRating = storageRatings.length
      ? Math.min(...storageRatings)
      : 0;
    const currentStorageCount = this.repositories.Item.numItemsInCache(
      this.itemPile.STORAGE
    );
    for (const item of open.response.items) {
      const existing = this.getClubItems(item.definitionId);
      if (!existing.length) {
        club.push(item);
        continue;
      }
      if (
        Number(item.rating) >= minimumStorageRating &&
        currentStorageCount + storage.length < this.storageCapacity
      ) {
        item.duplicateId = existing[0].id;
        item.pile = this.itemPile.PURCHASED;
        item.injuryType = this.playerInjury.NONE;
        storage.push(item);
        continue;
      }
      return failure(BULK_PACK_ERROR_CODES.ASSIGN_FAILED, [
        "duplicate-capacity"
      ]);
    }
    const move = async (items, pile, storageMove = false) => {
      if (!items.length) return { success: true };
      return this.observe(
        this.services.Item.move(items, pile, storageMove),
        context,
        "store.bulk-open.assign"
      );
    };
    const clubResult = await move(club, this.itemPile.CLUB);
    if (!clubResult?.success) {
      return failure(BULK_PACK_ERROR_CODES.ASSIGN_FAILED, ["club-move"]);
    }
    const storageResult = await move(
      storage,
      this.itemPile.STORAGE,
      true
    );
    if (!storageResult?.success) {
      return failure(BULK_PACK_ERROR_CODES.ASSIGN_FAILED, [
        "storage-move"
      ]);
    }
    const players = [...club, ...storage];
    players.forEach((item) => {
      item.packCount = packIndex;
    });
    return {
      success: true,
      data: {
        players,
        clubCount: club.length,
        storageCount: storage.length
      }
    };
  }
}
