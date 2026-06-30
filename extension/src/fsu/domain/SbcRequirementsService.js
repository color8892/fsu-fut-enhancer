export class SbcRequirementsService {
  requirementsToText(requirement, eligibilityKeys, localize) {
    let text;
    let rKey = requirement.getFirstKey();
    let rIds = requirement.getValue(rKey);
    function combine(t) {
      return _.map(t, function (value, index, array) {
        return index < array.length - 1 ? value + " " + _.toUpper(localize("label.general.or")) : value;
      }).join(" ");
    }
    switch (rKey) {
      case eligibilityKeys.CLUB_ID:
        text = combine(_.uniq(_.map(rIds, (value) => {
          return UTLocalizationUtil.teamIdToAbbr15(value, services.Localization);
        })));
        break;
      case eligibilityKeys.LEAGUE_ID:
        text = combine(_.map(rIds, (value) => {
          return UTLocalizationUtil.leagueIdToName(value, services.Localization);
        }));
        break;
      case eligibilityKeys.NATION_ID:
        text = combine(_.map(rIds, (value) => {
          return UTLocalizationUtil.nationIdToName(value, services.Localization);
        }));
        break;
      case eligibilityKeys.PLAYER_RARITY:
        text = combine(_.map(rIds, (value) => {
          return localize(`item.raretype${value}`);
        }));
        break;
      case eligibilityKeys.PLAYER_MIN_OVR:
        text = combine(_.map(rIds, (value) => {
          return localize("sbc.requirements.rating.min.val", [value]);
        }));
        break;
      case eligibilityKeys.PLAYER_RARITY_GROUP:
        text = combine(_.map(rIds, (value) => {
          return localize(`Player_Group_${value}`);
        }));
        break;
      case eligibilityKeys.PLAYER_EXACT_OVR:
        text = combine(_.map(rIds, (value) => {
          return localize("sbc.requirements.rating.exact.val", [value]);
        }));
        break;
      default:
        text = requirement.getValue(requirement.getFirstKey()).join();
    }
    return text;
  }
}