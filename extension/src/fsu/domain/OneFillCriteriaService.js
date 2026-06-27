export class OneFillCriteriaService {
  isEligibleForOneFill(obj) {
    const allowedKeys = ["gs", "rs", "rareflag"];
    if (
      _.size(obj) !== 2 ||
      !_.every(obj, (entry) =>
        _.isEqual(
          _.sortBy(_.keys(entry.t)),
          _.intersection(_.keys(entry.t), allowedKeys).sort()
        )
      )
    ) {
      return false;
    }

    const rsValues = obj.map((entry) => entry.t && entry.t.rs).filter((rs) => rs !== undefined);
    return rsValues.length === 2 && _.uniq(rsValues).length === 1;
  }

  createFromRequirements(req, miss, eligibilityKeys) {
    let gf = [];
    let gfall = {};

    _.map(req, (i) => {
      const fk = i.getFirstKey();
      const fv = i.getFirstValue(fk);
      const gfs = { t: {}, c: i.count };

      switch (fk) {
        case eligibilityKeys.PLAYER_QUALITY:
        case eligibilityKeys.PLAYER_LEVEL:
          gfs.t.rs = fv - 1;
          if (fk === eligibilityKeys.PLAYER_QUALITY) gfall.rs = fv - 1;
          break;
        case eligibilityKeys.PLAYER_RARITY:
          gfs.t.rareflag = fv;
          break;
        case eligibilityKeys.PLAYER_RARITY_GROUP:
          if (fv === 4) {
            gfs.t.gs = true;
            gfall.gs = false;
          }
          break;
        case eligibilityKeys.PLAYER_MIN_OVR:
          if (req.length === 1) gfs.t.GTrating = fv;
          break;
        default:
          break;
      }

      if (!_.isEmpty(gfs.t)) gf.push(gfs);
    });

    if (gf.length && gf.filter((item) => item.c !== miss).length === 0) {
      const newGf = { t: {}, c: miss };
      gf.forEach((item) => {
        Object.assign(newGf.t, item.t);
      });
      gf = [newGf];
    }

    if (gf.length) {
      gf.sort((a, b) => b.c - a.c);
      let ac = gf.filter((i) => i.c == -1).length;
      let gc = miss;

      if (ac > 1) {
        gf = [];
      } else if (ac == 1) {
        for (const i of gf) {
          if (i.c == -1) {
            i.c = gc;
          } else {
            gc = gc - i.c;
          }
        }
      }

      if (Object.keys(gfall).length) {
        for (const i of gf) {
          const keys = Object.keys(gfall).filter((k) => !(k in i.t));
          for (const key of keys) {
            i.t[key] = gfall[key];
          }
        }
      }

      if (gc < 0) {
        gf = {};
      }
    }

    _.map(req, (r) => {
      if (r.getFirstKey() == eligibilityKeys.TEAM_RATING) {
        gf = [];
      }
      if (r.getFirstKey() == eligibilityKeys.CHEMISTRY_POINTS) {
        gf = [];
      }
    });

    if (gf.length) {
      gf.forEach((i) => {
        i.t.GTrating = i.t.GTrating || 0;
      });
    }

    return gf;
  }
}