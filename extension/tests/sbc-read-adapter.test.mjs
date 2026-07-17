import assert from "node:assert/strict";
import {
  SBC_READ_CAPABILITIES,
  SbcReadAdapter
} from "../src/fsu/ea/SbcReadAdapter.js";
import { SbcRequirementsService } from "../src/fsu/domain/SbcRequirementsService.js";

export function runSbcReadAdapterTests() {
  const localization = {};
  const adapter = new SbcReadAdapter({
    getSbcRepository: () => ({
      sets: {
        get: (id) => ({ name: `Set ${id}` })
      }
    }),
    getLocalization: () => localization,
    getLocalizationUtil: () => ({
      teamIdToAbbr15: (id, service) =>
        service === localization ? `Club ${id}` : "",
      leagueIdToName: (id) => `League ${id}`,
      nationIdToName: (id) => `Nation ${id}`
    })
  });

  const requirement = {
    getFirstKey: () => 44,
    getValue: (key) => (key === 44 ? [80, 81] : [])
  };
  assert.deepEqual(adapter.readRequirement(requirement), {
    success: true,
    data: { key: 44, values: [80, 81] }
  });
  assert.deepEqual(adapter.getSetName(6), {
    success: true,
    data: "Set 6"
  });
  assert.deepEqual(adapter.getEntityName("club", 32), {
    success: true,
    data: "Club 32"
  });

  const malformed = adapter.readRequirement({
    getFirstKey: () => 44,
    getValue: () => ({ rating: 80 })
  });
  assert.equal(malformed.success, false);
  assert.equal(
    malformed.error.capability,
    SBC_READ_CAPABILITIES.REQUIREMENT
  );

  const missing = new SbcReadAdapter();
  assert.equal(missing.getSetName(6).success, false);
  assert.equal(
    missing.getSetName(6).error.capability,
    SBC_READ_CAPABILITIES.SET_REPOSITORY
  );
  assert.equal(missing.getEntityName("nation", 52).success, false);

  const eligibilityKeys = {
    CLUB_ID: 1,
    LEAGUE_ID: 2,
    NATION_ID: 3,
    PLAYER_RARITY: 4,
    PLAYER_MIN_OVR: 5,
    PLAYER_RARITY_GROUP: 6,
    PLAYER_EXACT_OVR: 7
  };
  const service = new SbcRequirementsService();
  const helpers = {
    readRequirement: (value) => adapter.readRequirement(value),
    getEntityName: (kind, id) => adapter.getEntityName(kind, id),
    localize: (key, values) =>
      key === "label.general.or"
        ? "or"
        : values
          ? `${key}:${values.join(",")}`
          : key
  };
  assert.equal(
    service.requirementsToText(
      {
        getFirstKey: () => eligibilityKeys.CLUB_ID,
        getValue: () => [32, 32, 45]
      },
      eligibilityKeys,
      helpers
    ),
    "Club 32 OR Club 45"
  );
  assert.equal(
    service.requirementsToText(
      {
        getFirstKey: () => eligibilityKeys.PLAYER_MIN_OVR,
        getValue: () => [80, 82]
      },
      eligibilityKeys,
      helpers
    ),
    "sbc.requirements.rating.min.val:80 OR sbc.requirements.rating.min.val:82"
  );
  assert.equal(
    service.requirementsToText({}, eligibilityKeys, helpers),
    ""
  );
}
