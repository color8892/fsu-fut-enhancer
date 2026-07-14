import { FSU_BASE_STYLE } from "../ui/fsu-styles.js";
import { installUnassignedPatches } from "../patches/unassigned.js";
import { installLoginPatches } from "../patches/login.js";
import { installNavigationPatches } from "../patches/navigation.js";
import { installSquadBuilderPatches } from "../patches/squad-builder.js";
import { installPlayerCardPatches } from "../patches/player-cards.js";
import { installPicksRewardsPatches } from "../patches/picks-rewards.js";
import { installSquadOverviewViewPatches } from "../patches/squad-overview-view.js";
import { installSectionedListPatches } from "../patches/sectioned-list.js";
import { registerBuildIgnoreEvents } from "../patches/build-ignore.js";
import { installPlayerListPatches } from "../patches/player-list.js";
import { installSbcHubPatches, registerSbcInfoFillEvent } from "../patches/sbc-hub.js";
import { installAcademyHubPatches } from "../patches/academy-hub.js";
import { registerSbcNavEvents } from "../patches/sbc-nav-events.js";
import { installSbcSquadSubmitPatches, installSbcRequirementsPatch } from "../patches/sbc-squad.js";
import { registerSbcSubstitutionEvents } from "../patches/sbc-substitution.js";
import { installObjectivesHubPatches } from "../patches/objectives-hub.js";
import { registerHomeHubEvents, installHomeHubPatches } from "../patches/home-hub.js";
import { installMarketPatches } from "../patches/market.js";
import { installStorePatches } from "../patches/store.js";
import { installSearchPatches, registerSearchEvents } from "../patches/search-events.js";
import { registerSbcFillEvents } from "../patches/sbc-fill-events.js";
import { installSbcFillPatches } from "../patches/sbc-fill-patches.js";
import { registerSbcTileEvents } from "../patches/sbc-tile-events.js";
import { registerSbcRewardEvents } from "../patches/sbc-reward-events.js";
import { registerFastSbcEvents } from "../patches/sbc-fast.js";
import { installClubSelectPatches } from "../patches/club-select.js";
import { registerClubSelectEvents } from "../patches/club-select-events.js";
import { installClubSelectSearchPatches } from "../patches/club-select-search-patches.js";
import { installRewardPatches } from "../patches/rewards.js";
import { installClubHubPatches } from "../patches/club-hub.js";
import { registerListFilterEvents } from "../patches/list-filter-events.js";
import { registerUiUtilsEvents, installUiUtilsPatches } from "../patches/ui-utils.js";
import { installLocalizationPatch, registerPlayerMetaEvents } from "../patches/player-meta.js";
import { installSbcSubmitPatch } from "../patches/sbc-submit.js";
import { registerMiscEvents, installMiscPatches } from "../patches/misc-patches.js";
import { registerLifecycleEvents, installLifecyclePatches } from "../patches/lifecycle-patches.js";
import { installAcademyDetailsPatches } from "../patches/academy-details.js";
import {
  registerSbcIgnoreTextEvent,
  installSbcSquadOverviewPatches,
  installSbcSquadDetailPanelPatches
} from "../patches/sbc-squad-overview.js";
import { installPlayerBioPatches } from "../patches/player-bio.js";
import { installPanelPatches } from "../patches/panel-patches.js";

/**
 * Declarative patch installer preserving legacy hook order.
 */
export class PatchInstaller {
  /**
   * @param {object} ctx - Shared futweb runtime context
   */
  constructor(ctx, patchRegistry = null) {
    this.ctx = ctx;
    this.patchRegistry = patchRegistry;
    this.installState = "idle";
    this.phaseResults = [];
  }

  applyBaseStyle() {
    const { info } = this.ctx;
    info.base.style = FSU_BASE_STYLE;
  }

