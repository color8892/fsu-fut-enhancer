const DEFAULT_ROSTER_TTL_MS = 30 * 60 * 1000;

/**
 * Prunes extension-owned caches to bounded size / TTL.
 */
export class CachePruner {
  /**
   * @param {() => object} getInfo
   */
  constructor(getInfo) {
    this.getInfo = getInfo;
  }

  pruneRosterData(maxAgeMs = DEFAULT_ROSTER_TTL_MS) {
    const info = this.getInfo();
    const data = info.roster?.data;
    if (!data || typeof data !== "object") return;

    const now = Date.now();
    for (const [id, entry] of Object.entries(data)) {
      if (entry && typeof entry === "object" && entry._ts && now - entry._ts > maxAgeMs) {
        delete data[id];
      }
    }
  }

  pruneAll() {
    this.pruneRosterData();
  }
}