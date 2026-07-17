export const PLAYER_METADATA_INVALID = "PLAYER_METADATA_INVALID";

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {string} provider
 * @param {string[]} issues
 */
function invalid(provider, issues) {
  return {
    success: false,
    error: { code: PLAYER_METADATA_INVALID, provider, issues }
  };
}

/**
 * @param {unknown} value
 */
export function parsePlayerMetaConfig(value) {
  if (!isRecord(value)) return invalid("meta", ["response must be an object"]);
  const bodyTypeSource = value.bodyType;
  const baseBodyType = value.baseBodyType;
  const realFace = value.realFace;
  if (
    !isRecord(bodyTypeSource) ||
    !isRecord(baseBodyType) ||
    !Array.isArray(realFace)
  ) {
    return invalid("meta", ["bodyType", "baseBodyType", "realFace"]);
  }

  /** @type {Record<string, number>} */
  const bodyType = {};
  for (const [typeKey, ids] of Object.entries(bodyTypeSource)) {
    const type = Number(typeKey);
    if (!Number.isInteger(type) || !Array.isArray(ids)) {
      return invalid("meta", [`bodyType.${typeKey}`]);
    }
    for (const id of ids) {
      if (!Number.isInteger(id) || Number(id) <= 0) {
        return invalid("meta", [`bodyType.${typeKey}.id`]);
      }
      bodyType[String(id)] = type;
    }
  }

  /** @type {Record<string, number>} */
  const normalizedBaseBodyType = {};
  for (const [id, typeValue] of Object.entries(baseBodyType)) {
    if (!Number.isInteger(Number(id)) || !Number.isInteger(typeValue)) {
      return invalid("meta", [`baseBodyType.${id}`]);
    }
    normalizedBaseBodyType[id] = Number(typeValue);
  }
  if (!realFace.every((id) => Number.isInteger(id) && Number(id) > 0)) {
    return invalid("meta", ["realFace"]);
  }
  return {
    success: true,
    data: { bodyType, baseBodyType: normalizedBaseBodyType, realFace: [...realFace] }
  };
}

/**
 * @param {unknown} value
 */
export function parseGgRatingConfig(value) {
  if (!isRecord(value) || !isRecord(value.rank)) {
    return invalid("ggrating", ["rank must be an object"]);
  }
  for (const [role, thresholds] of Object.entries(value.rank)) {
    if (
      !Array.isArray(thresholds) ||
      !thresholds.every((threshold) => Number.isFinite(threshold))
    ) {
      return invalid("ggrating", [`rank.${role}`]);
    }
  }
  return { success: true, data: value };
}

/**
 * @param {unknown} value
 */
export function parseEvolutionMetadata(value) {
  if (
    !isRecord(value) ||
    !Array.isArray(value.new) ||
    !value.new.every((id) => Number.isInteger(id) && Number(id) > 0)
  ) {
    return invalid("evolutions", ["new must be an array of positive integers"]);
  }
  return { success: true, data: { new: [...value.new] } };
}

/**
 * @param {unknown} value
 */
export function parsePlayerMetadataRows(value) {
  if (!Array.isArray(value)) {
    return invalid("playermeta", ["response must be an array"]);
  }
  /** @type {Record<string, { badytype: number, weight: number, realface: number }>} */
  const players = {};
  for (const [index, row] of value.entries()) {
    if (
      !Array.isArray(row) ||
      row.length !== 4 ||
      !row.every((entry) => Number.isFinite(entry)) ||
      !Number.isInteger(row[0]) ||
      Number(row[0]) <= 0
    ) {
      return invalid("playermeta", [`row[${index}]`]);
    }
    players[String(row[0])] = {
      badytype: Number(row[1]),
      weight: Number(row[2]),
      realface: Number(row[3])
    };
  }
  return { success: true, data: players };
}
