export function installNavigationPatches(deps) {
  const { call, events, info, isPhone, SBCCount } = deps;

  UTGameFlowNavigationController.prototype.didPush = function (e) {
    call.view.push.call(this, e);
    if (info.douagain.hasOwnProperty("SBCListHtml") && info.set.sbc_headentrance) {
      if (
        e.className == "UTSBCSquadSplitViewController" ||
        (e.className == "UTSBCSquadOverviewViewController" &&
          info.douagain.SBCListHtml.style.display == "flex")
      ) {
        info.douagain.SBCListHtml.style.display = "none";
      } else if (info.douagain.SBCListHtml.style.display == "none") {
        info.douagain.SBCListHtml.style.display = "flex";
      }
    }
  };

  const UTGameFlowNavigationController_viewDidAppear =
    UTGameFlowNavigationController.prototype.viewDidAppear;
  UTGameFlowNavigationController.prototype.viewDidAppear = function (...args) {
    UTGameFlowNavigationController_viewDidAppear.call(this, ...args);
    if (this.currentController instanceof UTAcademyHubViewController && this.getView()._navbar == null) {
      this.getView().appendNavigationBar(this.navigationBar);
      this.setNavigationVisibility(1, 1);
    }
    let nav = this.getView()._navbar;
    if (nav) {
      if (nav.className == "UTCurrencyNavigationBarView" && info.set.sbc_headentrance) {
        if (!info.douagain.hasOwnProperty("SBCListHtml")) {
          info.douagain.SBCListHtml = events.createElementWithConfig("div", {
            classList: ["fsu-navsbc"],
            style: {
              display: "flex"
            }
          });
        }
        if (isPhone()) {
          nav.__root.classList.add("fsu-shownavsbc");
        }
        nav._fsuSBCList = info.douagain.SBCListHtml;
        if (nav.__root.querySelector(".view-navbar-currency")) {
          nav.__root.insertBefore(nav._fsuSBCList, nav.__currencies);
        }
      }
      SBCCount.createElement(this.getView());
    }
  };

  events.playerSelectionSort = (view, player) => {
    let leagueOrder = [13, 53, 31, 19, 16, 2221, 2222];
    let playerArr = _.map(player, (i, k) => {
      return {
        p: events.getCachePrice(i.definitionId, 1).num,
        r: i.rating,
        f: i.rareflag,
        k: k,
        l: _.includes(leagueOrder, i.leagueId) ? _.indexOf(leagueOrder, i.leagueId) : 99999
      };
    });
    let sortKey = ["r", "f", "l"],
      sortOrder = ["desc", "desc", "asc"];
    if (_.isEmpty(_.filter(playerArr, { p: 0 }))) {
      sortKey.unshift("p");
      sortOrder.unshift("desc");
    }
    let pickNumber = 1;
    const pickNumberText = view.__selectedCounter.textContent;

    if (pickNumberText && _.includes(pickNumberText, "/")) {
      const pickNumberParts = pickNumberText.split("/");
      const tempNumber = parseInt(pickNumberParts[1], 10);
      if (Number.isInteger(tempNumber) && tempNumber && tempNumber <= playerArr.length) {
        pickNumber = tempNumber;
      }
    }

    let bestPlayer = _.take(_.orderBy(playerArr, sortKey, sortOrder), pickNumber);
    if (bestPlayer.length) {
      _.forOwn(bestPlayer, (i) => {
        view.__carouselIndicatorDots.classList.add("fsu-pickbest");
        view.__carouselIndicatorDots.querySelectorAll("li")[i.k].classList.add("best");
      });
    }
  };
}