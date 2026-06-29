import { buildPriceByRating } from "../infra/RatingPrices.js";
import { wasmNeedRatingsCount, wasmTeamRatingCount } from "../infra/WasmCore.js";

export class SbcRatingService {
  teamRatingCountJs(ratings) {
    let results = 0;
    let sum = _.sum(ratings);
    const avg = sum / 11;
    _.flatMap(ratings, function (value) {
      if (value > avg) {
        sum += parseFloat(value - avg);
      }
    });
    results = Math.floor(Math.round(sum) / 11);
    if (isNaN(results)) {
      results = 0;
    }
    return results;
  }

  teamRatingCount(ratings) {
    return wasmTeamRatingCount(ratings, (items) => this.teamRatingCountJs(items));
  }

  buildRatingNeedOptions(target, squad, helpers) {
    const { getItemBy, ignorePlayerToCriteria, getInfo } = helpers;
    const info = getInfo();

    let existingRatings = [];
    let brickCount = 0;
    let ratingId = [];

    if (squad) {
      existingRatings = _.map(
        _.filter(squad.getFieldPlayers(), (i) => i.item.isValid()),
        "item.rating"
      );
      brickCount = squad.getAllBrickIndices().length;
      ratingId = _.map(
        _.filter(squad.getFieldPlayers(), (i) => i.item.isValid()),
        "item.databaseId"
      );
    }

    const lackNumber = 11 - brickCount - existingRatings.length;
    if (lackNumber <= 0) {
      return null;
    }

    let criteria = { NEdatabaseId: ratingId, lock: false };
    criteria = ignorePlayerToCriteria(criteria);
    const haveRatingsOriginal = _.map(getItemBy(2, criteria), "rating");
    const squadAbsent = squad === false;
    const availableCounts = squadAbsent ? {} : _.countBy(haveRatingsOriginal);
    const availableRatings = squadAbsent
      ? _.range(99, 44, -1)
      : _.uniq(haveRatingsOriginal).sort((a, b) => b - a);

    const ratingsForPrice = squadAbsent ? _.range(99, 44, -1) : availableRatings;
    const priceByRating = buildPriceByRating(info, ratingsForPrice);

    const availableCountsNumeric = {};
    if (!squadAbsent) {
      _.forEach(availableCounts, (value, key) => {
        availableCountsNumeric[parseInt(key, 10)] = value;
      });
    }

    return {
      target,
      existing_ratings: existingRatings,
      brick_count: brickCount,
      available_ratings: availableRatings,
      available_counts: availableCountsNumeric,
      price_by_rating: priceByRating,
      squad_absent: squadAbsent
    };
  }

  needRatingsCountFromOptionsJs(options) {
    const {
      target,
      existing_ratings: ratings,
      brick_count: brick,
      available_ratings: haveRatings,
      available_counts: haveRatingsCount,
      price_by_rating: priceByRating,
      squad_absent: squadAbsent
    } = options;

    const lackNumber = 11 - brick - ratings.length;
    if (lackNumber <= 0) {
      return [];
    }

    let basisRating = 0;
    let fillNumber = 5;

    const lackSimulation = Array.from({ length: haveRatings.length }, (_e, i) =>
      Array.from({ length: lackNumber }, () => haveRatings[i])
    );

    if (lackNumber <= 3) {
      fillNumber = 9;
    } else if (lackNumber == 4) {
      fillNumber = 8;
    } else if (lackNumber == 5) {
      fillNumber = 7;
    } else if (lackNumber == 6) {
      fillNumber = 6;
    }

    const fillOffset = Math.floor(fillNumber / 2) - 1;
    _.flatMap(lackSimulation, (i) => {
      if (this.teamRatingCount(_.concat(ratings, i)) >= target && i.length) {
        basisRating = i[0];
      }
    });

    let sliceStart = _.indexOf(haveRatings, basisRating) - fillOffset;
    sliceStart < 0 ? (sliceStart = 0) : sliceStart;
    let sliceEnd = _.indexOf(haveRatings, basisRating) + fillNumber - fillOffset;
    sliceEnd > haveRatings.length ? (sliceEnd = haveRatings.length) : sliceEnd;

    const simulated = _.multicombinations(_.slice(haveRatings, sliceStart, sliceEnd), lackNumber);
    const simulatedJson = [];

    _.forEach(simulated, (i) => {
      const simulatedCount = this.teamRatingCount(_.concat(ratings, i));
      if (simulatedCount >= target) {
        let existValue = 0;
        let lackValue = 0;
        let lackRatings = [];
        let existRatings = [];

        _.flatMap(_.countBy(i), (value, key) => {
          const rating = parseInt(key);
          const ratingPrice = priceByRating[rating] || 0;
          const haveCount = squadAbsent ? value : haveRatingsCount[rating] || 0;

          existRatings = _.concat(existRatings, _.times(haveCount, _.constant(rating)));

          existValue += ratingPrice * (haveCount < value ? haveCount : value);
          lackValue += haveCount < value ? ratingPrice * (value - haveCount) : 0;

          if (haveCount < value) {
            lackRatings = _.concat(lackRatings, _.times(value - haveCount, _.constant(rating)));
          }
        });

        simulatedJson.push({
          ratings: i,
          sum: _.sum(i),
          existValue,
          existRatings,
          lackValue,
          lackRatings
        });
      }
    });

    return _.take(_.orderBy(simulatedJson, ["lackValue", "existValue", "sum"], ["asc", "asc", "asc"]), 3);
  }

