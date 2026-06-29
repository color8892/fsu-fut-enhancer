import { wasmCalculateChemistry, wasmGenerateCandidateOptions } from "../infra/WasmCore.js";

export class SbcChemistryService {
  constructor({ getTeamLink, getTeam }) {
    this.getTeamLink = getTeamLink;
    this.getTeam = getTeam;
  }

  getChemistryPointsByThreshold(count, thresholds) {
    if (count >= thresholds[2]) return 3;
    if (count >= thresholds[1]) return 2;
    if (count >= thresholds[0]) return 1;
    return 0;
  }

  calculateChemistryJs(basePlayers, index, candidate, includeMeta = false) {
    if (typeof index === "boolean") {
      includeMeta = index;
      index = undefined;
      candidate = undefined;
    } else if (typeof candidate === "boolean") {
      includeMeta = candidate;
      candidate = undefined;
    }

    const nationCount = {};
    const leagueCount = {};
    const clubCount = {};
    const nationSet = new Set();
    const leagueSet = new Set();
    const clubSet = new Set();

    const getLinkedTeamId = (teamId) => this.getTeamLink(teamId) || teamId;

    basePlayers.forEach((player, playerIndex) => {
      if (!player) return;
      if (index !== undefined && playerIndex === index) return;

      if (player.nationId !== -1) {
        nationCount[player.nationId] = (nationCount[player.nationId] || 0) + 1;
        if (includeMeta) nationSet.add(player.nationId);
      }

      if (player.leagueId !== -1) {
        leagueCount[player.leagueId] = (leagueCount[player.leagueId] || 0) + 1;
        if (includeMeta) leagueSet.add(player.leagueId);
      }

      if (player.teamId !== -1) {
        const linkedTeamId = getLinkedTeamId(player.teamId);
        clubCount[linkedTeamId] = (clubCount[linkedTeamId] || 0) + 1;
        if (includeMeta) clubSet.add(player.teamId);
      }
    });

    if (candidate) {
      if (candidate.nationId !== -1) {
        nationCount[candidate.nationId] = (nationCount[candidate.nationId] || 0) + 1;
        if (includeMeta) nationSet.add(candidate.nationId);
      }

      if (candidate.leagueId !== -1) {
        leagueCount[candidate.leagueId] = (leagueCount[candidate.leagueId] || 0) + 1;
        if (includeMeta) leagueSet.add(candidate.leagueId);
      }

      if (candidate.teamId !== -1) {
        const linkedTeamId = getLinkedTeamId(candidate.teamId);
        clubCount[linkedTeamId] = (clubCount[linkedTeamId] || 0) + 1;
        if (includeMeta) clubSet.add(candidate.teamId);
      }
    }

    const nationPoints = {};
    const leaguePoints = {};
    const clubPoints = {};

    Object.keys(nationCount).forEach((id) => {
      nationPoints[id] = this.getChemistryPointsByThreshold(nationCount[id], [2, 5, 8]);
    });

    Object.keys(leagueCount).forEach((id) => {
      leaguePoints[id] = this.getChemistryPointsByThreshold(leagueCount[id], [3, 5, 8]);
    });

    Object.keys(clubCount).forEach((id) => {
      clubPoints[id] = this.getChemistryPointsByThreshold(clubCount[id], [2, 4, 7]);
    });

    let totalChemistry = 0;

    basePlayers.forEach((player, playerIndex) => {
      if (!player) return;
      if (index !== undefined && playerIndex === index) return;

      let chemistry = 0;
      if (player.nationId !== -1) chemistry += nationPoints[player.nationId] || 0;
      if (player.leagueId !== -1) chemistry += leaguePoints[player.leagueId] || 0;
      if (player.teamId !== -1) {
        chemistry += clubPoints[getLinkedTeamId(player.teamId)] || 0;
      }

      totalChemistry += Math.min(chemistry, 3);
    });

    let candidateChemistry;

    if (candidate) {
      let chemistry = 0;
      if (candidate.nationId !== -1) chemistry += nationPoints[candidate.nationId] || 0;
      if (candidate.leagueId !== -1) chemistry += leaguePoints[candidate.leagueId] || 0;
      if (candidate.teamId !== -1) {
        chemistry += clubPoints[getLinkedTeamId(candidate.teamId)] || 0;
      }

      candidateChemistry = Math.min(chemistry, 3);
      totalChemistry += candidateChemistry;
    }

    const result = { totalChemistry };

    if (candidate) {
      result.playerChemistry = candidateChemistry;
    }

    if (includeMeta) {
      result.meta = {
        nations: Array.from(nationSet),
        leagues: Array.from(leagueSet),
        clubs: Array.from(clubSet)
      };
    }

    return result;
  }

