export const SBC_SNAPSHOT_INVALID = "SBC_SNAPSHOT_INVALID";

/**
 * @typedef {{
 *   success: false,
 *   error: {
 *     code: typeof SBC_SNAPSHOT_INVALID,
 *     provider: string,
 *     issues: string[]
 *   }
 * }} InvalidSbcSnapshotResult
 */

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
 * @returns {InvalidSbcSnapshotResult}
 */
function invalid(provider, issues) {
  return {
    success: false,
    error: {
      code: SBC_SNAPSHOT_INVALID,
      provider,
      issues
    }
  };
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {{ success: true, data: number } | InvalidSbcSnapshotResult}
 */
function positiveInteger(value, label) {
  const result = finiteNumber(value);
  return result !== null && Number.isInteger(result) && result > 0
    ? { success: true, data: result }
    : invalid("futbin-squad", [label]);
}

/**
 * @param {unknown} response
 */
export function parseFutbinTopSquads(response) {
  if (!isRecord(response) || !Array.isArray(response.data)) {
    return invalid("futbin-top-squads", ["data"]);
  }

  const squads = [];
  for (const [index, item] of response.data.entries()) {
    if (!isRecord(item)) {
      return invalid("futbin-top-squads", [`data[${index}]`]);
    }
    const id = positiveInteger(item.id, `data[${index}].id`);
    const likes = finiteNumber(item.likes);
    if (!id.success || likes === null) {
      return invalid("futbin-top-squads", [
        !id.success ? `data[${index}].id` : `data[${index}].likes`
      ]);
    }
    squads.push({ ...item, id: id.data, likes });
  }
  return { success: true, data: squads, mappings: [] };
}

/**
 * @param {Record<string, unknown>} item
 * @param {string} label
 * @returns {{
 *   success: true,
 *   data: Record<string, unknown>
 * } | InvalidSbcSnapshotResult}
 */
function parseFutbinSquadPlayer(item, label) {
  const integerFields = [
    "Player_Resource",
    "id",
    "rating",
    "club",
    "league",
    "nation",
    "raretype"
  ];
  const normalized = { ...item };
  for (const field of integerFields) {
    const value = finiteNumber(item[field]);
    if (value === null || !Number.isInteger(value) || value < 0) {
      return invalid("futbin-squad", [`${label}.${field}`]);
    }
    normalized[field] = value;
  }
  if (
    Number(normalized.Player_Resource) <= 0 ||
    Number(normalized.id) <= 0 ||
    typeof item.org_pos !== "string" ||
    !Array.isArray(item.alternativePositions) ||
    !item.alternativePositions.every((position) => typeof position === "string")
  ) {
    return invalid("futbin-squad", [`${label}.shape`]);
  }
  const price = finiteNumber(item.price);
  if (price === null || price < 0) {
    return invalid("futbin-squad", [`${label}.price`]);
  }
  normalized.price = price;
  return { success: true, data: normalized };
}

/**
 * @param {unknown} response
 */
export function parseFutbinSquad(response) {
  if (
    !isRecord(response) ||
    !isRecord(response.squad_data) ||
    typeof response.squad_data.Formation !== "string"
  ) {
    return invalid("futbin-squad", ["squad_data"]);
  }

  const squad = { ...response.squad_data };
  const mappings = [];
  const playerEntries = Object.entries(response.squad_data).filter(([key]) =>
    /^cardlid\d+$/.test(key)
  );
  if (playerEntries.length === 0) {
    return invalid("futbin-squad", ["squad_data.cardlid"]);
  }
  for (const [key, item] of playerEntries) {
    if (!isRecord(item)) {
      return invalid("futbin-squad", [`squad_data.${key}`]);
    }
    const parsed = parseFutbinSquadPlayer(item, `squad_data.${key}`);
    if (!parsed.success) return parsed;
    squad[key] = parsed.data;
    mappings.push(parsed.data);
  }
  return { success: true, data: squad, mappings };
}

/**
 * @param {unknown} response
 */
export function parseFutGgSquad(response) {
  if (
    !isRecord(response) ||
    !isRecord(response.data) ||
    !isRecord(response.data.data)
  ) {
    return invalid("futgg-squad", ["data.data"]);
  }
  const positions = response.data.data.activeGroupPositions;
  if (!Array.isArray(positions) && !isRecord(positions)) {
    return invalid("futgg-squad", ["data.data.activeGroupPositions"]);
  }
  for (const [key, position] of Object.entries(positions)) {
    if (
      !isRecord(position) ||
      !Number.isInteger(Number(position.playerEaId)) ||
      Number(position.playerEaId) <= 0
    ) {
      return invalid("futgg-squad", [
        `data.data.activeGroupPositions.${key}`
      ]);
    }
  }
  return { success: true, data: response.data, mappings: [] };
}

/**
 * @param {unknown} response
 * @param {number} type
 */
export function parseRemoteSbcSquad(response, type) {
  if (type === 1) return parseFutbinTopSquads(response);
  if (type === 2) return parseFutbinSquad(response);
  if (type === 3) return parseFutGgSquad(response);
  return invalid("sbc-squad", ["type"]);
}
