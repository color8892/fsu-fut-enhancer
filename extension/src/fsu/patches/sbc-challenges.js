export function installSbcChallengesPatch(deps) {
  const { info, events, services, eligibilityKeys, localize } = deps;
  const originalViewDidAppear = UTSBCChallengesViewController.prototype.viewDidAppear;

  UTSBCChallengesViewController.prototype.viewDidAppear = function () {
    originalViewDidAppear.call(this);

    if (!info.set.info_sbcs) return;

    this._fsu ??= {};
    events.sbcSubPrice(this.sbset.id, this.getView());

    if (_.isArray(this.sbset.awards)) {
      _.map(this.sbset.awards, (item, index) => {
        if (!item.isItem && !item.isPack) return;

        const li = this.getView()._setInfo._rewards.__rewardList.querySelector(
          `li:nth-child(${index + 1})`
        );
        if (!li) return;

        const createBtn = (labelKey, onClick, size = "mini") => {
          const btn = events.createButton(
            new UTStandardButtonControl(),
            localize(labelKey),
            onClick,
            size
          );
          btn.getRootElement().style.marginRight = "2rem";
          return btn;
        };

        let btn;
        if (item.isItem && item.item.isPlayer()) {
          btn = createBtn("sbc.watchplayer", (e) => events.openFutbinPlayerUrl(e, item.item));
        }

        if (btn) {
          li.appendChild(btn.getRootElement());
          this._fsu.watchBtn = btn;
        }
      });
    }

    let needRatings = _.map(this.sbset.challenges.values(), (challenge) => {
      let rating = 0;
      if (!challenge.isCompleted()) {
        _.forEach(challenge.eligibilityRequirements, (requirement) => {
          if (requirement.getFirstKey() == eligibilityKeys.TEAM_RATING) {
            rating = requirement.getFirstValue(requirement.getFirstKey());
          }
        });
      }
      return rating;
    });
    needRatings = _(needRatings).filter((value) => value !== 0).reverse().value();

    if (needRatings.length > 2 && !this._fsu.needBtn) {
      const needBtn = events.createButton(
        new UTStandardButtonControl(),
        localize("sbcneedslist.btn"),
        () => {
          events.showLoader();
          events.sbcListNeedCount(
            needRatings,
            services.SBC.repository.sets.get(this.sbset.id).name
          );
        },
        "mini"
      );
      Object.assign(this.getView()._header.__root.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      });
      this.getView()._header.getRootElement().appendChild(needBtn.getRootElement());
      this._fsu.needBtn = needBtn;
    }
  };
}