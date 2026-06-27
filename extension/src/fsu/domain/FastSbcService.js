export class FastSbcService {
  calculateQuantity({ clubMode, playerPool, criteria, helpers }) {
    const { getItemBy, isEligibleForOneFill, ignorePlayerToCriteria, build } = helpers;
    const counts = [];

    if (!build.strictlypcik && isEligibleForOneFill(criteria)) {
      const criteriaNumber = criteria[0].c + criteria[1].c;
      let groupedFilter = { rs: JSON.parse(JSON.stringify(criteria[0].t.rs)) };
      groupedFilter = ignorePlayerToCriteria(groupedFilter);
      const items = clubMode
        ? getItemBy(1, groupedFilter, playerPool)
        : getItemBy(1, groupedFilter, false, playerPool);
      return Math.ceil(_.size(items) / criteriaNumber);
    }

    const tempCriterias = _.cloneDeep(criteria);

    if (
      !clubMode &&
      _.size(tempCriterias) === 2 &&
      _.get(tempCriterias[0], "t.rs") === _.get(tempCriterias[1], "t.rs")
    ) {
      const [first, second] = tempCriterias;

      if (_.get(first, "t.gs") === true && !_.has(second.t, "gs")) {
        _.set(second, "t.gs", false);
      } else if (_.get(second, "t.gs") === true && !_.has(first.t, "gs")) {
        _.set(first, "t.gs", false);
      }
    }

    _.each(criteria, (entry) => {
      let entryCriteria = ignorePlayerToCriteria(_.cloneDeep(entry.t));
      entryCriteria.lock = false;
      const items = clubMode
        ? getItemBy(1, entryCriteria, playerPool)
        : getItemBy(1, entryCriteria, false, playerPool);
      counts.push(Math.ceil(_.size(items) / entry.c));
    });

    return clubMode ? _.min(counts) : _.max(counts);
  }
}