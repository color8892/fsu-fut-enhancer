import { AppContext } from "../core/AppContext.js";
import { LOCALIZATION_STRINGS } from "../data/localization.js";
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
        var events = {},info = {},html = {},call = {},pdb = {};
        let set, build, lock, SBCCount, futbinId, fsuSC;
        const patchRegistry = new PatchRegistry();
        const sbcPlayerMatchService = new SbcPlayerMatchService();
        const fastSbcService = new FastSbcService();
        const oneFillCriteriaService = new OneFillCriteriaService();
        const sbcSquadFillService = new SbcSquadFillService();
        const sbcTemplateService = new SbcTemplateService();
        const sbcSquadSaveService = new SbcSquadSaveService();
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
        info = {
            "task":{"obj":{"stat":{},"html":"","source":[]},"sbc":{"stat":{},"html":""}},
            "evolutions":{"new":[], "newCount":0, "html":""},
            "base":{"state":false,"platform":"pc","price":{},"sId":"","localization":"",autoLoad:true,"ratings":{},"input":true,"promo":0,"savesquad":false,"packcoin":{},"packreturns":{},"oddo":{},"fastsbc":{},"fastsbctips":false,"imgDB":null,"imgCache":{}},
            "squad":{},
            "meta":{
                "bodyType": {},
                "baseBodyType": 2,
                "realFace": [],
            },
            "api":{},
            "nave":{},
            "SBCCount":{},
            "bodytypetext":["UKN","L&M","A&M","S&M","L&T","A&T","S&T","L&S","A&S","S&S","UNQ"],
            "criteria":{},
            "run":{"template":false,"losauction":false,"bulkbuy":false},
            "roster":{"state":false,"data":{},"ea":{},"page":-1,"element":{},"thousand":{"lowest":99}},
            "language":2,
            "localization":{},
            "quick":{},
            "market":{"ts":0,"mb":[]},
            "range":[46,99],
            "build":{"league":true,"flag":false,"untradeable":true,"ignorepos":true,"academy":false,"strictlypcik":true,"comprare":true,"comprange":true,"firststorage":true,"sbfirstcommon":true},
            "league":{2012:'中超',61:'英乙',60:'英甲',14:'英冠',13:'英超',2208:'英丙',2149:'印超',32:'意乙',31:'意甲',54:'西乙',53:'西甲',68:'土超',50:'苏超',308:'葡超',39:'美职联',17:'法乙',16:'法甲',20:'德乙',19:'德甲',2076:'德丙',2118:'传奇',353:'阿甲'},
            "setfield":{"card":["pos","price","other","club","low","meta"],"player":["auction","futbin","getprice","loas","uatoclub","transfertoclub","pickbest"],"sbc":["top","right","quick","duplicate","records","input","icount","template","templatemode","market","sback","cback","dupfill","autofill","squadcmpl","conceptbuy","meetsreq","headentrance"],"info":["obj","sbc","sbcf","sbcs","pack","squad","skipanimation","sbcagain","packagain"]},
            "set":{},
            "lock":[],
            "autobuy":{"controller":null,"infoViews":{},"logView":{},"log":[]},
            "douagain":{"sbc":0,"pack":0,"SBCList":[]},
            "formation":{
                "343": [0,5,5,5,12,14,14,16,23,25,27],
                "352": [0,5,5,5,12,10,10,16,25,18,25],
                "424": [0,3,5,5,7,14,14,23,27,25,25],
                "433": [0,3,5,5,7,14,14,14,23,25,27],
                "442": [0,3,5,5,7,12,14,14,16,25,25],
                "451": [0,3,5,5,7,12,18,14,18,16,25],
                "523": [0,3,5,5,5,7,14,14,23,25,27],
                "532": [0,3,5,5,5,7,14,10,14,25,25],
                "541": [0,3,5,5,5,7,12,14,14,16,25],
                "3142": [0,5,5,5,12,14,10,14,16,25,25],
                "3412": [0,5,5,5,12,14,14,16,25,18,25],
                "3421": [0,5,5,5,12,14,14,16,18,25,18],
                "4132": [0,3,5,5,7,12,10,16,14,25,25],
                "4141": [0,3,5,5,7,10,12,14,14,16,25],
                "4213": [0,3,5,5,7,10,10,18,23,25,27],
                "4222": [0,3,5,5,7,10,10,18,18,25,25],
                "4231": [0,3,5,5,7,10,10,18,18,18,25],
                "4312": [0,3,5,5,7,14,14,14,18,25,25],
                "4321": [0,3,5,5,7,14,14,14,18,25,18],
                "5212": [0,3,5,5,5,7,14,14,25,18,25],
                "41212": [0,3,5,5,7,12,10,16,25,18,25],
                "41212-2": [0,3,5,5,7,14,10,14,25,18,25],
                "4231-2": [0,3,5,5,7,10,10,12,18,16,25],
                "433-2": [0,3,5,5,7,14,10,14,23,25,27],
                "433-3": [0,3,5,5,7,10,14,10,23,25,27],
                "433-4": [0,3,5,5,7,14,18,14,23,25,27],
                "4411-2": [0,3,5,5,7,12,14,14,16,18,25],
                "442-2": [0,3,5,5,7,12,10,10,16,25,25],
                "451-2": [0,3,5,5,7,12,14,14,14,16,25]
            },
            "keyEvents":[],
            "chemstyle": {
                "250": { "1": 3, "11": 3, "22": 3, "28": 3, "12": 3, "20": 3, "19": 3, "27": 3, "2": 3, "13": 3, "15": 3, "9": 3, "21": 3, "24": 3, "25": 3, "6": 3 },
                "251": { "11": 9, "16": 3, "22": 3, "23": 6, "26": 3, "28": 3, "5": 6, "6": 9, "8": 3 },
                "252": { "11": 6, "16": 9, "22": 3, "26": 3, "28": 3, "2": 6, "3": 3, "7": 3, "15": 9 },
                "253": { "11": 6, "16": 3, "22": 9, "23": 3, "28": 3, "12": 3, "20": 9, "19": 3, "27": 6 },
                "254": { "16": 6, "22": 3, "23": 6, "28": 3, "7": 6, "13": 6, "15": 3, "9": 3, "4": 3, "6": 6 },
                "255": { "0": 3, "1": 3, "11": 3, "16": 3, "22": 6, "23": 6, "28": 3, "4": 6, "6": 3, "8": 6 },
                "256": { "12": 3, "14": 6, "20": 3, "19": 6, "27": 9, "2": 9, "7": 6, "15": 3, "9": 3 },
                "257": { "12": 6, "17": 3, "20": 9, "19": 3, "27": 6, "5": 6, "6": 9, "8": 3 },
                "258": { "12": 9, "20": 6, "19": 6, "27": 3, "10": 6, "21": 3, "24": 9, "25": 3 },
                "259": { "11": 3, "22": 3, "23": 6, "12": 3, "17": 6, "20": 3, "19": 6, "7": 3, "13": 6, "15": 3, "9": 3 },
                "260": { "0": 3, "1": 3, "12": 3, "14": 6, "20": 3, "19": 3, "27": 6, "2": 3, "3": 6, "15": 6 },
                "261": { "10": 6, "18": 6, "21": 9, "24": 3, "25": 3, "4": 9, "6": 3, "8": 6 },
                "262": { "2": 6, "7": 3, "13": 3, "15": 6, "9": 3, "10": 3, "21": 6, "24": 9, "25": 6 },
                "263": { "11": 3, "22": 6, "23": 3, "3": 3, "7": 6, "13": 3, "15": 3, "10": 3, "18": 3, "21": 3, "24": 3, "25": 6 },
                "264": { "12": 3, "20": 3, "19": 6, "10": 6, "21": 3, "24": 6, "25": 3, "5": 6, "6": 3, "8": 6 },
                "265": { "0": 3, "1": 3, "10": 3, "18": 3, "21": 3, "24": 6, "25": 6, "6": 6, "8": 3 },
                "266": { "0": 6, "1": 6, "11": 3, "16": 3, "22": 3, "26": 9, "28": 6 },
                "267": { "0": 6, "1": 6, "12": 9, "14": 6, "20": 3, "19": 6, "27": 3 },
                "268": { "0": 6, "1": 6, "10": 3, "18": 6, "21": 3, "24": 3, "25": 9 },
                "269": { "29": 9, "30": 3, "31": 6 },
                "270": { "32": 9, "0": 3, "31": 6 },
                "271": { "33": 6, "32": 9, "1": 3 },
                "272": { "29": 6, "30": 9, "33": 3 },
                "273": { "29": 3, "30": 3, "31": 3, "32": 3, "0": 3 }
            },
            "chemMap":{
                3: { 9: 9, 6: 6, 3: 3 },
                2: { 9: 6, 6: 4, 3: 2 },
                1: { 9: 3, 6: 2, 3: 1 },
                0: { 9: 0, 6: 0, 3: 0 }
            },
            "inpacks": {"defIds": [], "rarityIds": [], "players": []},
            "dynamicStats": {
                1: ["extendedPlayerInfo.general.overall"],
                2: ["extendedPlayerInfo.tab.traits"],
                3: ["extendedPlayerInfo.positions"],
                4: ["extendedPlayerInfo.tab.roles"],
                5: ["extendedPlayerInfo.saveTechnique.acrobatic", "extendedPlayerInfo.stats.weakfoot"]
            },
            "extraChemKeys": ["full", "nation", "league", "club", "allNation", "allLeague"],
            "priceType": ["ut", "sbc", "ob", "sp"],
            "academy": [],
            "attributes": {
                "pac":{
                    id: PlayerAttribute.ONE,
                    list: [ItemSubAttribute.acceleration, ItemSubAttribute.sprintspeed],
                    weight: [0.45, 0.55]
                },
                "sho":{
                    id: PlayerAttribute.TWO,
                    list: [ItemSubAttribute.positioning, ItemSubAttribute.finishing, ItemSubAttribute.shotpower, ItemSubAttribute.longshots, ItemSubAttribute.volleys, ItemSubAttribute.penalties],
                    weight: [0.05, 0.45, 0.20, 0.20, 0.05, 0.05],
                },
                "pas":{
                    id: PlayerAttribute.THREE,
                    list: [ItemSubAttribute.vision, ItemSubAttribute.crossing, ItemSubAttribute.freekickaccuracy, ItemSubAttribute.shortpassing, ItemSubAttribute.longpassing, ItemSubAttribute.curve],
                    weight: [0.20, 0.20, 0.05, 0.35, 0.15, 0.05],
                },
                "dri":{
                    id: PlayerAttribute.FOUR,
                    list: [ItemSubAttribute.agility, ItemSubAttribute.balance, ItemSubAttribute.reactions, ItemSubAttribute.ballcontrol, ItemSubAttribute.dribbling, ItemSubAttribute.composure],
                    weight: [0.10, 0.05, 0.05, 0.35, 0.40, 0.05],
                },
                "def":{
                    id: PlayerAttribute.FIVE,
                    list: [ItemSubAttribute.interceptions, ItemSubAttribute.headingaccuracy, ItemSubAttribute.marking, ItemSubAttribute.standingtackle, ItemSubAttribute.slidingtackle],
                    weight: [0.20, 0.10, 0.30, 0.30, 0.10],
                },
                "phy":{
                    id: PlayerAttribute.SIX,
                    list: [ItemSubAttribute.jumping, ItemSubAttribute.stamina, ItemSubAttribute.strength, ItemSubAttribute.aggression],
                    weight: [0.05, 0.25, 0.50, 0.20]
                }
            },
            "attributesGK": {
                "div":{
                    id: PlayerAttribute.ONE,
                    list: [ItemSubAttribute.gkdiving],
                    weight: [1],
                },
                "han":{
                    id: PlayerAttribute.TWO,
                    list: [ItemSubAttribute.gkhandling],
                    weight: [1],
                },
                "kic":{
                    id: PlayerAttribute.THREE,
                    list: [ItemSubAttribute.gkkicking],
                    weight: [1],
                },
                "ref":{
                    id: PlayerAttribute.FOUR,
                    list: [ItemSubAttribute.gkreflexes, ItemSubAttribute.reactions],
                    weight: [1, 0],
                },
                "spd":{
                    id: PlayerAttribute.FIVE,
                    list: [ItemSubAttribute.acceleration, ItemSubAttribute.sprintspeed],
                    weight: [0.45, 0.55]
                },
                "pos":{
                    id: PlayerAttribute.SIX,
                    list: [ItemSubAttribute.gkpositioning],
                    weight: [1],
                }
            },
            "apiPlatform": 1,
            "apiProxy": "",
            "futbinId": {},
            "posIdToName": ["GK","SW","RWB","RB","RCB","CB","LCB","LB","LWB","RDM","CDM","LDM","RM","RCM","CM","LCM","LM","RAM","CAM","LAM","RF","CF","LF","RW","RS","ST","LS","LW"],
            "fgList": {},
            "fgGrades": {
                "text": ["S", "A", "B", "C", "D", "F"],
                "color": [
                    "rgba(255,215,0,0.9)",
                    "rgba(220,38,38,0.8)",
                    "rgba(251,146,60,0.8)",
                    "rgba(6,182,212,0.8)",
                    "rgba(34,197,94,0.8)",
                    "rgba(255,255,255,0.8)"
                ]
            },
            "playerMetaData": {}
        };
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

        installAppInitPatches({
            events,
            info,
            fy,
            services,
            cntlr,
            isPhone,
            SBCCount,
            set,
            build,
            lock,
            futbinId,
            debug,
            GM_getValue,
            GM_setValue,
            GM_xmlhttpRequest,
            GM_info
        });

        registerEarlyModules({
            events,
            info,
            repositories,
            services,
            debug,
            fy,
            SBCEligibilityKey
        });

        ctx.settingsService.setOnSave(() => events.notice(fy("notice.setsuccess"), 0));
        ctx.buildPreferencesService.setOnSave(() => events.notice(fy("notice.setsuccess"), 0));
        ctx.playerLockService.setOnToggle((action) => {
            events.notice(fy(action === "unlock" ? "notice.unlockplayer" : "notice.lockplayer"), 0);
        });

        registerAppInitEvents({ events, info, fy, cntlr, isPhone, services, repositories, debug, SBCCount, set, build, lock, GM_getValue, GM_setValue, GM_xmlhttpRequest, GM_info });

        ({ fsuSC } = registerSettingsScreen({
            EAView,
            EAViewController,
            JSUtils,
            events,
            fy,
            cntlr,
            info,
            set,
            GM_openInTab,
            isPhone,
            enums
        }));

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

        const patchCtx = {
            events, info, html, call, pdb, cntlr, fy, debug, ctx, store, httpClient, priceService,
            repositories, services, isPhone, set, build, lock, SBCCount, fsuSC, futbinId, eafy,
            SBCEligibilityKey, unsafeWindow, AssetLocationUtils, enums,
            GM_getValue, GM_setValue, GM_xmlhttpRequest, GM_openInTab,
            sbcPlayerMatchService, fastSbcService, oneFillCriteriaService,
            sbcSquadFillService, sbcTemplateService, sbcSquadSaveService,
            pick(...keys) {
                const out = {};
                for (const key of keys) out[key] = patchCtx[key];
                return out;
            }
        };

        new PatchInstaller(patchCtx).installAll();

        registerLateModules({
            events,
            info,
            repositories,
            services,
            cntlr,
            debug,
            fy,
            eafy,
            futbinId,
            pdb,
            isPhone,
            httpClient,
            priceService
        });

        if (typeof FSU_DEBUG !== "undefined" && FSU_DEBUG) {
            unsafeWindow.call = call;
            unsafeWindow.info = info;
            unsafeWindow.cntlr = cntlr;
            unsafeWindow.events = events;
            unsafeWindow.fy = fy;
            unsafeWindow.GM_addStyle = GM_addStyle;
        }
}