  wirePriceService() {
    const { events, fy, priceService } = this.ctx;
    priceService.setErrorHandler((error) => {
      events.notice(fy("notice.loaderror") + error, 2);
      events.hideLoader();
    });
    events.getFutbinUrl = (url) => priceService.getFutbinUrl(url);
    events.getPriceForUrl = (definitionIds) => priceService.getPriceForUrl(definitionIds);
    events.getPriceForFubin = (playerResourceId) => priceService.getPriceForFutbin(playerResourceId);
    events.getCachePrice = (definitionId, type) => priceService.getCachePrice(definitionId, type);
    events.priceLastDiff = (purchasePrice, lastPrice) => priceService.priceLastDiff(purchasePrice, lastPrice);
    events.externalRequest = (method, url, body, cType) =>
      this.ctx.httpClient.request(method, url, body, cType);
  }

  installEarly() {
    const c = this.ctx;
    this.runFeaturePatch("base-style", () => this.applyBaseStyle());
    this.runFeaturePatch("price-service", () => this.wirePriceService());
    this.runFeaturePatch("unassigned", () => installUnassignedPatches(c.pick("call", "events", "fy", "cntlr", "info", "debug")));
    this.runFeaturePatch("sbc-chemistry-service", () => Object.assign(c.events, c.ctx.createSbcChemistryService(c.repositories.TeamConfig).createEventsFacade()));
    this.runFeaturePatch("login", () => installLoginPatches(c.pick("call", "events", "info", "services", "debug", "fy", "GM_getValue", "GM_xmlhttpRequest")));
    this.installNavigationPatchGroup();
    this.runFeaturePatch("tactics-role", () => this.installTacticsRolePatchInternal());
    this.installSquadBuilderPatchGroup();
    this.runFeaturePatch("player-cards", () => installPlayerCardPatches(c.pick("call", "events", "fy", "cntlr", "info", "lock")));
  }

  installTacticsRolePatchInternal() {
    const { call } = this.ctx;
    if (!this.patchRegistry) {
      UTTacticsRoleSelectViewController.prototype.viewDidAppear = function (...args) {
        call.view.tacticsRole.call(this, ...args);
      };
      return;
    }
    const result = this.patchRegistry.install({
      id: "tactics-role.view-did-appear",
      resolveTarget: () =>
        typeof UTTacticsRoleSelectViewController === "undefined"
          ? null
          : UTTacticsRoleSelectViewController.prototype,
      verify: (target) =>
        typeof target?.viewDidAppear === "function" && typeof call.view?.tacticsRole === "function",
      apply: (target) => {
        const original = target.viewDidAppear;
        target.viewDidAppear = function (...args) {
          return call.view.tacticsRole.call(this, ...args);
        };
        return () => {
          target.viewDidAppear = original;
        };
      }
    });
    if (result.status === "failed") {
      throw new Error(result.error);
    }
  }

  installNavigationPatchGroup() {
    const results = installNavigationPatches(
      this.ctx.pick("call", "events", "info", "isPhone", "SBCCount"),
      this.patchRegistry
    );
    for (const result of results) {
      this.currentPhaseFeatures.push(result);
      if (result.status === "failed") {
        this.currentPhaseErrors.push({ id: result.id, error: new Error(result.error) });
      }
    }
  }

  installSquadBuilderPatchGroup() {
    const results = installSquadBuilderPatches(
      this.ctx.pick("call", "events", "fy", "info", "build"),
      this.patchRegistry
    );
    for (const result of results) {
      this.currentPhaseFeatures.push(result);
      if (result.status === "failed") {
        this.currentPhaseErrors.push({ id: result.id, error: new Error(result.error) });
      }
    }
  }

