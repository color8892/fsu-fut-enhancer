import { FastSbcService } from "../domain/FastSbcService.js";
import { FastSbcPlannerService } from "../domain/FastSbcPlannerService.js";
import { OneFillCriteriaService } from "../domain/OneFillCriteriaService.js";
import { SbcPlayerMatchService } from "../domain/SbcPlayerMatchService.js";
import { SbcSquadFillService } from "../domain/SbcSquadFillService.js";
import { SbcSquadSaveService } from "../domain/SbcSquadSaveService.js";
import { SbcTemplateService } from "../domain/SbcTemplateService.js";

export function createSbcServices() {
  return {
    sbcPlayerMatchService: new SbcPlayerMatchService(),
    fastSbcService: new FastSbcService(),
    fastSbcPlannerService: new FastSbcPlannerService(),
    oneFillCriteriaService: new OneFillCriteriaService(),
    sbcSquadFillService: new SbcSquadFillService(),
    sbcTemplateService: new SbcTemplateService(),
    sbcSquadSaveService: new SbcSquadSaveService()
  };
}