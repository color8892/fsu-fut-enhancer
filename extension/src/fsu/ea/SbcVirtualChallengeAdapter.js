export const SBC_FILL_CAPABILITIES = Object.freeze({
  VIRTUAL_CHALLENGE: "sbc.virtual-challenge"
});

/**
 * @typedef {new (...args: unknown[]) => Record<string, unknown>} RuntimeConstructor
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object";
}

/** @param {string[]} missing */
function unavailable(missing) {
  return {
    success: false,
    error: {
      code: "EA_CAPABILITY_UNAVAILABLE",
      capability: SBC_FILL_CAPABILITIES.VIRTUAL_CHALLENGE,
      missing
    }
  };
}

export class SbcVirtualChallengeAdapter {
  /**
   * @param {{ getRuntime?: () => unknown }} [options]
   */
  constructor({ getRuntime = () => undefined } = {}) {
    this.getRuntime = getRuntime;
  }

  /** @param {unknown} challenge */
  create(challenge) {
    if (
      !isRecord(challenge) ||
      !isRecord(challenge.squad) ||
      typeof challenge.squad.getFormation !== "function" ||
      typeof challenge.squad.getPlayers !== "function" ||
      !Array.isArray(challenge.eligibilityRequirements)
    ) {
      return unavailable(["challenge.squad", "challenge.requirements"]);
    }

    let runtime;
    try {
      runtime = this.getRuntime();
    } catch {
      return unavailable(["sbc.virtual-challenge.runtime"]);
    }
    if (!isRecord(runtime)) {
      return unavailable(["sbc.virtual-challenge.runtime"]);
    }

    const sourceSquad = challenge.squad;
    if (!isRecord(sourceSquad)) {
      return unavailable(["challenge.squad"]);
    }
    const ChallengeEntity =
      /** @type {RuntimeConstructor | null} */ (
        typeof runtime.UTSBCChallengeEntity === "function"
          ? /** @type {unknown} */ (runtime.UTSBCChallengeEntity)
          : null
      );
    const NullItemEntity =
      /** @type {RuntimeConstructor | null} */ (
        typeof runtime.UTNullItemEntity === "function"
          ? /** @type {unknown} */ (runtime.UTNullItemEntity)
          : null
      );
    const ItemEntity =
      /** @type {RuntimeConstructor | null} */ (
        typeof runtime.UTItemEntity === "function"
          ? /** @type {unknown} */ (runtime.UTItemEntity)
          : null
      );
    const SquadEntity =
      /** @type {RuntimeConstructor | null} */ (
        typeof runtime.UTSquadEntity === "function"
          ? /** @type {unknown} */ (runtime.UTSquadEntity)
          : null
      );
    const ChemistryUtils =
      /** @type {RuntimeConstructor | null} */ (
        typeof runtime.UTSquadChemCalculatorUtils === "function"
          ? /** @type {unknown} */ (runtime.UTSquadChemCalculatorUtils)
          : null
      );
    const generateSbcSquadOptions = runtime.generateSbcSquadOptions;
    const missing = [];
    if (!ChallengeEntity) {
      missing.push("UTSBCChallengeEntity");
    }
    if (!NullItemEntity) {
      missing.push("UTNullItemEntity");
    }
    if (!ItemEntity) {
      missing.push("UTItemEntity");
    }
    if (!SquadEntity) {
      missing.push("UTSquadEntity");
    }
    if (!ChemistryUtils) {
      missing.push("UTSquadChemCalculatorUtils");
    }
    if (
      typeof generateSbcSquadOptions !== "function" ||
      !runtime.sbcFactory ||
      !runtime.squadDao ||
      !runtime.chemistryService ||
      !runtime.teamConfig
    ) {
      missing.push("sbc.virtual-challenge.dependencies");
    }
    if (missing.length > 0) return unavailable(missing);
    if (
      !ChallengeEntity ||
      !NullItemEntity ||
      !ItemEntity ||
      !SquadEntity ||
      !ChemistryUtils ||
      typeof generateSbcSquadOptions !== "function"
    ) {
      return unavailable(["sbc.virtual-challenge.constructors"]);
    }

    try {
      const getFormation = sourceSquad.getFormation;
      const getPlayers = sourceSquad.getPlayers;
      if (typeof getFormation !== "function" || typeof getPlayers !== "function") {
        return unavailable(["challenge.squad.methods"]);
      }
      const formation = getFormation.call(sourceSquad);
      const sourceSlots = getPlayers.call(sourceSquad);
      if (
        !isRecord(formation) ||
        typeof formation.name !== "string" ||
        !Array.isArray(sourceSlots) ||
        !sourceSlots.every(
          (slot) => isRecord(slot) && typeof slot.getItem === "function"
        )
      ) {
        return unavailable(["challenge.squad.snapshot"]);
      }

      const newChallenge = new ChallengeEntity({
        assetId: "virtual",
        description: "virtual",
        eligibilityOperation: challenge.eligibilityOperation,
        endTime: challenge.endTime,
        formation: formation.name,
        id: 888888,
        name: "virtual",
        priority: challenge.priority,
        repeatable: challenge.repeatable,
        requirements: challenge.eligibilityRequirements,
        rewards: [],
        setId: 888888,
        status: challenge.status,
        timesCompleted: challenge.timesCompleted,
        type: challenge.type
      });
      const squadInfo = {
        chemistry: 0,
        id: 888888,
        formation: formation.name,
        manager: [new NullItemEntity()],
        players: Array.from({ length: 23 }, (_, index) => ({
          index,
          itemData: new ItemEntity()
        })),
        rating: 0
      };
      const simpleBrickIndices = Array.isArray(sourceSquad.simpleBrickIndices)
        ? sourceSquad.simpleBrickIndices
        : [];
      const brickIndices =
        simpleBrickIndices.length > 0
          ? Array.from({ length: 11 }, (_, index) => ({
              index,
              playerType: simpleBrickIndices.includes(index)
                ? "BRICK"
                : "DEFAULT"
            }))
          : undefined;
      const newSquad = new SquadEntity(
        generateSbcSquadOptions(
          squadInfo,
          runtime.sbcFactory,
          brickIndices
        ),
        runtime.squadDao,
        new ChemistryUtils(runtime.chemistryService, runtime.teamConfig)
      );
      if (
        !isRecord(newSquad) ||
        typeof newSquad.setPlayers !== "function" ||
        !isRecord(newChallenge)
      ) {
        return unavailable(["sbc.virtual-challenge.result"]);
      }
      newSquad.setPlayers(
        sourceSlots.map((slot) => slot.getItem()),
        true
      );
      newChallenge.squad = newSquad;
      return { success: true, data: newChallenge };
    } catch {
      return unavailable(["sbc.virtual-challenge.create"]);
    }
  }
}
