export const SBC_SQUAD_CAPABILITIES = Object.freeze({
  CHEMISTRY_CONTEXT: "sbc.chemistry-context"
});

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object";
}

/**
 * @param {string[]} missing
 */
function unavailable(missing) {
  return {
    success: false,
    error: {
      code: "EA_CAPABILITY_UNAVAILABLE",
      capability: SBC_SQUAD_CAPABILITIES.CHEMISTRY_CONTEXT,
      missing
    }
  };
}

/**
 * @param {unknown} value
 */
function chemistryId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id >= -1 ? id : null;
}

export class SbcSquadSnapshotAdapter {
  /**
   * @param {unknown} controller
   */
  readChemistryContext(controller) {
    if (!isRecord(controller) || !isRecord(controller.squad)) {
      return unavailable(["controller.squad"]);
    }
    const getFieldPlayers = controller.squad.getFieldPlayers;
    if (
      typeof getFieldPlayers !== "function" ||
      !isRecord(controller.viewmodel) ||
      typeof controller.viewmodel.current !== "function"
    ) {
      return unavailable([
        "controller.squad.getFieldPlayers",
        "controller.viewmodel.current"
      ]);
    }

    try {
      const slots = getFieldPlayers.call(controller.squad);
      const current = controller.viewmodel.current.call(controller.viewmodel);
      if (!Array.isArray(slots) || !isRecord(current)) {
        return unavailable(["controller.squad.slots", "controller.viewmodel.current.result"]);
      }
      const index = Number(current.index);
      if (!Number.isInteger(index) || index < 0 || index >= slots.length) {
        return unavailable(["controller.viewmodel.current.index"]);
      }

      const players = [];
      for (const [slotIndex, slot] of slots.entries()) {
        if (!isRecord(slot) || typeof slot.inPossiblePosition !== "boolean") {
          return unavailable([`controller.squad.slots[${slotIndex}]`]);
        }
        if (!slot.inPossiblePosition) {
          players.push({ nationId: -1, leagueId: -1, teamId: -1 });
          continue;
        }
        if (!isRecord(slot.item)) {
          return unavailable([`controller.squad.slots[${slotIndex}].item`]);
        }
        const nationId = chemistryId(slot.item.nationId);
        const leagueId = chemistryId(slot.item.leagueId);
        const teamId = chemistryId(slot.item.teamId);
        if (nationId === null || leagueId === null || teamId === null) {
          return unavailable([`controller.squad.slots[${slotIndex}].chemistry`]);
        }
        players.push({ nationId, leagueId, teamId });
      }
      return { success: true, data: { players, index } };
    } catch {
      return unavailable(["controller.chemistry-context.read"]);
    }
  }
}
