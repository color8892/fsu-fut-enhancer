import {
  parsePackPreview,
  parsePackProbability,
  parsePlayerPickPreview
} from "./PackPreviewResults.js";

/** @param {unknown} value */
function slugify(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/\//g, "&");
  return encodeURIComponent(normalized).slice(0, 192);
}

/**
 * @typedef {(method: "GET", url: string, body: null, accept: string) =>
 *   Promise<unknown>} PreviewRequest
 */

export class PackPreviewService {
  /** @param {{request: PreviewRequest}} deps */
  constructor({ request }) {
    this.request = request;
  }

  /** @param {{id: string | number, name: unknown}} input */
  async getPackPreview({ id, name }) {
    const url = this.buildUrl("pack", id, name, true);
    if (!url) return parsePackPreview(null);
    return parsePackPreview(
      await this.request("GET", url, null, "text/x-component")
    );
  }

  /** @param {{id: string | number, name: unknown}} input */
  async getPlayerPickPreview({ id, name }) {
    const url = this.buildUrl("playerpick", id, name, true);
    if (!url) return parsePlayerPickPreview(null);
    return parsePlayerPickPreview(
      await this.request("GET", url, null, "text/x-component")
    );
  }

  /** @param {{id: string | number, name: unknown}} input */
  async getProbability({ id, name }) {
    const url = this.buildUrl("pack", id, name, false);
    if (!url) return parsePackProbability(null);
    return parsePackProbability(
      await this.request("GET", url, null, "text/x-component")
    );
  }

  /**
   * @param {"pack" | "playerpick"} type
   * @param {string | number} id
   * @param {unknown} name
   * @param {boolean} open
   */
  buildUrl(type, id, name, open) {
    if (
      !["pack", "playerpick"].includes(type) ||
      !Number.isInteger(Number(id)) ||
      Number(id) <= 0
    ) {
      return null;
    }
    const slug = slugify(name);
    if (!slug) return null;
    return `https://www.futnext.com/${type}/${slug}/${Number(id)}/${open ? "open" : ""}`;
  }
}