  needRatingsCount(target, squad, helpers) {
    const options = this.buildRatingNeedOptions(target, squad, helpers);
    if (!options) {
      return [];
    }

    return wasmNeedRatingsCount(options, (payload) => this.needRatingsCountFromOptionsJs(payload));
  }

  sbcListNeedCount(needRatings, sbcTitle, helpers) {
    const {
      getItemBy,
      ignorePlayerToCriteria,
      hideLoader,
      createElementWithConfig,
      getInfo,
      fy,
      debug
    } = helpers;
    const info = getInfo();

    let ratings = [];
    let criteria = { lock: false };
    criteria = ignorePlayerToCriteria(criteria);
    delete criteria.firststorage;

    const playersOriginal = _.map(getItemBy(2, criteria), "rating");
    const playersCount = _.countBy(playersOriginal);

    debug.log(playersCount);

    _.forEach(needRatings, (value) => {
      const results = this.needRatingsCount(value, false, helpers);
      ratings = _.concat(ratings, results[0].ratings);
    });

    const ratingsCount = _.countBy(ratings);
    const sbcNeeds = [];
    const downloadList = [];

    _.forEach(ratingsCount, (value, key) => {
      const hold = playersCount[key] || 0;
      const coverage = hold >= value ? value : hold;
      const lack = value - coverage;
      const lackValue = lack * info.base.price[key];
      sbcNeeds.unshift({
        rating: key,
        coverage,
        lack,
        lackValue,
        need: value
      });
      downloadList.unshift(`${key} : ${lack}`);
    });

    const total = sbcNeeds.reduce(
      (acc, item) => {
        acc.coverage += item.coverage || 0;
        acc.lack += item.lack || 0;
        acc.lackValue += item.lackValue || 0;
        acc.need += item.need || 0;
        return acc;
      },
      { coverage: 0, lack: 0, lackValue: 0, need: 0 }
    );

    sbcNeeds.unshift({
      rating: fy("sbcneedslist.total"),
      ...total
    });

    debug.log(sbcNeeds);
    hideLoader();

    const mp = new EADialogViewController({
      dialogOptions: [{ labelEnum: 44410 }, { labelEnum: enums.UIDialogOptions.OK }],
      message: fy("sbcneedslist.popupm"),
      title: fy("sbcneedslist.popupt"),
      type: EADialogView.Type.MESSAGE
    });
    mp.init();
    mp.onExit.observe(mp, (e, z) => {
      e.unobserve(mp);
      if (z == 44410) {
        const content = downloadList.join("\n");
        const blob = new Blob([content], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${sbcTitle} - Need Ratings List.txt`;
        link.click();
        URL.revokeObjectURL(link.href);
      }
    });
    gPopupClickShield.setActivePopup(mp);
    _.flatMap(mp.getView().dialogOptions, (v, i) => {
      if (v.__text.innerHTML == "*") {
        v.setText(fy(`popupButtonsText.${mp.options[i].labelEnum}`));
      }
    });
    mp.getView().__msg.style.padding = "1rem";
    mp.getView().__msg.style.fontSize = "100%";

    const nBox = createElementWithConfig("div", {
      style: {
        marginTop: "1rem"
      }
    });
    const nBoxTiltle = createElementWithConfig("div", {
      classList: "fsu-sbcNeedsTitle"
    });
    _.times(5, (index) => {
      nBoxTiltle.appendChild(
        createElementWithConfig("div", {
          textContent: fy(`sbcneedslist.title_${index + 1}`)
        })
      );
    });
    nBox.appendChild(nBoxTiltle);

    const nBoxBody = createElementWithConfig("div", {
      classList: "fsu-sbcNeedsBody"
    });
    _.forEach(sbcNeeds, (item) => {
      const nBoxBodyItem = createElementWithConfig("div", {
        classList: "fsu-sbcNeedsBodyItem"
      });
      const needKeys = ["rating", "need", "coverage", "lack", "lackValue"];
      _.forEach(needKeys, (key) => {
        nBoxBodyItem.appendChild(
          createElementWithConfig("div", {
            textContent: key == "lackValue" ? item[key].toLocaleString() : item[key],
            classList: key == "lackValue" ? "currency-coins" : ""
          })
        );
      });
      nBoxBody.appendChild(nBoxBodyItem);
    });
    nBox.appendChild(nBoxBody);
    mp.getView().__msg.appendChild(nBox);
  }
}

export function registerSbcRatingEvents(deps) {
  const { events, info, debug, fy } = deps;
  const service = new SbcRatingService();

  const helpers = {
    getItemBy: (...args) => events.getItemBy(...args),
    ignorePlayerToCriteria: (...args) => events.ignorePlayerToCriteria(...args),
    hideLoader: (...args) => events.hideLoader(...args),
    createElementWithConfig: (...args) => events.createElementWithConfig(...args),
    getInfo: () => info,
    fy,
    debug
  };

  events.teamRatingCount = (ratings) => service.teamRatingCount(ratings);
  events.needRatingsCount = (target, squad) => service.needRatingsCount(target, squad, helpers);
  events.sbcListNeedCount = (needRatings, sbcTitle) =>
    service.sbcListNeedCount(needRatings, sbcTitle, helpers);
}