  installHubAndLists() {
    const c = this.ctx;
    this.runFeaturePatch("picks-rewards", () => installPicksRewardsPatches(c.pick("call", "events", "info", "fy", "isPhone", "debug")));
    this.runFeaturePatch("squad-overview-view", () => installSquadOverviewViewPatches(
      c.pick(
        "call",
        "events",
        "info",
        "fy",
        "cntlr",
        "isPhone",
        "repositories",
        "services",
        "debug",
        "SBCEligibilityKey",
        "GM_openInTab"
      )
    ));
    this.runFeaturePatch("sectioned-list", () => installSectionedListPatches(c.pick("call", "events", "info", "fy", "cntlr", "services", "debug")));
    this.runFeaturePatch("build-ignore", () => registerBuildIgnoreEvents(c.pick("events", "info", "fy", "set", "build", "debug")));
    this.runFeaturePatch("player-list", () => installPlayerListPatches(c.pick("call", "events", "info", "cntlr", "isPhone", "debug", "repositories", "services", "fy")));
    this.runFeaturePatch("sbc-hub", () => installSbcHubPatches(c.pick("info", "events", "services", "fy", "cntlr")));
    this.runFeaturePatch("academy-hub", () => installAcademyHubPatches(c.pick("info", "events", "fy", "repositories", "debug")));
    this.runFeaturePatch("sbc-info-fill", () => registerSbcInfoFillEvent(c.pick("events", "info", "fy", "html", "repositories")));
    this.runFeaturePatch("sbc-nav-events", () => registerSbcNavEvents(
      c.pick("events", "info", "fy", "cntlr", "isPhone", "repositories", "services", "futbinId", "GM_openInTab")
    ));
  }

  installSbcCore() {
    const c = this.ctx;
    this.runFeaturePatch("player-bio", () => installPlayerBioPatches(c.pick("events", "info", "cntlr", "services", "debug", "fy", "repositories")));
    this.runFeaturePatch("panel-patches", () => installPanelPatches(c.pick("call", "events", "info", "fy", "cntlr", "isPhone")));
    this.runFeaturePatch("sbc-match-events", () => this.wireSbcMatchEvents());
    this.runFeaturePatch("sbc-substitution", () => registerSbcSubstitutionEvents({ events: c.events }));
    this.runFeaturePatch("objectives-hub", () => installObjectivesHubPatches(c.pick("call", "events", "info", "fy", "isPhone", "services")));
    this.runFeaturePatch("home-hub-events", () => registerHomeHubEvents(c.pick("events", "info", "cntlr", "isPhone", "services")));
    this.runFeaturePatch("home-hub-patches", () => installHomeHubPatches(c.pick("call", "events", "info", "fy", "cntlr", "services", "debug", "fsuSC")));
  }

  wireSbcMatchEvents() {
    const { events, sbcPlayerMatchService } = this.ctx;
    const getSbcMatchHelpers = () => ({
      calculateChemistry: (...args) => events.calculateChemistry(...args),
      getChemistryPlayers: (...args) => events.getChemistryPlayers(...args),
      getItemBy: (...args) => events.getItemBy(...args),
      createVirtualChallenge: (...args) => events.createVirtualChallenge(...args)
    });
    events.SBCSetMeetsPlayers = (controller) =>
      sbcPlayerMatchService.findMeetsPlayers(controller, getSbcMatchHelpers());
  }

