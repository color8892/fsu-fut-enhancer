export const SBC_CHALLENGES_PATCH_IDS = Object.freeze({
  VIEW_DID_APPEAR: "sbc.challenges-view"
});

function createChallengesViewDescriptor(deps) {
  const {
    info,
    events,
    sbcReadAdapter,
    eligibilityKeys,
    localize
  } = deps;

  return {
    id: SBC_CHALLENGES_PATCH_IDS.VIEW_DID_APPEAR,
    phase: "hub-and-lists",
    targetLabel: "UTSBCChallengesViewController.prototype.viewDidAppear",
    resolveTarget: () =>
      typeof UTSBCChallengesViewController === "undefined"
        ? null
        : {
            owner: UTSBCChallengesViewController.prototype,
            key: "viewDidAppear"
          },
    verify: ({ originalDescriptor, originalValue }) => ({
      ok:
        originalDescriptor !== undefined &&
        "value" in originalDescriptor &&
        originalDescriptor.writable === true &&
        typeof originalValue === "function",
      missing: [
        "UTSBCChallengesViewController.prototype.viewDidAppear"
      ]
    }),
    apply: ({ target, originalDescriptor, originalValue }) => {
      Object.defineProperty(target.owner, target.key, {
        ...originalDescriptor,
        value: function fsuSbcChallengesViewDidAppear(...args) {
          const result = originalValue.call(this, ...args);

          if (!info.set.info_sbcs) return result;

          this._fsu ??= {};
          events.sbcSubPrice(this.sbset.id, this.getView());

          if (Array.isArray(this.sbset.awards)) {
            this.sbset.awards.forEach((item, index) => {
              if (!item.isItem && !item.isPack) return;

              const li = this.getView()._setInfo._rewards.__rewardList.querySelector(
                `li:nth-child(${index + 1})`
              );
              if (!li) return;

              let btn;
              if (item.isItem && item.item.isPlayer()) {
                btn = events.createButton(
                  new UTStandardButtonControl(),
                  localize("sbc.watchplayer"),
                  (event) => events.openFutbinPlayerUrl(event, item.item),
                  "mini"
                );
              }

              if (btn) {
                btn.getRootElement().style.marginRight = "2rem";
                li.appendChild(btn.getRootElement());
                this._fsu.watchBtn = btn;
              }
            });
          }

          const challengeValues =
            this.sbset.challenges &&
            typeof this.sbset.challenges.values === "function"
              ? Array.from(this.sbset.challenges.values())
              : [];
          const needRatings = challengeValues
            .map((challenge) => {
              if (
                !challenge ||
                typeof challenge.isCompleted !== "function" ||
                challenge.isCompleted() ||
                !Array.isArray(challenge.eligibilityRequirements)
              ) {
                return 0;
              }
              for (const requirement of challenge.eligibilityRequirements) {
                const read = sbcReadAdapter.readRequirement(requirement);
                if (
                  read.success &&
                  read.data.key === eligibilityKeys.TEAM_RATING
                ) {
                  const rating = Number(read.data.values[0]);
                  return Number.isFinite(rating) ? rating : 0;
                }
              }
              return 0;
            })
            .filter((value) => value !== 0)
            .reverse();

          const setName = sbcReadAdapter.getSetName(this.sbset.id);
          if (
            needRatings.length > 2 &&
            !this._fsu.needBtn &&
            setName.success
          ) {
            const needBtn = events.createButton(
              new UTStandardButtonControl(),
              localize("sbcneedslist.btn"),
              () => {
                events.showLoader();
                events.sbcListNeedCount(needRatings, setName.data);
              },
              "mini"
            );
            Object.assign(this.getView()._header.__root.style, {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            });
            this.getView()._header.getRootElement().appendChild(
              needBtn.getRootElement()
            );
            this._fsu.needBtn = needBtn;
          }
          return result;
        }
      });
    }
  };
}

export function installSbcChallengesPatch(deps) {
  return deps.patchLifecycle.install(createChallengesViewDescriptor(deps));
}

export function registerSbcChallengesLifecycleEvents(deps) {
  const { events, patchLifecycle } = deps;
  events.setSbcChallengesPatchEnabled = (enabled) =>
    enabled
      ? installSbcChallengesPatch(deps)
      : patchLifecycle.restore(SBC_CHALLENGES_PATCH_IDS.VIEW_DID_APPEAR);
}