  calculateChemistry(basePlayers, index, candidate, includeMeta = false) {
    return wasmCalculateChemistry(basePlayers, index, candidate, includeMeta, (...args) =>
      this.calculateChemistryJs(...args)
    );
  }

  toWasmPlayerDto(player) {
    if (!player) {
      return null;
    }

    return {
      nation_id: player.nationId ?? -1,
      league_id: player.leagueId ?? -1,
      team_id: player.teamId ?? -1
    };
  }

  buildCandidateOptionsPayload(players, index, targetChemistry, meta) {
    const clubLeagues = {};
    for (const clubId of meta.clubs) {
      const team = this.getTeam(clubId);
      if (team) {
        clubLeagues[clubId] = team.league;
      }
    }

    return {
      players: players.map((player) => this.toWasmPlayerDto(player)),
      skip_index: index,
      target_chemistry: targetChemistry,
      meta: {
        nations: meta.nations,
        leagues: meta.leagues,
        clubs: meta.clubs
      },
      club_leagues: clubLeagues
    };
  }

  generateCandidateOptionsJs(players, index, targetChemistry, meta) {
    const { nations, leagues, clubs } = meta;
    const result = [];
    const resultKeySet = new Set();

    const pushCandidate = (candidate) => {
      const key = `${candidate.nationId}_${candidate.leagueId}_${candidate.teamId}`;
      if (resultKeySet.has(key)) return true;

      const chemistry = this.calculateChemistryJs(players, index, candidate);
      if (chemistry.totalChemistry >= targetChemistry) {
        result.push(candidate);
        resultKeySet.add(key);
        return true;
      }
      return false;
    };

    const pendingNations = [];
    for (const nationId of nations) {
      if (!pushCandidate({ nationId, leagueId: -1, teamId: -1 })) {
        pendingNations.push(nationId);
      }
    }

    const pendingLeagues = [];
    for (const leagueId of leagues) {
      if (!pushCandidate({ nationId: -1, leagueId, teamId: -1 })) {
        pendingLeagues.push(leagueId);
      }
    }

    const clubLeagueMap = new Map();
    for (const clubId of clubs) {
      const team = this.getTeam(clubId);
      if (!team) continue;
      clubLeagueMap.set(clubId, team.league);
    }

    const pendingClubs = [];
    for (const clubId of clubs) {
      const league = clubLeagueMap.get(clubId);
      if (!pendingLeagues.includes(league)) continue;

      if (!pushCandidate({ nationId: -1, leagueId: league, teamId: clubId })) {
        pendingClubs.push(clubId);
      }
    }

    const successNationLeague = new Map();
    for (const nationId of pendingNations) {
      for (const leagueId of pendingLeagues) {
        if (pushCandidate({ nationId, leagueId, teamId: -1 })) {
          if (!successNationLeague.has(leagueId)) {
            successNationLeague.set(leagueId, new Set());
          }
          successNationLeague.get(leagueId).add(nationId);
        }
      }
    }

    for (const nationId of pendingNations) {
      for (const clubId of pendingClubs) {
        const league = clubLeagueMap.get(clubId);
        if (!successNationLeague.get(league)?.has(nationId)) continue;

        pushCandidate({
          nationId,
          leagueId: league,
          teamId: clubId
        });
      }
    }

    return result.map(({ nationId, leagueId, teamId }) => {
      const cleaned = {};
      if (nationId !== -1) cleaned.nationId = nationId;
      if (leagueId !== -1) cleaned.leagueId = leagueId;
      if (teamId !== -1) cleaned.teamId = teamId;
      return cleaned;
    });
  }

  generateCandidateOptions(players, index, targetChemistry, meta) {
    const payload = this.buildCandidateOptionsPayload(players, index, targetChemistry, meta);
    return wasmGenerateCandidateOptions(payload, () =>
      this.generateCandidateOptionsJs(players, index, targetChemistry, meta)
    );
  }

  getChemistryPlayers(controller, targetChemistry) {
    const players = _.map(controller.squad.getFieldPlayers(), (slot) =>
      slot.inPossiblePosition ? slot.item : { teamId: -1, leagueId: -1, nationId: -1 }
    );
    const index = controller.viewmodel.current().index;
    const chemistry = this.calculateChemistry(players, index, true);
    return this.generateCandidateOptions(players, index, targetChemistry, chemistry.meta);
  }

  createEventsFacade() {
    return {
      getChemistryPointsByThreshold: (count, thresholds) =>
        this.getChemistryPointsByThreshold(count, thresholds),
      calculateChemistry: (...args) => this.calculateChemistry(...args),
      generateCandidateOptions: (...args) => this.generateCandidateOptions(...args),
      getChemistryPlayers: (...args) => this.getChemistryPlayers(...args)
    };
  }
}