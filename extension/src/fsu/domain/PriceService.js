import { PriceRequestQueue } from "../core/PriceRequestQueue.js";

const PRICE_BATCH_SIZE = 23;

export class PriceService {
  constructor({ httpClient, store, getInfo, debug }) {
    this.httpClient = httpClient;
    this.store = store;
    this.getInfo = getInfo;
    this.debug = debug;
    this.errorHandler = null;
    this.requestQueue = new PriceRequestQueue();
  }

  setErrorHandler(handler) {
    this.errorHandler = handler;
  }

  handleError(error) {
    if (this.errorHandler) {
      this.errorHandler(error);
    }
    throw error;
  }

  request(method, url, body, contentType) {
    return this.httpClient.request(method, url, body, contentType);
  }

  getCachePrice(definitionId, type) {
    const info = this.getInfo();
    const priceDataKey = "data";

    if (!type) {
      return undefined;
    }

    if (type === 1) {
      const item = _.get(info.roster[priceDataKey], definitionId, {});
      const priceInfo = {
        num: item?.n ?? 0,
        text: item?.n?.toLocaleString() ?? "0",
        type: item?.y ?? 0
      };

      if (item?.y !== 0 && item?.n == 0) {
        priceInfo.text = "Reward";
      }

      return priceInfo;
    }

    if (type === 3) {
      return _.has(info.roster[priceDataKey], definitionId);
    }

    return undefined;
  }

  priceLastDiffJs(purchasePrice, lastPrice) {
    let percent = ((Number(purchasePrice) * 0.95) / Number(lastPrice) - 1) * 100;
    percent = Number(percent.toFixed(0));

    if (!isFinite(percent)) {
      percent = 0;
    }

    const value = ("+" + percent + "%").replace("+-", "-");
    return value.indexOf("+") !== -1
      ? `<span class="plus">${value}</span>`
      : `<span class="minus">${value}</span>`;
  }

  priceLastDiff(purchasePrice, lastPrice) {
    return this.priceLastDiffJs(Number(purchasePrice), Number(lastPrice));
  }

  async getFutbinUrl(url) {
    try {
      const response = await this.request("GET", url);
      return JSON.parse(response);
    } catch (error) {
      this.handleError(error);
    }
  }

  async getPriceForUrl(definitionIds) {
    this.debug.log(definitionIds);
    const sortedIds = [...definitionIds].sort((a, b) => a - b);
    const queueKey = `url:${sortedIds.join(",")}`;

    return this.requestQueue.run(queueKey, () => this._fetchPriceForUrl(sortedIds));
  }

