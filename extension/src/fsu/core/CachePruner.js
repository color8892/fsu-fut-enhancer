const DEFAULT_ROSTER_TTL_MS = 30 * 60 * 1000;
const DEFAULT_IMG_CACHE_MAX = 120;
const DEFAULT_INFO_VIEW_MAX = 80;

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

  pruneGgr(maxAgeSeconds = 168 * 3600) {
    const info = this.getInfo();
    const ggr = info.ggr;
    if (!ggr || typeof ggr !== "object") return;

    const cutoff = Math.floor(Date.now() / 1000) - maxAgeSeconds;
    for (const [id, entry] of Object.entries(ggr)) {
      const time = parseInt(entry?.time, 10);
      if (isNaN(time) || time < cutoff) {
        delete ggr[id];
      }
    }
  }

  pruneImgCache(maxSize = DEFAULT_IMG_CACHE_MAX) {
    const info = this.getInfo();
    const cache = info.base?.imgCache;
    if (!cache || typeof cache !== "object") return;

    const keys = Object.keys(cache);
    if (keys.length <= maxSize) return;

    const removeCount = keys.length - maxSize;
    for (let i = 0; i < removeCount; i++) {
      delete cache[keys[i]];
    }
  }

  pruneAutoBuyInfoViews(maxSize = DEFAULT_INFO_VIEW_MAX) {
    const info = this.getInfo();
    const views = info.autobuy?.infoViews;
    if (!views || typeof views !== "object") return;

    const keys = Object.keys(views);
    if (keys.length <= maxSize) return;

    const removeCount = keys.length - maxSize;
    for (let i = 0; i < removeCount; i++) {
      const key = keys[i];
      const view = views[key];
      if (view instanceof EAView) {
        view.dealloc();
      }
      delete views[key];
    }
  }

  pruneAll() {
    this.pruneRosterData();
    this.pruneGgr();
    this.pruneImgCache();
    this.pruneAutoBuyInfoViews();
  }
}