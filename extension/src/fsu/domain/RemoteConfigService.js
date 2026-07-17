import { responseText, safeParseJson } from "../infra/JsonParsing.js";
import { applyLowpriceToInfo } from "../infra/RatingPrices.js";
import {
  parseEvolutionMetadata,
  parseGgRatingConfig,
  parsePlayerMetaConfig,
  parsePlayerMetadataRows
} from "./PlayerMetadataResults.js";

const API_BASE_URL = "https://api.fut.to/26";
const README_URL = "https://mfrasi851i.feishu.cn/wiki/wikcng1Ih7fFRidBfMdNS9SrucR";

export class RemoteConfigService {
  constructor({
    info,
    fy,
    debug,
    notice,
    request,
    taskHtml,
    scriptVersion,
    nowSeconds = () => Math.floor(Date.now() / 1000),
    applyLowprice = applyLowpriceToInfo
  }) {
    this.info = info;
    this.fy = fy;
    this.debug = debug;
    this.notice = notice;
    this.request = request;
    this.taskHtml = taskHtml;
    this.scriptVersion = scriptVersion;
    this.nowSeconds = nowSeconds;
    this.applyLowprice = applyLowprice;
  }

  parseResponse(res, fallback, label) {
    return safeParseJson(responseText(res), fallback, {
      label,
      onError: (error, context) => this.debug.log(`${context.label} parse failed`, error)
    });
  }

  load({ onHeaderReady } = {}) {
    this.request({
      method: "GET",
      url: `${API_BASE_URL}/updata.json`,
      timeout: 8000,
      headers: {
        "Content-type": "application/json",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      },
      onload: (res) => this.handleAppConfig(res, { onHeaderReady }),
      onerror: () => {
        this.notice("notice.upgrade.failed", 2);
      }
    });
  }

  handleAppConfig(res, { onHeaderReady } = {}) {
    let urlText = this.fy("top.readme");
    let urlLink = README_URL;

    if (res.status == 404) {
      this.notice("notice.upgradefailed", 2);
    } else {
      const data = this.parseResponse(res, {}, "updata.json");
      const myVersion = Number(this.scriptVersion) || 0;

      if (data.version > myVersion) {
        urlText = this.fy("top.upgrade");
        urlLink = data.updateURL;
        this.notice("notice.upgradeconfirm", 1);
      }

      if (_.size(data.api)) {
        this.info.api = data.api;
        this.loadApiData();
      }
    }

    onHeaderReady?.({ urlText, urlLink });
  }

  loadApiData() {
    const api = this.info.api;
    this.loadEndpoint(api, "meta", "meta.json", {}, (data) => this.applyMeta(data));
    this.loadEndpoint(api, "fastsbc", "fast.json", {}, (data) => this.applyFastSbc(data));
    this.loadEndpoint(api, "pack", "pack.json", {}, (data) => {
      this.info.base.oddo = data;
    });
    this.loadEndpoint(api, "sbc", "sbc.json", { reward: [], new: [] }, (data) => this.applySbc(data));
    this.loadEndpoint(api, "ggrating", "ggrating.json", {}, (data) => {
      const result = parseGgRatingConfig(data);
      if (result.success) {
        this.info.GGRRAR = result.data;
        this.debug.log(`GGRRAR加载完毕！`);
      } else {
        this.debug.log("ggrating response rejected", result.error);
      }
    });
    this.loadEndpoint(api, "evolutions", "evolutions.json", { new: [] }, (data) => {
      const result = parseEvolutionMetadata(data);
      if (result.success) {
        this.info.evolutions.new = result.data.new;
        this.debug.log(`evolutions加载完毕！`);
      } else {
        this.debug.log("evolutions response rejected", result.error);
      }
    });
    this.loadEndpoint(api, "inpacks", "inpacks.json", {}, (data) => this.applyInpacks(data));
    this.loadEndpoint(api, "other", "other.json", {}, (data) => this.applyOther(data));
    this.loadEndpoint(api, "fgconfig", "fgconfig.json", {}, (data) => {
      this.info.fgconfig = data;
      this.debug.log(`fgconfig加载完毕！`);
    });
    this.loadEndpoint(api, "playermeta", "playermeta.json", [], (data) => this.applyPlayerMeta(data));
    this.loadEndpoint(api, "lowprice", "lowprice.json", {}, (data) => {
      this.applyLowprice(this.info, data);
      this.debug.log(`lowprice加载完毕！`);
    });
  }

  loadEndpoint(api, apiKey, fileName, fallback, applyData) {
    if (!_.has(api, apiKey)) {
      return;
    }

    this.request({
      method: "GET",
      url: `${API_BASE_URL}/${fileName}?${api[apiKey]}`,
      headers: {
        "Content-type": "application/json",
        "Cache-Control": "max-age=31536000"
      },
      onload: (res) => {
        applyData(this.parseResponse(res, fallback, fileName));
      }
    });
  }

  applyMeta(metaJson) {
    const result = parsePlayerMetaConfig(metaJson);
    if (!result.success) {
      this.debug.log("meta response rejected", result.error);
      return false;
    }
    this.info.meta = { ...this.info.meta, ...result.data };
    this.debug.log(`meta加载完毕！`);
    return true;
  }

  applyFastSbc(fastSbcJson) {
    _.forEach(fastSbcJson, (item, key) => {
      if (item.t > this.nowSeconds()) {
        this.info.base.fastsbc[key] = item.g;
      }
    });
  }

  applySbc(sbcJson) {
    this.info.task.sbc.stat = sbcJson;
    const rewardText = _.map(sbcJson.reward || [], (item) =>
      item == 1 ? this.fy("task.player") : item == 2 ? this.fy("task.pack") : ""
    );
    this.info.task.sbc.html = this.taskHtml((sbcJson.new || []).length, rewardText.join("、"));
  }

  applyInpacks(data) {
    const { defIds = [], rarityIds = [] } = data;
    this.info.inpacks.defIds = defIds;
    this.info.inpacks.rarityIds = rarityIds;
    this.debug.log(`inpacks加载完毕！`);
  }

  applyOther(data) {
    const { dynamic = {}, chem = {} } = data;
    this.info.specialPlayers = {
      dynamic,
      DList: Object.entries(dynamic)
        .filter(([_key, value]) => value.exp && value.exp > Date.now() / 1000)
        .map(([key, _value]) => Number(key)),
      extraChem: chem,
      ECList: Object.keys(chem).map((key) => Number(key))
    };
    this.debug.log(`other加载完毕！`);
  }

  applyPlayerMeta(data) {
    const result = parsePlayerMetadataRows(data);
    if (!result.success) {
      this.debug.log("playermeta response rejected", result.error);
      return false;
    }
    this.info.playermeta = result.data;
    this.debug.log(`playermeta加载完毕！`);
    return true;
  }
}

export { API_BASE_URL, README_URL };
