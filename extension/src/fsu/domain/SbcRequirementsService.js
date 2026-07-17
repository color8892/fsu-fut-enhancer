export class SbcRequirementsService {
  /**
   * @param {unknown} requirement
   * @param {Record<string, string | number>} eligibilityKeys
   * @param {{
   *   readRequirement: (requirement: unknown) => {
   *     success: boolean,
   *     data?: { key: string | number, values: unknown[] }
   *   },
   *   getEntityName: (
   *     kind: "club" | "league" | "nation",
   *     id: unknown
   *   ) => { success: boolean, data?: string },
   *   localize: (key: string, values?: unknown[]) => string
   * }} helpers
   */
  requirementsToText(requirement, eligibilityKeys, helpers) {
    const result = helpers.readRequirement(requirement);
    if (!result.success || !result.data) return "";

    const { key, values } = result.data;
    /** @param {string[]} labels */
    const combine = (labels) => {
      const separator = ` ${helpers.localize("label.general.or").toUpperCase()} `;
      return labels.filter(Boolean).join(separator);
    };
    /**
     * @param {"club" | "league" | "nation"} kind
     * @returns {string[]}
     */
    const entityNames = (kind) =>
      values.map((value) => {
        const name = helpers.getEntityName(kind, value);
        return name.success ? name.data || "" : "";
      });

    switch (key) {
      case eligibilityKeys.CLUB_ID:
        return combine([...new Set(entityNames("club"))]);
      case eligibilityKeys.LEAGUE_ID:
        return combine(entityNames("league"));
      case eligibilityKeys.NATION_ID:
        return combine(entityNames("nation"));
      case eligibilityKeys.PLAYER_RARITY:
        return combine(values.map((value) => helpers.localize(`item.raretype${value}`)));
      case eligibilityKeys.PLAYER_MIN_OVR:
        return combine(
          values.map((value) =>
            helpers.localize("sbc.requirements.rating.min.val", [value])
          )
        );
      case eligibilityKeys.PLAYER_RARITY_GROUP:
        return combine(values.map((value) => helpers.localize(`Player_Group_${value}`)));
      case eligibilityKeys.PLAYER_EXACT_OVR:
        return combine(
          values.map((value) =>
            helpers.localize("sbc.requirements.rating.exact.val", [value])
          )
        );
      default:
        return values.join();
    }
  }
}
