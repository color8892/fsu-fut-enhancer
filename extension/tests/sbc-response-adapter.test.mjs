import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SbcResponseAdapter } from "../src/fsu/domain/SbcResponseAdapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "ea", name), "utf8"));
}

export function runSbcResponseAdapterTests() {
  const adapter = new SbcResponseAdapter();

  const sets = adapter.adaptSetsResponse(readFixture("sbs-sets.json"));
  assert.strictEqual(sets.categories.length, 1);
  assert.strictEqual(sets.categories[0].categoryId, 1);
  assert.strictEqual(sets.categories[0].sets[0].setId, 6);
  assert.strictEqual(sets.categories[0].sets[0].repeatable, true);
  assert.strictEqual(sets.categories[0].sets[0].challengesCount, 1);

  const challenges = adapter.adaptChallengesResponse(readFixture("sbs-set-6-challenges.json"));
  assert.strictEqual(challenges.challenges.length, 1);
  assert.strictEqual(challenges.challenges[0].challengeId, 17);
  assert.strictEqual(challenges.challenges[0].eligibilityOperation, "AND");
  assert.deepStrictEqual(challenges.challenges[0].eligibilityRequirements[0], {
    type: "PLAYER",
    eligibilitySlot: -1,
    eligibilityKey: 44,
    eligibilityValue: 80
  });

  const challengeSquad = adapter.adaptChallengeSquadResponse(readFixture("sbs-challenge-17-squad.json"));
  assert.strictEqual(challengeSquad.challengeId, 17);
  assert.strictEqual(challengeSquad.squad.id, 123456);
  assert.strictEqual(challengeSquad.squad.players.length, 2);
  assert.deepStrictEqual(challengeSquad.squad.players[0].itemData, {
    id: 1001,
    assetId: 50563169,
    rating: 83,
    itemType: "player",
    resourceId: 50563169,
    preferredPosition: "ST",
    untradeable: false,
    teamid: 32,
    nation: 52,
    rareflag: 1
  });

  assert.throws(
    () => adapter.adaptSetsResponse({ categories: {} }),
    /SBC sets response\.categories must be an array/
  );
  assert.throws(
    () => adapter.adaptChallengesResponse({ challenges: [{ challengeId: 17, setId: 6 }] }),
    /SBC challenge\[0\]\.elgReq must be an array/
  );
  assert.throws(
    () => adapter.adaptChallengeSquadResponse({ challengeId: 17, squad: { id: 1, players: [{}] } }),
    /SBC challenge squad player\[0\]\.index must be a number/
  );
}
