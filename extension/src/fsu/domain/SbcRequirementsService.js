export class SbcRequirementsService {
  requirementsToText(requirement, eligibilityKeys, localize) {
    let rKey = requirement.getFirstKey();
    let rIds = requirement.getValue(rKey);
    function combine(t) {
      return _.map(t, function (value, index, array) {
        return index < array.length - 1 ? value + " " + _.toUpper(localize("label.general.or")) : value;
      }).join(" ");
    }
    switch (rKey) {
      case eligibilityKeys.CLUB_ID:
        return combine(_.uniq(_.map(rIds, (value) => {
          return UTLocalizationUtil.teamIdToAbbr15(value, services.Localization);
        })));
      case eligibilityKeys.LEAGUE_ID:
        return combine(_.map(rIds, (value) => {
          return UTLocalizationUtil.leagueIdToName(value, services.Localization);
        }));
      case eligibilityKeys.NATION_ID:
        return combine(_.map(rIds, (value) => {
          return UTLocalizationUtil.nationIdToName(value, services.Localization);
        }));
      case eligibilityKeys.PLAYER_RARITY:
        return combine(_.map(rIds, (value) => {
          return localize(`item.raretype${value}`);
        }));
      case eligibilityKeys.PLAYER_MIN_OVR:
        return combine(_.map(rIds, (value) => {
          return localize("sbc.requirements.rating.min.val", [value]);
        }));
      case eligibilityKeys.PLAYER_RARITY_GROUP:
        return combine(_.map(rIds, (value) => {
          return localize(`Player_Group_${value}`);
        }));
      case eligibilityKeys.PLAYER_EXACT_OVR:
        return combine(_.map(rIds, (value) => {
          return localize("sbc.requirements.rating.exact.val", [value]);
        }));
      default:
        return requirement.getValue(requirement.getFirstKey()).join();
    }
  }
}