import assert from "assert";
import { SbcChemistryService } from "../src/fsu/domain/SbcChemistryService.js";

globalThis._ = {
  map(collection, iteratee) {
    return collection.map(iteratee);
  }
};

export function runSbcChemistryTests() {
  const service = new SbcChemistryService({
    getTeamLink: (teamId) => teamId,
    getTeam: () => null,
    readChemistryContext: () => ({
      success: true,
      data: {
        players: [
          { nationId: 1, leagueId: 10, teamId: 100 },
          { nationId: -1, leagueId: -1, teamId: -1 }
        ],
        index: 0
      }
    })
  });

  assert.strictEqual(service.getChemistryPointsByThreshold(8, [2, 5, 8]), 3);
  assert.strictEqual(service.getChemistryPointsByThreshold(1, [2, 5, 8]), 0);

  const players = [
    { nationId: 1, leagueId: 10, teamId: 100 },
    { nationId: 1, leagueId: 10, teamId: 101 },
    { nationId: 2, leagueId: 11, teamId: 200 }
  ];

  const chemistry = service.calculateChemistry(players, undefined, undefined, false);
  assert.ok(chemistry.totalChemistry >= 0);

  const withMeta = service.calculateChemistry(players, 0, true);
  assert.ok(withMeta.meta.nations.includes(1));
  assert.ok(withMeta.meta.leagues.includes(10));
  assert.ok(Array.isArray(service.getChemistryPlayers({}, 0)));

  const unavailableService = new SbcChemistryService({
    getTeamLink: (teamId) => teamId,
    getTeam: () => null,
    readChemistryContext: () => ({
      success: false,
      error: { code: "EA_CAPABILITY_UNAVAILABLE" }
    })
  });
  assert.deepStrictEqual(unavailableService.getChemistryPlayers({}, 10), []);
}
