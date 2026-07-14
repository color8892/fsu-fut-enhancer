import { installPatchDescriptors } from "../core/PatchRegistry.js";

function resolveNavigationPrototype() {
  return typeof UTGameFlowNavigationController === "undefined"
    ? null
    : UTGameFlowNavigationController.prototype;
}

export function createNavigationPatchDescriptors(deps) {
  const { call, events, info, isPhone, SBCCount } = deps;

  return [
    {
      id: "navigation.did-push",
      resolveTarget: resolveNavigationPrototype,
      verify: (target) => typeof target?.didPush === "function" && typeof call.view?.push === "function",
      apply: (target) => {
        const original = target.didPush;
        target.didPush = function (controller) {
          call.view.push.call(this, controller);
          if (info.douagain.hasOwnProperty("SBCListHtml") && info.set.sbc_headentrance) {
            if (
              controller.className === "UTSBCSquadSplitViewController" ||
              (controller.className === "UTSBCSquadOverviewViewController" &&
                info.douagain.SBCListHtml.style.display === "flex")
            ) {
              info.douagain.SBCListHtml.style.display = "none";
            } else if (info.douagain.SBCListHtml.style.display === "none") {
              info.douagain.SBCListHtml.style.display = "flex";
            }
          }
        };
        return () => {
          target.didPush = original;
        };
      }
    },
    {
      id: "navigation.view-did-appear",
      resolveTarget: resolveNavigationPrototype,
      verify: (target) => typeof target?.viewDidAppear === "function",
      apply: (target) => {
        const original = target.viewDidAppear;
        target.viewDidAppear = function (...args) {
          original.call(this, ...args);
          if (this.currentController instanceof UTAcademyHubViewController && this.getView()._navbar === null) {
            this.getView().appendNavigationBar(this.navigationBar);
            this.setNavigationVisibility(1, 1);
          }
          const nav = this.getView()._navbar;
          if (nav) {
            if (nav.className === "UTCurrencyNavigationBarView" && info.set.sbc_headentrance) {
              if (!info.douagain.hasOwnProperty("SBCListHtml")) {
                info.douagain.SBCListHtml = events.createElementWithConfig("div", {
                  classList: ["fsu-navsbc"],
                  style: { display: "flex" }
                });
              }
              if (isPhone()) nav.__root.classList.add("fsu-shownavsbc");
              nav._fsuSBCList = info.douagain.SBCListHtml;
              if (nav.__root.querySelector(".view-navbar-currency")) {
                nav.__root.insertBefore(nav._fsuSBCList, nav.__currencies);
              }
            }
            SBCCount.createElement(this.getView());
          }
        };
        return () => {
          target.viewDidAppear = original;
        };
      }
    }
  ];
}

export function installNavigationPatches(deps, patchRegistry = null) {
  return installPatchDescriptors(createNavigationPatchDescriptors(deps), patchRegistry);
}