  installMarketAndSquad() {
    const c = this.ctx;
    this.runFeaturePatch("market", () => installMarketPatches(
      c.pick("call", "events", "info", "cntlr", "isPhone", "fy", "debug", "repositories", "services", "GM_setValue")
    ));
    this.runFeaturePatch("store", () => installStorePatches(
      c.pick(
        "call",
        "events",
        "info",
        "cntlr",
        "isPhone",
        "fy",
        "debug",
        "repositories",
        "services",
        "GM_setValue",
        "AssetLocationUtils",
        "unsafeWindow"
      )
    ));
    this.runFeaturePatch("search-patches", () => installSearchPatches(c.pick("call", "events", "info", "isPhone", "cntlr", "fy")));
    this.runFeaturePatch("search-events", () => registerSearchEvents(c.pick("call", "events", "info", "cntlr", "isPhone")));
    this.runFeaturePatch("sbc-squad-submit", () => installSbcSquadSubmitPatches(
      c.pick("call", "events", "info", "repositories", "services", "cntlr", "debug", "fy")
    ));
    this.runFeaturePatch("sbc-fill-events", () => registerSbcFillEvents(
      c.pick(
        "call",
        "events",
        "info",
        "cntlr",
        "isPhone",
        "services",
        "debug",
        "repositories",
        "build",
        "fastSbcService",
        "oneFillCriteriaService",
        "sbcSquadFillService",
        "sbcTemplateService",
        "sbcSquadSaveService"
      )
    ));
    this.runFeaturePatch("sbc-fill-patches", () => installSbcFillPatches(
      c.pick(
        "call",
        "events",
        "info",
        "cntlr",
        "isPhone",
        "services",
        "debug",
        "repositories",
        "build",
        "fsuSC",
        "fy",
        "enums",
        "GM_setValue"
      )
    ));
    this.runFeaturePatch("sbc-tile-events", () => registerSbcTileEvents(
      c.pick("events", "info", "fy", "cntlr", "isPhone", "services", "GM_setValue", "AssetLocationUtils")
    ));
    this.runFeaturePatch("sbc-reward-events", () => registerSbcRewardEvents(
      c.pick(
        "events",
        "info",
        "cntlr",
        "isPhone",
        "repositories",
        "services",
        "debug",
        "oneFillCriteriaService",
        "SBCEligibilityKey"
      )
    ));
    this.runFeaturePatch("fast-sbc", () => registerFastSbcEvents(
      c.pick(
        "events",
        "cntlr",
        "info",
        "debug",
        "repositories",
        "services",
        "fy",
        "fastSbcPlannerService"
      )
    ));
  }

  installClubAndUi() {
    const c = this.ctx;
    this.runFeaturePatch("club-select", () => installClubSelectPatches(c.pick("call", "events", "info", "fy", "cntlr", "isPhone", "repositories", "services", "debug")));
    this.runFeaturePatch("club-select-events", () => registerClubSelectEvents(c.pick("events", "info", "cntlr", "isPhone", "services", "repositories", "debug", "fy")));
    this.runFeaturePatch("club-select-search", () => installClubSelectSearchPatches(c.pick("call", "events", "info", "fy", "cntlr", "repositories", "services")));
    this.runFeaturePatch("rewards", () => installRewardPatches(c.pick("call", "events", "info", "fy", "cntlr", "isPhone", "repositories", "debug")));
    this.runFeaturePatch("club-hub", () => installClubHubPatches(c.pick("call", "events", "info", "fy", "cntlr", "isPhone", "repositories", "services")));
    this.runFeaturePatch("list-filter", () => registerListFilterEvents(c.pick("events", "repositories")));
    this.runFeaturePatch("ui-utils", () => registerUiUtilsEvents(c.pick("events", "info", "cntlr", "debug", "fy", "services")));
    this.runFeaturePatch("ui-utils-patches", () => installUiUtilsPatches());
    this.runFeaturePatch("localization", () => installLocalizationPatch(c.pick("call")));
    this.runFeaturePatch("player-meta", () => registerPlayerMetaEvents(c.pick("events", "info", "fy", "services")));
  }

