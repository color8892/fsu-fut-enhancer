import { createDebug } from "./Debug.js";
import { ControllerAccess } from "./ControllerAccess.js";
import { BuildPreferencesService } from "../domain/BuildPreferencesService.js";
import { FsuHttpClient } from "../infra/HttpClient.js";
import { FsuJsonStore } from "../infra/JsonStore.js";
import { PlayerLockService } from "../domain/PlayerLockService.js";
import { PriceService } from "../domain/PriceService.js";
import { SbcChemistryService } from "../domain/SbcChemistryService.js";
import { SbcCountService } from "../domain/SbcCountService.js";
import { SettingsService } from "../domain/SettingsService.js";

export class AppContext {
  constructor({ getValue, setValue, xmlHttpRequest, userAgent, getInfo }) {
    this.debug = createDebug();
    this.store = new FsuJsonStore(getValue, setValue);
    this.httpClient = new FsuHttpClient(xmlHttpRequest, userAgent);
    this.controllerAccess = new ControllerAccess();
    this.priceService = new PriceService({
      httpClient: this.httpClient,
      store: this.store,
      getInfo,
      debug: this.debug
    });
    this.settingsService = new SettingsService({
      store: this.store,
      getInfo,
      debug: this.debug
    });
    this.buildPreferencesService = new BuildPreferencesService({
      store: this.store,
      getInfo,
      debug: this.debug
    });
    this.playerLockService = new PlayerLockService({
      store: this.store,
      getInfo,
      debug: this.debug
    });
    this.sbcCountService = new SbcCountService({
      store: this.store,
      getInfo,
      debug: this.debug
    });
    this.sbcChemistryService = null;
  }

  createSbcChemistryService(teamConfig) {
    this.sbcChemistryService = new SbcChemistryService({
      getTeamLink: (teamId) => teamConfig.teamLinks.get(teamId),
      getTeam: (teamId) => teamConfig.getTeam(teamId)
    });
    return this.sbcChemistryService;
  }
}