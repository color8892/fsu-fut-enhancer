import assert from "node:assert/strict";
import {
  PLAYER_METADATA_INVALID,
  parseEvolutionMetadata,
  parseGgRatingConfig,
  parsePlayerMetaConfig,
  parsePlayerMetadataRows
} from "../src/fsu/domain/PlayerMetadataResults.js";

export function runPlayerMetadataResultTests() {
  assert.deepEqual(
    parsePlayerMetaConfig({
      bodyType: { 2: [10, 11] },
      baseBodyType: { 10: 2 },
      realFace: [10]
    }),
    {
      success: true,
      data: {
        bodyType: { 10: 2, 11: 2 },
        baseBodyType: { 10: 2 },
        realFace: [10]
      }
    }
  );
  const malformedMeta = parsePlayerMetaConfig({
    bodyType: { 2: ["10"] },
    baseBodyType: {},
    realFace: []
  });
  assert.equal(malformedMeta.success, false);
  assert.equal(malformedMeta.error?.code, PLAYER_METADATA_INVALID);

  assert.equal(
    parseGgRatingConfig({ rank: { 1: [90, 80] } }).success,
    true
  );
  assert.equal(parseGgRatingConfig({ rank: { 1: ["90"] } }).success, false);
  assert.deepEqual(parseEvolutionMetadata({ new: [7, 8] }), {
    success: true,
    data: { new: [7, 8] }
  });
  assert.equal(parseEvolutionMetadata({ new: [0] }).success, false);
  assert.deepEqual(parsePlayerMetadataRows([[100, 2, 75, 1]]), {
    success: true,
    data: { 100: { badytype: 2, weight: 75, realface: 1 } }
  });
  assert.equal(parsePlayerMetadataRows([[100, 2, "75", 1]]).success, false);
}
