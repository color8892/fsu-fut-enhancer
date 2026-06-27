export function registerSbcSubstitutionEvents(deps) {
  const { events } = deps;

  events.SBCDisplayPlayers = (controller, fsuCriteria, players, eaCriteria) => {
    const search = new UTSearchCriteriaDTO();
    search.type = SearchType.PLAYER;

    if (eaCriteria) {
      _.forEach(eaCriteria, (value, key) => {
        if (_.has(search, key)) {
          search[key] = value;
        }
      });
    }

    const displayPlayers = fsuCriteria
      ? events.getItemBy(2, fsuCriteria)
      : Array.isArray(players)
        ? players
        : [];

    const index = controller?.viewmodel?.current()?.index;
    const newController = new UTSelectItemFromClubViewController();
    newController.initWithCriteriaAndSBCChallenge(search, controller.challenge, index);

    if (eaCriteria && _.has(eaCriteria, "clubSearchType")) {
      newController.setClubSearchType(eaCriteria.clubSearchType);
    } else {
      newController._fsu = {};
      newController._fsu.displayPlayers = _.uniqBy(displayPlayers, "id");
      newController._fsu.fsuCriteria = fsuCriteria;
    }

    controller.getNavigationController().pushViewController(newController);
  };
}

export function renderSbcSubstitutionPanel(deps, context) {
  const { events, fy, info, repositories } = deps;
  const { controller, panelView, item, defId } = context;

  let subBox = controller._fsu?.substitutionBox;
  if (!subBox) {
    subBox = events.createElementWithConfig("div", {
      classList: "fsu-substitutionBox"
    });
    controller._fsu.substitutionBox = subBox;
  }

  let normalTitle = controller._fsu?.normalTitle;
  if (!normalTitle) {
    normalTitle = events.createElementWithConfig("div", {
      textContent: fy("substitution.swaptitle"),
      classList: "fsu-substitutionTitle"
    });
    subBox.appendChild(normalTitle);
    controller._fsu.normalTitle = normalTitle;
  }

  if (controller?.squad?._fsu?.showReqBtnAttr?.length > 0) {
    let reqBtns = controller.squad._fsu?.reqBtns;
    if (!reqBtns) {
      reqBtns = events.createElementWithConfig("div", {
        classList: "fsu-substitutionBtns"
      });
      controller.squad._fsu.reqBtns = reqBtns;
    }

    const squadPlayers = _.map(controller.squad.getFieldPlayers(), "item");
    _.forEach(controller.squad._fsu.showReqBtnAttr, (value, index) => {
      const meetPlayers = events.getItemBy(1, value.criteria, false, squadPlayers);
      const countText = meetPlayers.length + "/" + value.count;
      const meetClass = meetPlayers.length >= value.count ? "state-meet" : "state-notmeet";
      let reqBtn = controller.squad._fsu?.[`reqBtn_${index}`];

      if (!reqBtn) {
        reqBtn = events.createButton(
          new UTStandardButtonControl(),
          "",
          (event) => {
            events.SBCDisplayPlayers(event._controller, value.criteria);
          },
          `fsu-substitutionReqBtn ${meetClass}`
        );

        _.map(value.ids, (id) => {
          const imgClass =
            value.type == AssetLocationUtils.FILTER.CLUB ||
            value.type == AssetLocationUtils.FILTER.RARITY
              ? "big"
              : "small";
          reqBtn.getRootElement().appendChild(
            events.createElementWithConfig("img", {
              src: AssetLocationUtils.getFilterImage(value.type, id),
              classList: imgClass
            })
          );
        });

        reqBtn.getRootElement().appendChild(
          events.createElementWithConfig("div", {
            textContent: countText
          })
        );
        controller.squad._fsu[`reqBtn_${index}`] = reqBtn;
      }

      reqBtn.getRootElement().querySelector("div").textContent = countText;
      reqBtn._controller = controller;
      reqBtns.appendChild(reqBtn.getRootElement());
    });
    subBox.appendChild(reqBtns);
  }

  let normalBtns = controller._fsu?.normalBtns;
  if (!normalBtns) {
    normalBtns = events.createElementWithConfig("div", {
      classList: "fsu-substitutionBtns"
    });
    subBox.appendChild(normalBtns);
    controller._fsu.normalBtns = normalBtns;
  }

  let conceptTitle = controller._fsu?.conceptTitle;
  if (!conceptTitle) {
    conceptTitle = events.createElementWithConfig("div", {
      textContent: fy("substitution.swapconcepttitle"),
      classList: "fsu-substitutionTitle"
    });
    subBox.appendChild(conceptTitle);
    controller._fsu.conceptTitle = conceptTitle;
  }

  let conceptBtns = controller._fsu?.conceptBtns;
  if (!conceptBtns) {
    conceptBtns = events.createElementWithConfig("div", {
      classList: "fsu-substitutionBtns"
    });
    subBox.appendChild(conceptBtns);
    controller._fsu.conceptBtns = conceptBtns;
  }

  normalTitle.textContent = fy(defId !== 0 ? "substitution.swaptitle" : "substitution.addtitle");
  panelView.getRootElement().querySelector(".ut-item-details--metadata").after(subBox);

  const squadPlayerDefIds = _.map(controller.squad.getPlayers(), "item.definitionId");

  if (repositories.Item.getUnassignedItems().length) {
    const duplicatePlayers = _.map(
      repositories.Item.unassigned.filter((entry) => !squadPlayerDefIds.includes(entry.definitionId)),
      "duplicateId"
    );

    let swapUnassigned = controller._fsu?.swapUnassigned;
    if (!swapUnassigned) {
      swapUnassigned = events.createButton(
        new UTStandardButtonControl(),
        fy("substitution.unassigned"),
        async () => {
          const players = events.getItemBy(2, { id: swapUnassigned.defIds });
          if (players.length) {
            events.SBCDisplayPlayers(controller, null, players);
          } else {
            events.notice("notice.noplayer", 2);
          }
        },
        "accordian"
      );
      controller._fsu.swapUnassigned = swapUnassigned;
    }

    swapUnassigned.defIds = duplicatePlayers;
    swapUnassigned.setInteractionState(duplicatePlayers.length);
    normalBtns.appendChild(swapUnassigned.getRootElement());
  }

  if (defId !== 0) {
    let sameRating = controller._fsu?.sameRating;
    if (!sameRating) {
      sameRating = events.createButton(
        new UTStandardButtonControl(),
        fy("substitution.samerating"),
        () => {
          events.SBCDisplayPlayers(controller, { rating: sameRating.rating });
        },
        ""
      );
      controller._fsu.sameRating = sameRating;
    }
    sameRating.rating = item.rating;
    normalBtns.appendChild(sameRating.getRootElement());
  }

  if (controller.squad._fsu.hasChemistry) {
    let chemistryPlayers = controller._fsu?.chemistryPlayers;
    if (!chemistryPlayers) {
      chemistryPlayers = events.createButton(
        new UTStandardButtonControl(),
        fy("substitution.chemistry"),
        () => {
          const slot = controller.viewmodel.current();
          const position = slot.position.typeId;
          const criteria = events.getChemistryPlayers(controller, controller.squad._chemistry);
          const players = _.flatMap(criteria, (entry) =>
            events.getItemBy(2, {
              ...entry,
              possiblePositions: position
            })
          );
          events.SBCDisplayPlayers(controller, null, players);
        },
        ""
      );
      controller._fsu.chemistryPlayers = chemistryPlayers;
    }

    chemistryPlayers.setInteractionState(
      controller.squad.chemistryVO.getParameterChemistry().filter((entry) => entry.contributions > 0).length
    );
    normalBtns.appendChild(chemistryPlayers.getRootElement());

    if (controller.challenge.meetsRequirements()) {
      let requirementPlayers = controller._fsu?.requirementPlayers;
      if (!requirementPlayers) {
        requirementPlayers = events.createButton(
          new UTStandardButtonControl(),
          fy("substitution.requirement"),
          () => {
            const players = events.SBCSetMeetsPlayers(controller);
            if (players.length > 0) {
              events.SBCDisplayPlayers(controller, null, players);
            } else {
              events.notice("meetsreq.error", 2);
            }
          },
          ""
        );
        controller._fsu.requirementPlayers = requirementPlayers;
      }
      normalBtns.appendChild(requirementPlayers.getRootElement());
    }
  }

  if (defId == 0 || !item.concept) {
    conceptTitle.style.display = "none";
    conceptBtns.style.display = "none";
  } else if (item.concept) {
    conceptTitle.style.display = "block";
    conceptBtns.style.display = "flex";

    let sameClub = controller._fsu?.sameClub;
    if (!sameClub) {
      sameClub = events.createButton(
        new UTStandardButtonControl(),
        fy("substitution.sameclub"),
        () => {
          const criteria = {};
          const currentSlot = controller.viewmodel.current();
          if (currentSlot.inPossiblePosition) {
            criteria._position = currentSlot.generalPositionName;
          }
          if (!currentSlot.item.isSpecial()) {
            criteria.rarities = [0, 1];
          }
          criteria.club = currentSlot.item.teamId;
          criteria.league = currentSlot.item.leagueId;
          criteria.clubSearchType = ItemSearchFeature.CONCEPT;
          events.SBCDisplayPlayers(controller, null, null, criteria);
        },
        ""
      );
    }
    conceptBtns.appendChild(sameClub.getRootElement());

    let sameNationAndLeague = controller._fsu?.sameNationAndLeague;
    if (!sameNationAndLeague) {
      sameNationAndLeague = events.createButton(
        new UTStandardButtonControl(),
        fy("substitution.samenationandleague"),
        () => {
          const criteria = {};
          const currentSlot = controller.viewmodel.current();
          if (currentSlot.inPossiblePosition) {
            criteria._position = currentSlot.generalPositionName;
          }
          if (!currentSlot.item.isSpecial()) {
            criteria.rarities = [0, 1];
          }
          criteria.nation = currentSlot.item.nationId;
          criteria.league = currentSlot.item.leagueId;
          criteria.clubSearchType = ItemSearchFeature.CONCEPT;
          events.SBCDisplayPlayers(controller, null, null, criteria);
        },
        ""
      );
    }
    conceptBtns.appendChild(sameNationAndLeague.getRootElement());

    if (info.set.sbc_conceptbuy) {
      let buyConcept = controller._fsu?.buyConcept;
      if (!buyConcept) {
        buyConcept = events.createButton(
          new UTGroupButtonControl(),
          fy("conceptbuy.btntext"),
          () => {
            events.buyConceptPlayer([item]);
          },
          "accordian"
        );
        buyConcept.setSubtext("--");
        buyConcept.displayCurrencyIcon(true);
        controller._fsu.buyConcept = buyConcept;
      }

      if (events.getCachePrice(defId, 3)) {
        buyConcept.setSubtext(events.getCachePrice(defId, 1).num);
      }
      panelView.__itemActions.prepend(buyConcept.getRootElement());
    }
  }
}