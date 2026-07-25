const MAX_METADATA_RECORDS = 5000;
const MAX_METADATA_ARRAY = 200;

/**
 * @typedef {{a: unknown[], b: unknown[], c: unknown[]}} CachedPlayerMeta
 * @typedef {{
 *   playerMetaData?: Record<number, CachedPlayerMeta>
 * }} PlayerMetaInfo
 * @typedef {{
 *   log?: (message: string, error: unknown) => void
 * }} PlayerMetaDebug
 * @typedef {{
 *   createSubAttribute: (key: number, value: unknown) => unknown,
 *   createRole: (value: unknown) => unknown
 * }} PlayerMetaCapabilities
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {unknown[] | null}
 */
function cloneArray(value) {
  if (!Array.isArray(value) || value.length > MAX_METADATA_ARRAY) return null;
  return value.map((item) => {
    if (item === null || ["string", "number", "boolean"].includes(typeof item)) {
      return item;
    }
    if (!isRecord(item)) return null;
    return { ...item };
  });
}

export class PlayerMetaCacheService {
  /**
   * @param {{
   *   info: PlayerMetaInfo,
   *   persist: (key: string, value: string) => void,
   *   getYear: () => string | number,
   *   debug?: PlayerMetaDebug
   * }} deps
   */
  constructor({ info, persist, getYear, debug }) {
    this.info = info;
    this.persist = persist;
    this.getYear = getYear;
    this.debug = debug;
  }

  /** @param {unknown} value */
  capture(value) {
    if (!Array.isArray(value) || value.length > MAX_METADATA_RECORDS) {
      return false;
    }
    const next = { ...(this.info.playerMetaData || {}) };
    let changed = false;
    for (const entry of value) {
      if (
        !isRecord(entry) ||
        !Number.isInteger(entry.defId) ||
        Number(entry.defId) <= 0
      ) {
        continue;
      }
      const definitionId = Number(entry.defId);
      if (Object.prototype.hasOwnProperty.call(next, definitionId)) continue;
      const attributes = cloneArray(entry.ingameattribs ?? []);
      const rolePlus = cloneArray(entry.rolePlus ?? []);
      const rolePlusPlus = cloneArray(entry.rolePlusPlus ?? []);
      if (!attributes || !rolePlus || !rolePlusPlus) continue;
      next[definitionId] = {
        a: attributes,
        b: rolePlus,
        c: rolePlusPlus
      };
      changed = true;
    }
    if (!changed) return true;
    this.info.playerMetaData = next;
    try {
      this.persist(`playerMetaData_${this.getYear()}`, JSON.stringify(next));
    } catch (error) {
      this.debug?.log?.("Player metadata cache persist failed", error);
      return false;
    }
    return true;
  }

  /**
   * @param {{definitionId?: unknown} | null | undefined} player
   * @param {unknown} metaData
   * @param {PlayerMetaCapabilities} capabilities
   */
  hydrate(player, metaData, capabilities) {
    const definitionId = Number(player?.definitionId);
    const cached = this.info.playerMetaData?.[definitionId];
    if (!cached || !isRecord(metaData)) return metaData;
    const { createSubAttribute, createRole } = capabilities;
    if (typeof createSubAttribute !== "function" || typeof createRole !== "function") {
      return metaData;
    }
    try {
      const copy = { ...metaData };
      copy.attributes = cached.a.map((value, key) =>
        createSubAttribute(key, value)
      );
      copy.rolePlus = cached.b.map((value) => createRole(value));
      copy.rolePlusPlus = cached.c.map((value) => createRole(value));
      copy.isLocal = true;
      return copy;
    } catch (error) {
      this.debug?.log?.("Player metadata cache hydrate failed", error);
      return metaData;
    }
  }
}