  installLate() {
    const c = this.ctx;
    this.runFeaturePatch("sbc-submit", () => installSbcSubmitPatch({
      sbcCountService: c.ctx.sbcCountService,
      onCountChanged: () => c.SBCCount.changeCount()
    }));
    this.runFeaturePatch("misc-events", () => registerMiscEvents(c.pick("events", "info", "cntlr", "services", "repositories", "debug", "fy")));
    this.runFeaturePatch("misc-patches", () => installMiscPatches(c.pick("events", "info", "fy", "debug")));
    this.runFeaturePatch("sbc-requirements", () => installSbcRequirementsPatch(c.pick("events", "info", "fy", "repositories")));
    this.runFeaturePatch("lifecycle-events", () => registerLifecycleEvents(c.pick("events", "info", "fy", "debug")));
    this.runFeaturePatch("lifecycle-patches", () => installLifecyclePatches(c.pick("events", "cntlr", "isPhone", "info")));
    this.runFeaturePatch("academy-details", () => installAcademyDetailsPatches(
      c.pick("info", "events", "repositories", "services", "cntlr", "isPhone", "debug")
    ));
    this.runFeaturePatch("sbc-ignore-text", () => registerSbcIgnoreTextEvent(c.pick("events", "info", "fy")));
    this.runFeaturePatch("sbc-squad-overview", () => installSbcSquadOverviewPatches(
      c.pick("events", "info", "fy", "cntlr", "isPhone", "repositories", "debug", "SBCEligibilityKey")
    ));
    this.runFeaturePatch("sbc-squad-detail-panel", () => installSbcSquadDetailPanelPatches(c.pick("events", "info", "cntlr")));
  }

  installAll() {
    if (this.installState !== "idle") {
      return {
        status: "already-installed",
        phases: this.getDiagnostics()
      };
    }

    this.installState = "installing";
    const phases = [
      ["early", this.installEarly],
      ["hub-and-lists", this.installHubAndLists],
      ["sbc-core", this.installSbcCore],
      ["market-and-squad", this.installMarketAndSquad],
      ["club-and-ui", this.installClubAndUi],
      ["late", this.installLate]
    ];
    for (const [name, install] of phases) {
      this.runPhase(name, install);
    }
    this.installState = this.phaseResults.some((result) => result.status === "failed")
      ? "completed-with-errors"
      : "installed";
    return {
      status: this.installState,
      phases: this.getDiagnostics()
    };
  }

  /**
   * Runs a specific feature patch block, protecting against duplicate execution and isolating failures.
   * @param {string} id
   * @param {() => void} installFn
   */
  runFeaturePatch(id, installFn) {
    if (!this.patchRegistry) {
      try {
        installFn();
        this.currentPhaseFeatures.push({ id, status: "installed" });
      } catch (error) {
        this.ctx.debug?.log(`Patch ${id} failed`, error);
        this.currentPhaseErrors.push({ id, error });
        this.currentPhaseFeatures.push({
          id,
          status: "failed",
          error: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const result = this.patchRegistry.install({
      id,
      resolveTarget: () => true,
      apply: () => {
        installFn();
      }
    });

    this.currentPhaseFeatures.push(result);

    if (result.status === "failed") {
      const err = new Error(result.error);
      this.ctx.debug?.log(`Patch ${id} failed`, err);
      this.currentPhaseErrors.push({ id, error: err });
    }
  }

  /**
   * @param {string} name
   * @param {() => void} install
   */
  runPhase(name, install) {
    this.currentPhaseErrors = [];
    this.currentPhaseFeatures = [];
    try {
      install.call(this);
      if (this.currentPhaseErrors.length > 0) {
        const errorMsg = this.currentPhaseErrors
          .map((e) => `${e.id}: ${e.error instanceof Error ? e.error.message : String(e.error)}`)
          .join("; ");
        const result = {
          name,
          status: "failed",
          error: errorMsg
        };
        if (this.currentPhaseFeatures.length > 0) result.features = this.currentPhaseFeatures;
        this.phaseResults.push(result);
      } else {
        const result = { name, status: "installed" };
        if (this.currentPhaseFeatures.length > 0) result.features = this.currentPhaseFeatures;
        this.phaseResults.push(result);
      }
    } catch (error) {
      this.phaseResults.push({
        name,
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
      this.ctx.debug?.log("Patch phase failed", name, error);
    }
  }

  getDiagnostics() {
    return this.phaseResults.map((result) => ({ ...result }));
  }
}
