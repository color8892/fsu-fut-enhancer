import { AppContext } from "../core/AppContext.js";
import { FsuContext } from "../core/FsuContext.js";
import { LOCALIZATION_STRINGS } from "../data/localization.js";
import { createGameInfo } from "../data/game-config.js";
import { createLocalization } from "../domain/Localization.js";
import { registerSettingsScreen } from "../ui/SettingsScreen.js";
import { PatchRegistry } from "../core/PatchRegistry.js";
import { PatchInstaller } from "../core/PatchInstaller.js";
import { FastSbcService } from "../domain/FastSbcService.js";
import { SbcPlayerMatchService } from "../domain/SbcPlayerMatchService.js";
import { OneFillCriteriaService } from "../domain/OneFillCriteriaService.js";
import { SbcSquadFillService } from "../domain/SbcSquadFillService.js";
import { SbcTemplateService } from "../domain/SbcTemplateService.js";
import { SbcSquadSaveService } from "../domain/SbcSquadSaveService.js";
import { registerEarlyModules, registerLateModules } from "../core/ModuleRegistry.js";
import { installAppInitPatches, registerAppInitEvents } from "../patches/app-init.js";

export function futweb() {
        var events = {}, html = {}, call = {}, pdb = {};
        let set, build, lock, SBCCount, futbinId, fsuSC;
        const patchRegistry = new PatchRegistry();
        const sbcPlayerMatchService = new SbcPlayerMatchService();
        const fastSbcService = new FastSbcService();
        const oneFillCriteriaService = new OneFillCriteriaService();
        const sbcSquadFillService = new SbcSquadFillService();
        const sbcTemplateService = new SbcTemplateService();
        const sbcSquadSaveService = new SbcSquadSaveService();
        const info = createGameInfo();
        const ctx = new AppContext({
            getValue: GM_getValue,
            setValue: GM_setValue,
            xmlHttpRequest: GM_xmlhttpRequest,
            userAgent: navigator.userAgent,
            getInfo: () => info
        });
        const store = ctx.store;
        const httpClient = ctx.httpClient;
        const priceService = ctx.priceService;
        const debug = ctx.debug;
        const cntlr = ctx.controllerAccess;
        events.countPlayerAccele = (h,ag,ac,st) => {
            let type = 4,diff = Math.abs(ag - st);
            if(diff >= 20){
                if(ag >= 80 && ac >= 80 && h <= 175){
                    type = 1;
                }else if(st >= 80 && ac >= 55 && h >= 188){
                    type = 7;
                }
            }else if(diff >= 12){
                if(ag >= 70 && ac >= 80 && h <= 182){
                    type = 2;
                }else if(st >= 75 && ac >= 55 && h >= 183){
                    type = 6;
                }
            }else if(diff >= 4){
                if(ag >= 65 && ac >= 70 && h <= 182){
                    type = 3;
                }else if(st >= 65 && ac >= 40 && h >= 181){
                    type = 5;
                }
            }
            return type;
        }
        events.taskHtml = function(number,text){
            let html = "<div>{Number}</div><div>{reward}</div>";
            if(number > 0){
                html = html.replace("{Number}",fy("task.added") + number);
            }else{
                html = html.replace("fsu-task","fsu-task no");
                html = html.replace("{Number}",fy("task.noadded"));
            }
            if(text == "、"){
                text = "";
            }
            let reward = text;
            reward = reward.replace("组合包",fy("task.pack"));
            reward = reward.replace("球员",fy("task.player"));
            html = html.replace("{reward}",reward);
            return html;
        };
        events.showLoader = () => {
            document.querySelector(".ut-click-shield").classList.add("showing","fsu-loading");
            document.querySelector(".loaderIcon").style.display = "block";
        };

        events.hideLoader = () => {
            document.querySelector(".ut-click-shield").classList.remove("showing","fsu-loading");
            document.querySelector(".loaderIcon").style.display = "none";
            if(info.run.template){
                info.run.template = false;
                if(isPhone()){
                    if(cntlr.current() instanceof UTSBCSquadOverviewViewController){
                        cntlr.current()._fsu.fillSquadBtn.setInteractionState(1);
                    }else if(cntlr.current() instanceof UTSBCSquadDetailPanelViewController){
                        _.forEach(cntlr.current().getNavigationController().childViewControllers, c => {
                            if(c instanceof UTSBCSquadOverviewViewController){
                                c._fsu.fillSquadBtn.setInteractionState(1);
                            }
                        })
                    }
                }else{
                    cntlr.left()._fsu.fillSquadBtn.setInteractionState(1);
                }
            }
            if(info.run.losauction){
                info.run.losauction = false;
                if(isPhone()){
                    events.notice("notice.phoneloas",0)
                }
            }
            if(info.run.bulkbuy){
                info.run.bulkbuy = false;
            }
            if(info.run.openPacks){
                info.run.openPacks = false;
            }
            events.changeLoadingText("loadingclose.text");
        };
        const { fy, eafy } = createLocalization(() => info);
        info.localization = LOCALIZATION_STRINGS;

        set = ctx.settingsService.createFacade({
            createToggle: (...args) => events.createToggle(...args),
            fy
        });
        build = ctx.buildPreferencesService.createFacade();
        lock = ctx.playerLockService.createFacade();
        SBCCount = ctx.sbcCountService.createFacade({
            isPhone,
            fy,
            createButton: (...args) => events.createButton(...args),
            popup: (...args) => events.popup(...args)
        });
        futbinId = priceService.createFutbinIdFacade();

        const fsuCtx = new FsuContext({
            events, info, html, call, pdb, cntlr, fy, debug, ctx, store, httpClient, priceService,
            repositories, services, isPhone, set, build, lock, SBCCount, futbinId, eafy,
            SBCEligibilityKey, unsafeWindow, AssetLocationUtils, enums,
            GM_getValue, GM_setValue, GM_xmlhttpRequest, GM_openInTab, GM_info,
            sbcPlayerMatchService, fastSbcService, oneFillCriteriaService,
            sbcSquadFillService, sbcTemplateService, sbcSquadSaveService
        });

        installAppInitPatches(fsuCtx.toAppInitPatchesDeps());
        registerEarlyModules(fsuCtx);

        ctx.settingsService.setOnSave(() => events.notice(fy("notice.setsuccess"), 0));
        ctx.buildPreferencesService.setOnSave(() => events.notice(fy("notice.setsuccess"), 0));
        ctx.playerLockService.setOnToggle((action) => {
            events.notice(fy(action === "unlock" ? "notice.unlockplayer" : "notice.lockplayer"), 0);
        });

        registerAppInitEvents(fsuCtx.toAppInitEventsDeps());

        ({ fsuSC } = registerSettingsScreen({
            EAView,
            EAViewController,
            JSUtils,
            ...fsuCtx.toSettingsScreenDeps()
        }));
        fsuCtx.fsuSC = fsuSC;

        html = {
            "priceBtn":"<button class=\"flat pagination fsu-getprice\" id=\"getprice\">{price.btntext}</button>",
            "priceBtn2":"<button class=\"btn-standard section-header-btn mini call-to-action fsu-getprice\" id=\"getprice\">{price.btntext}</button>",
            "sbcInfo":"<div class=\"fsu-sbc-info\"><div class=\"currency-coins\">{sbc.price}{price}</div><div><span>{sbc.like}{up}</span><span>{sbc.dislike}{down}</span></div></div>",
            "consultBtn":"<a href=\"https://www.futbin.com/squad-building-challenges/ALL/{sbcId}\" target=\"_blank\" class=\"fsu-consult fsu-sbcButton\">{sbc.consult}</a>",
            "countBtn":"<a id=\"goToCount\" href=\"javascript:void(0)\" class=\"fsu-count\">{sbc.count}</a>",
            "searchInput":"<input type=\"text\" class=\"fsu-input\" placeholder=\"{text}\" maxlength=\"50\">",
            "uasBtn":"<button class=\"btn-standard section-header-btn mini call-to-action fsu-getprice\" id=\"uasreset\">{uasreset.btntext}</button>",
        };

        call.view = patchRegistry.createViewMap({
            card: UTPlayerItemView.prototype.renderItem,
            miscItem: UTMiscItemView.prototype.renderItem,
            unassigned: UTUnassignedItemsViewController.prototype.renderView,
            build: UTSquadBuilderViewController.prototype.viewDidAppear,
            market: UTMarketSearchView.prototype._generate,
            setting: UTAppSettingsView.prototype._generate,
            squadRating: UTSquadEntity.prototype._calculateRating,
            transfer: UTTransferListViewController.prototype._renderView,
            clubHub: UTClubHubView.prototype.clearTileContent,
            ea: EAViewController.prototype.viewDidAppear,
            push: UTGameFlowNavigationController.prototype.didPush,
            login: UTLoginView.prototype._generate,
            tacticsRole: UTTacticsRoleSelectViewController.prototype.viewDidAppear,
            transferMarket: UTTransferMarketPaginationViewModel.prototype.startAuctionUpdates,
            unassignedRenderSection: UTUnassignedItemsView.prototype.renderSection,
            unassignedUpdateUDSO:
                UTUnassignedItemsViewController.prototype.updateUntradeableDuplicateSectionOptions
        });

        call.plist = {
            sectioned:UTSectionedItemListView.prototype.addItems,
            paginated:UTPaginatedItemListView.prototype.renderItems,
            storeReveal:UTStoreRevealModalListView.prototype.addItems,
            club:UTClubRepository.prototype.removeClubItem,
            squadSet:UTSquadEntity.prototype.setPlayers,
            squadGR:UTSquadEntity.prototype.getRating,
            squad:UTSquadOverviewViewController.prototype.viewDidAppear
        }
        call.selectClub = {
            updata:UTSelectItemFromClubViewController.prototype.updateItemList,
            request:UTSelectItemFromClubViewController.prototype.requestItems,
            handle:UTSelectItemFromClubViewController.prototype.handleItemRetrieval
        }
        call.other = {
            uaTile:UTUnassignedTileView.prototype.setNumberOfItems,
            store:{
                setPacks:UTStoreView.prototype.setPacks,
                setCategory:UTStoreViewController.prototype.setCategory
            },
            market:{
                eSearch:UTMarketSearchFiltersViewController.prototype.eSearchSelected,
                setFilter:UTMarketSearchFiltersView.prototype.setFilters,
            },
            rewards:{
                choice:UTRewardSelectionChoiceViewController.prototype.viewDidAppear,
                popupTapped:UTGameRewardsViewController.prototype.onButtonTapped,
                objectiveDetail:FCObjectiveDetailsView.prototype.render,
                choiceSet:UTRewardSelectionChoiceView.prototype.expandRewardSet,
                check:{
                    FC:FCGameRewardsViewController.prototype.checkRewards,
                    UT:UTGameRewardsViewController.prototype.checkRewards,
                }
            },
            localize:EALocalizationService.prototype.localize,
            picks:{
                setItems:UTPlayerPicksView.prototype.setCarouselItems
            }
        }
        call.task = {
            sbcT:UTSBCHubView.prototype.populateTiles,
            sbcN:UTSBCHubView.prototype.populateNavigation,
            objN:UTObjectivesHubView.prototype.populateNavigation,
            objG:UTObjectiveCategoryView.prototype.setCategoryGroups,
            home:UTHomeHubView.prototype._generate,
            objSetTitle:UTObjectivesHubTileView.prototype.setSubtitle,
            sbcSetDate:UTSBCSetTileView.prototype.setData,
            rewardList:UTSBCGroupRewardListView.prototype.setRewards,
            seasonSet:FCObjectiveSeasonView.prototype.setCampaign
        }
        call.panel = {
            quickRender:UTQuickListPanelViewController.prototype.renderView,
            market:UTMarketSearchFiltersView.prototype.setPinnedItem,
            reward:UTRewardSelectionChoiceView.prototype.expandRewardSet,
        }
        call.search = {
            club:{
                viewDid:UTClubSearchFiltersViewController.prototype.viewDidAppear,
                modeChange:UTClubSearchFiltersViewController.prototype.onSearchModeChanged,
                setChemDiff:UTClubSearchResultsView.prototype.setItemsWithChemDiff
            },
            filters:UTItemSearchView.prototype.setFilters ,
            result:UTPaginatedItemListView.prototype.setPaginationState,
            dropdownOpen:UTDropDownControl.prototype.open,
            request:UTClubSearchResultsViewController.prototype._requestItems,
            setHeader:UTClubSearchResultsViewController.prototype.setupHeader
        };
        call.squad = {
            setPlayers: UTSquadEntity.prototype.setPlayers,
            swapPlayers: UTSquadEntity.prototype.swapPlayersByIndex,
            addItem: UTSquadEntity.prototype.addItemToSlot,
            removeItem: UTSquadEntity.prototype.removeItemFromSlot,
            removeAll: UTSquadEntity.prototype.removeAllItems,
            submitted: UTSBCSquadOverviewViewController.prototype._onChallengeSubmitted,
            submit: UTSBCSquadOverviewViewController.prototype._submitChallenge,
            requirements: UTSBCChallengeRequirementsView.prototype.renderChallengeRequirements
        };

        new PatchInstaller(fsuCtx).installAll();
        registerLateModules(fsuCtx);

        if (typeof FSU_DEBUG !== "undefined" && FSU_DEBUG) {
            const exposed = fsuCtx.toDebugExpose();
            unsafeWindow.call = exposed.call;
            unsafeWindow.info = exposed.info;
            unsafeWindow.cntlr = exposed.cntlr;
            unsafeWindow.events = exposed.events;
            unsafeWindow.fy = exposed.fy;
            unsafeWindow.GM_addStyle = GM_addStyle;
        }
}