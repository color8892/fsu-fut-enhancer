import assert from "node:assert/strict";
import {
  BULK_PACK_ERROR_CODES,
  BulkPackOpenService
} from "../src/fsu/domain/BulkPackOpenService.js";

export async function runBulkPackOpenTests() {
  const progress = [];
  let opened = 0;
  const service = new BulkPackOpenService({
    adapter: {
      async prepare() {
        return { success: true, data: { packs: [{ id: 1 }, { id: 1 }] } };
      },
      async openAndAssign() {
        opened++;
        return {
          success: true,
          data: {
            players: [
              {
                rating: 88,
                isSpecial: () => true
              }
            ],
            clubCount: 1,
            storageCount: 0
          }
        };
      }
    },
    wait: async () => {},
    delayMs: 0
  });
  const result = await service.run({
    packId: 1,
    count: 2,
    context: {},
    onProgress: (...args) => progress.push(args)
  });
  assert.equal(result.success, true);
  assert.equal(result.data.opened, 2);
  assert.equal(result.data.specialCount, 2);
  assert.equal(result.data.highestRating, 88);
  assert.equal(opened, 2);
  assert.deepEqual(progress, [[1, 2], [2, 2]]);

  assert.equal(
    (
      await service.run({
        packId: 0,
        count: 1,
        context: {}
      })
    ).error.code,
    BULK_PACK_ERROR_CODES.INVALID_INPUT
  );

  let release;
  const cancellable = new BulkPackOpenService({
    adapter: {
      async prepare() {
        return { success: true, data: { packs: [{}, {}] } };
      },
      async openAndAssign() {
        return {
          success: true,
          data: { players: [], clubCount: 0, storageCount: 0 }
        };
      }
    },
    wait: () => new Promise((resolve) => {
      release = resolve;
    })
  });
  const pending = cancellable.run({ packId: 1, count: 2, context: {} });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(cancellable.cancel(), true);
  release();
  assert.equal(
    (await pending).error.code,
    BULK_PACK_ERROR_CODES.CANCELLED
  );
}
