import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SBC_SNAPSHOT_INVALID,
  parseFutbinSquad,
  parseFutbinTopSquads,
  parseFutGgSquad
} from "../src/fsu/domain/SbcSnapshotResults.js";
import {
  SBC_SQUAD_CAPABILITIES,
  SbcSquadSnapshotAdapter
} from "../src/fsu/ea/SbcSquadSnapshotAdapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readFixture(name) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "fixtures", "ea", name), "utf8")
  );
}

export function runSbcSnapshotResultTests() {
  const topSquads = parseFutbinTopSquads({
    data: [{ id: "17", likes: "4" }]
  });
  assert.equal(topSquads.success, true);
  assert.deepEqual(topSquads.data, [{ id: 17, likes: 4 }]);

  const squad = parseFutbinSquad(readFixture("futbin-squad.json"));
  assert.equal(squad.success, true);
  assert.equal(squad.data.Formation, "4-4-2");
  assert.equal(squad.data.cardlid11.Player_Resource, 50563169);
  assert.equal(squad.mappings.length, 2);

  const malformed = readFixture("futbin-squad.json");
  malformed.squad_data.cardlid10.Player_Resource = "not-an-id";
  const rejected = parseFutbinSquad(malformed);
  assert.equal(rejected.success, false);
  assert.equal(rejected.error.code, SBC_SNAPSHOT_INVALID);
  assert.deepEqual(rejected.error.issues, [
    "squad_data.cardlid10.Player_Resource"
  ]);

  const futGg = parseFutGgSquad({
    data: {
      data: {
        activeGroupPositions: [{ playerEaId: 50563169 }]
      }
    }
  });
  assert.equal(futGg.success, true);
  assert.equal(
    parseFutGgSquad({
      data: { data: { activeGroupPositions: [{ playerEaId: null }] } }
    }).success,
    false
  );

  const adapter = new SbcSquadSnapshotAdapter();
  const context = adapter.readChemistryContext({
    squad: {
      getFieldPlayers: () => [
        {
          inPossiblePosition: true,
          item: { nationId: 52, leagueId: 13, teamId: 32 }
        },
        { inPossiblePosition: false }
      ]
    },
    viewmodel: { current: () => ({ index: 0 }) }
  });
  assert.deepEqual(context, {
    success: true,
    data: {
      players: [
        { nationId: 52, leagueId: 13, teamId: 32 },
        { nationId: -1, leagueId: -1, teamId: -1 }
      ],
      index: 0
    }
  });
  const unavailable = adapter.readChemistryContext({});
  assert.equal(unavailable.success, false);
  assert.equal(
    unavailable.error.capability,
    SBC_SQUAD_CAPABILITIES.CHEMISTRY_CONTEXT
  );
}
