function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
}

function requireNumber(value, label) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new TypeError(`${label} must be a number`);
  }
  return value;
}

function optionalNumber(value, label, fallback = 0) {
  if (value === undefined || value === null) {
    return fallback;
  }
  return requireNumber(value, label);
}

function optionalString(value, fallback = "") {
  return value == null ? fallback : String(value);
}

export class SbcResponseAdapter {
  adaptSetsResponse(response) {
    assertObject(response, "SBC sets response");
    assertArray(response.categories, "SBC sets response.categories");

    return {
      categories: response.categories.map((category, categoryIndex) =>
        this.adaptCategory(category, categoryIndex)
      )
    };
  }

  adaptCategory(category, categoryIndex) {
    assertObject(category, `SBC category[${categoryIndex}]`);
    assertArray(category.sets, `SBC category[${categoryIndex}].sets`);

    return {
      categoryId: requireNumber(category.categoryId, `SBC category[${categoryIndex}].categoryId`),
      name: optionalString(category.name),
      priority: optionalNumber(category.priority, `SBC category[${categoryIndex}].priority`),
      releaseTime: optionalNumber(category.releaseTime, `SBC category[${categoryIndex}].releaseTime`),
      sets: category.sets.map((set, setIndex) => this.adaptSet(set, categoryIndex, setIndex))
    };
  }

  adaptSet(set, categoryIndex, setIndex) {
    assertObject(set, `SBC category[${categoryIndex}].sets[${setIndex}]`);

    return {
      setId: requireNumber(set.setId, `SBC category[${categoryIndex}].sets[${setIndex}].setId`),
      name: optionalString(set.name),
      description: optionalString(set.description),
      priority: optionalNumber(set.priority, `SBC category[${categoryIndex}].sets[${setIndex}].priority`),
      startTime: optionalNumber(set.startTime, `SBC category[${categoryIndex}].sets[${setIndex}].startTime`),
      endTime: optionalNumber(set.endTime, `SBC category[${categoryIndex}].sets[${setIndex}].endTime`),
      challengesCount: optionalNumber(
        set.challengesCount,
        `SBC category[${categoryIndex}].sets[${setIndex}].challengesCount`
      ),
      challengesCompletedCount: optionalNumber(
        set.challengesCompletedCount,
        `SBC category[${categoryIndex}].sets[${setIndex}].challengesCompletedCount`
      ),
      repeatable: Boolean(set.repeatable),
      repeatabilityMode: optionalString(set.repeatabilityMode),
      awards: set.awards ?? [],
      setImageId: optionalString(set.setImageId),
      timesCompleted: optionalNumber(
        set.timesCompleted,
        `SBC category[${categoryIndex}].sets[${setIndex}].timesCompleted`
      )
    };
  }

  adaptChallengesResponse(response) {
    assertObject(response, "SBC challenges response");
    assertArray(response.challenges, "SBC challenges response.challenges");

    return {
      challenges: response.challenges.map((challenge, index) => this.adaptChallenge(challenge, index))
    };
  }

  adaptChallenge(challenge, index) {
    assertObject(challenge, `SBC challenge[${index}]`);
    assertArray(challenge.elgReq, `SBC challenge[${index}].elgReq`);

    return {
      challengeId: requireNumber(challenge.challengeId, `SBC challenge[${index}].challengeId`),
      setId: requireNumber(challenge.setId, `SBC challenge[${index}].setId`),
      name: optionalString(challenge.name),
      description: optionalString(challenge.description),
      status: optionalString(challenge.status),
      formation: optionalString(challenge.formation),
      priority: optionalNumber(challenge.priority, `SBC challenge[${index}].priority`),
      endTime: optionalNumber(challenge.endTime, `SBC challenge[${index}].endTime`),
      repeatable: Boolean(challenge.repeatable),
      timesCompleted: optionalNumber(challenge.timesCompleted, `SBC challenge[${index}].timesCompleted`),
      eligibilityOperation: optionalString(challenge.elgOperation),
      eligibilityRequirements: challenge.elgReq.map((requirement, requirementIndex) =>
        this.adaptEligibilityRequirement(requirement, index, requirementIndex)
      ),
      awards: Array.isArray(challenge.awards) ? challenge.awards : [],
      type: optionalString(challenge.type),
      tutorial: optionalNumber(challenge.tutorial, `SBC challenge[${index}].tutorial`)
    };
  }

  adaptEligibilityRequirement(requirement, challengeIndex, requirementIndex) {
    assertObject(requirement, `SBC challenge[${challengeIndex}].elgReq[${requirementIndex}]`);

    return {
      type: optionalString(requirement.type),
      eligibilitySlot: optionalNumber(
        requirement.eligibilitySlot,
        `SBC challenge[${challengeIndex}].elgReq[${requirementIndex}].eligibilitySlot`
      ),
      eligibilityKey: requireNumber(
        requirement.eligibilityKey,
        `SBC challenge[${challengeIndex}].elgReq[${requirementIndex}].eligibilityKey`
      ),
      eligibilityValue: requireNumber(
        requirement.eligibilityValue,
        `SBC challenge[${challengeIndex}].elgReq[${requirementIndex}].eligibilityValue`
      )
    };
  }

  adaptChallengeSquadResponse(response) {
    assertObject(response, "SBC challenge squad response");
    assertObject(response.squad, "SBC challenge squad response.squad");
    assertArray(response.squad.players, "SBC challenge squad response.squad.players");

    return {
      challengeId: requireNumber(response.challengeId, "SBC challenge squad response.challengeId"),
      squad: {
        id: requireNumber(response.squad.id, "SBC challenge squad response.squad.id"),
        formation: optionalString(response.squad.formation),
        rating: optionalNumber(response.squad.rating, "SBC challenge squad response.squad.rating"),
        chemistry: optionalNumber(response.squad.chemistry, "SBC challenge squad response.squad.chemistry"),
        manager: Array.isArray(response.squad.manager) ? response.squad.manager : [],
        players: response.squad.players.map((player, index) => this.adaptSquadPlayer(player, index))
      }
    };
  }

  adaptSquadPlayer(player, index) {
    assertObject(player, `SBC challenge squad player[${index}]`);
    const squadIndex = requireNumber(player.index, `SBC challenge squad player[${index}].index`);
    assertObject(player.itemData, `SBC challenge squad player[${index}].itemData`);

    return {
      index: squadIndex,
      itemData: {
        id: requireNumber(player.itemData.id, `SBC challenge squad player[${index}].itemData.id`),
        assetId: optionalNumber(player.itemData.assetId, `SBC challenge squad player[${index}].itemData.assetId`),
        rating: optionalNumber(player.itemData.rating, `SBC challenge squad player[${index}].itemData.rating`),
        itemType: optionalString(player.itemData.itemType),
        resourceId: optionalNumber(
          player.itemData.resourceId,
          `SBC challenge squad player[${index}].itemData.resourceId`
        ),
        preferredPosition: optionalString(player.itemData.preferredPosition),
        untradeable: Boolean(player.itemData.untradeable),
        teamid: optionalNumber(player.itemData.teamid, `SBC challenge squad player[${index}].itemData.teamid`),
        nation: optionalNumber(player.itemData.nation, `SBC challenge squad player[${index}].itemData.nation`),
        rareflag: optionalNumber(player.itemData.rareflag, `SBC challenge squad player[${index}].itemData.rareflag`)
      }
    };
  }
}