  async _fetchPriceForUrl(definitionIds) {
    try {
      const info = this.getInfo();
      const priceJson = {};

      if ([1, 2].includes(info.apiPlatform)) {
        const params = definitionIds.join("%2C");
        const baseUrl =
          info.apiPlatform === 2 ? `${info.apiProxy}?futggapi=` : "https://www.fut.gg/api/fut/";
        const platform = info.base.platform === "pc" ? `&platform=${info.base.platform}` : "";
        const response = await this.request(
          "GET",
          `${baseUrl}player-prices/26/?ids=${params}${platform}`
        );
        const originalJson = JSON.parse(response);

        _.map(originalJson.data, (item) => {
          if (
            item.price !== null ||
            item.isExtinct ||
            item.isSbc ||
            item.isObjective ||
            item.premiumSeasonPassLevel !== null ||
            item.standardSeasonPassLevel !== null
          ) {
            let price = 0;
            let type = 0;

            if (item.isSbc) {
              type = 1;
            } else if (item.isObjective) {
              type =
                item.premiumSeasonPassLevel !== null || item.standardSeasonPassLevel !== null ? 3 : 2;
            }

            if (item.price && item.price !== -1) {
              price = item.price;
            }

            priceJson[item.eaId] = { n: price, y: type, _ts: Date.now() };
          } else {
            this.debug.log("没有这个球员数据:", item.eaId);
          }
        });
      } else if (info.apiPlatform === 3) {
        const params = definitionIds.join("_");
        const response = await this.request(
          "GET",
          `https://enhancer-api.futnext.com/players/prices?ids=${params}&platform=${info.base.platform}`
        );
        const originalJson = JSON.parse(response);

        _.map(originalJson, (item) => {
          if (item.prices.length) {
            priceJson[item.definitionId] = {
              n: item.prices[0],
              y: 0,
              _ts: Date.now()
            };
          }
        });
      }

      return priceJson;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getPriceForFutbin(playerResourceId) {
    try {
      const info = this.getInfo();
      const platform = info.base.platform == "pc" ? "PC" : "PS";
      const response = await this.request(
        "GET",
        `https://www.futbin.org/futbin/api/${info.base.year}/fetchPriceInformation?playerresource=${playerResourceId}&platform=${platform}`
      );
      const originalJson = JSON.parse(response);
      const price = originalJson.LCPrice ?? 0;
      const priceJson = {
        n: price,
        y: originalJson.MinPrice || originalJson.MaxPrice ? 0 : 1
      };

      info.roster.data[playerResourceId] = { ...priceJson, _ts: Date.now() };
      return priceJson;
    } catch (error) {
      this.handleError(error);
    }
  }

  initFutbinId() {
    const info = this.getInfo();
    info.futbinId = this.store.getObject("futbinId", {});
  }

  setFutbinMapping(definitionId, futbinId) {
    const info = this.getInfo();
    info.futbinId[definitionId] = futbinId;
    this.store.setJson("futbinId", info.futbinId);
  }

  setPriceFromFutbinData(data, definitionId) {
    const info = this.getInfo();
    const platform = info.base.platform == "pc" ? "pc_" : "ps_";
    const price = data.LCPrice ?? data[`${platform}LCPrice`] ?? data.price ?? 0;
    const min = data.MinPrice ?? data[`${platform}MinPrice`] ?? 1;
    const max = data.MaxPrice ?? data[`${platform}MaxPrice`] ?? 1;
    let type = 0;

    if (min == 0 && max == 0) {
      type = price == 0 ? 2 : 1;
    }

    info.roster.data[definitionId] = { n: price, y: type, _ts: Date.now() };
  }

  async getFutbinPlayerId(player) {
    try {
      const info = this.getInfo();
      const platform = info.base.platform == "pc" ? "PC" : "PS";
      const nation = player.nationId;
      const team = player.teamId;
      const league = player.leagueId;
      const rating = player._rating;
      const position = info.posIdToName[player.preferredPosition];
      const response = await this.request(
        "GET",
        `https://www.futbin.org/futbin/api/${info.base.year}/getFilteredPlayers?platform=${platform}&nation=${nation}&league=${league}&rating=${rating}-${rating}&club=${team}&sort=rating&position=${position}&order=desc&page=1`
      );
      const data = JSON.parse(response);

      _.forEach(data.data, (itemData) => {
        this.setPriceFromFutbinData(itemData, itemData.resource_id);
        this.setFutbinMapping(itemData.resource_id, itemData.ID);
      });

      return info.futbinId[player.definitionId] || 0;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getFutbinPrice(definitionId, futbinId) {
    try {
      const info = this.getInfo();
      const platform = info.base.platform == "pc" ? "PC" : "PS";
      const response = await this.request(
        "GET",
        `https://www.futbin.org/futbin/api/${info.base.year}/fetchPlayerInformationMinimal?ID=${futbinId}&platform=${platform}`
      );
      const data = JSON.parse(response);

      _.forEach(data.data, (itemData) => {
        this.setPriceFromFutbinData(itemData, itemData.Player_Resource);
      });

      return info.roster.data[definitionId];
    } catch (error) {
      this.handleError(error);
    }
  }

  createFutbinIdFacade() {
    return {
      init: () => this.initFutbinId(),
      set: (definitionId, futbinId) => this.setFutbinMapping(definitionId, futbinId),
      getId: (player) => this.getFutbinPlayerId(player),
      getPrice: (definitionId, futbinId) => this.getFutbinPrice(definitionId, futbinId),
      setPrice: (data, definitionId) => this.setPriceFromFutbinData(data, definitionId)
    };
  }
}

export { PRICE_BATCH_SIZE };