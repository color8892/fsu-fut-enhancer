import { AppContext } from "../core/AppContext.js";
import { LOCALIZATION_STRINGS } from "../data/localization.js";
import { createLocalization } from "../domain/Localization.js";
import { registerSettingsScreen } from "../ui/SettingsScreen.js";
import { PatchRegistry } from "../core/PatchRegistry.js";
import { installSbcSubmitPatch } from "../patches/sbc-submit.js";
import { installUnassignedPatches } from "../patches/unassigned.js";
import { installPlayerCardPatches } from "../patches/player-cards.js";
import { registerFastSbcEvents } from "../patches/sbc-fast.js";
import { FastSbcService } from "../domain/FastSbcService.js";
import { SbcPlayerMatchService } from "../domain/SbcPlayerMatchService.js";
import { OneFillCriteriaService } from "../domain/OneFillCriteriaService.js";
import { SbcSquadFillService } from "../domain/SbcSquadFillService.js";
import { SbcTemplateService } from "../domain/SbcTemplateService.js";
import { SbcSquadSaveService } from "../domain/SbcSquadSaveService.js";
import { installSbcChallengesPatch } from "../patches/sbc-challenges.js";
import { registerSbcSubstitutionEvents, renderSbcSubstitutionPanel } from "../patches/sbc-substitution.js";
import { registerEarlyModules, registerLateModules } from "../core/ModuleRegistry.js";
import { installMarketPatches } from "../patches/market.js";
import { installStorePatches } from "../patches/store.js";
import { installSbcHubPatches, registerSbcInfoFillEvent } from "../patches/sbc-hub.js";
import { installAcademyHubPatches } from "../patches/academy-hub.js";
import { installObjectivesHubPatches } from "../patches/objectives-hub.js";
import { installHomeHubPatches, registerHomeHubEvents } from "../patches/home-hub.js";
import { installRewardPatches } from "../patches/rewards.js";
import { installAcademyDetailsPatches } from "../patches/academy-details.js";
import { installNavigationPatches } from "../patches/navigation.js";
import { installSquadBuilderPatches } from "../patches/squad-builder.js";
import { installClubHubPatches } from "../patches/club-hub.js";
import {
  registerSbcSubPriceEvent,
  installSbcSquadSubmitPatches,
  installSbcRequirementsPatch
} from "../patches/sbc-squad.js";
import {
  registerSbcIgnoreTextEvent,
  installSbcSquadOverviewPatches,
  installSbcSquadDetailPanelPatches
} from "../patches/sbc-squad-overview.js";
import { registerAppInitEvents, installAppInitPatches } from "../patches/app-init.js";
import { installLoginPatches } from "../patches/login.js";
import { installPicksRewardsPatches } from "../patches/picks-rewards.js";
import { installSquadOverviewViewPatches } from "../patches/squad-overview-view.js";
import { installSectionedListPatches } from "../patches/sectioned-list.js";
import { registerBuildIgnoreEvents } from "../patches/build-ignore.js";
import { registerPlayerListEvents, installPlayerListPatches } from "../patches/player-list.js";
import { registerSbcNavEvents } from "../patches/sbc-nav-events.js";
import { installPlayerBioPatches } from "../patches/player-bio.js";
import { installPanelPatches } from "../patches/panel-patches.js";
import { installSearchPatches, registerSearchEvents } from "../patches/search-events.js";
import { registerSbcFillEvents } from "../patches/sbc-fill-events.js";
import { registerSbcTileEvents } from "../patches/sbc-tile-events.js";
import { registerSbcRewardEvents } from "../patches/sbc-reward-events.js";
import { installClubSelectPatches } from "../patches/club-select.js";
import { registerListFilterEvents } from "../patches/list-filter-events.js";
import { registerUiUtilsEvents, installUiUtilsPatches } from "../patches/ui-utils.js";
import { installLocalizationPatch, registerPlayerMetaEvents } from "../patches/player-meta.js";
import { registerMiscEvents, installMiscPatches } from "../patches/misc-patches.js";
import { registerLifecycleEvents, installLifecyclePatches } from "../patches/lifecycle-patches.js";

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
                1: ["extendedPlayerInfo.general.overall"], //总评
                2: ["extendedPlayerInfo.tab.traits"], //比赛风格
                3: ["extendedPlayerInfo.positions"], //位置
                4: ["extendedPlayerInfo.tab.roles"], //角色
                5: ["extendedPlayerInfo.saveTechnique.acrobatic", "extendedPlayerInfo.stats.weakfoot"] //花式逆足
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
                    "rgba(255,215,0,0.9)",     // S - 金色
                    "rgba(220,38,38,0.8)",     // A - 红
                    "rgba(251,146,60,0.8)",    // B - 橙
                    "rgba(6,182,212,0.8)",     // C - 青
                    "rgba(34,197,94,0.8)",     // D - 绿
                    "rgba(255,255,255,0.8)"
                ]
            },
            "playerMetaData": {}
        };
        installAppInitPatches({ events, info });
        //获取缓存球员数据
        // events.getItemBy → ModuleRegistry

        //计算球员加速模式
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
        //首页任务奖励显示
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
        //加载loading界面
        events.showLoader = () => {
            document.querySelector(".ut-click-shield").classList.add("showing","fsu-loading");
            document.querySelector(".loaderIcon").style.display = "block";
        };

        //隐藏loading界面
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

        //固话的HTML内容
        html = {
            "priceBtn":"<button class=\"flat pagination fsu-getprice\" id=\"getprice\">{price.btntext}</button>",
            "priceBtn2":"<button class=\"btn-standard section-header-btn mini call-to-action fsu-getprice\" id=\"getprice\">{price.btntext}</button>",
            "sbcInfo":"<div class=\"fsu-sbc-info\"><div class=\"currency-coins\">{sbc.price}{price}</div><div><span>{sbc.like}{up}</span><span>{sbc.dislike}{down}</span></div></div>",
            "consultBtn":"<a href=\"https://www.futbin.com/squad-building-challenges/ALL/{sbcId}\" target=\"_blank\" class=\"fsu-consult fsu-sbcButton\">{sbc.consult}</a>",
            "countBtn":"<a id=\"goToCount\" href=\"javascript:void(0)\" class=\"fsu-count\">{sbc.count}</a>",
            "searchInput":"<input type=\"text\" class=\"fsu-input\" placeholder=\"{text}\" maxlength=\"50\">",
            "uasBtn":"<button class=\"btn-standard section-header-btn mini call-to-action fsu-getprice\" id=\"uasreset\">{uasreset.btntext}</button>",
        };
        info.base.sytle = ".tns-horizontal.tns-subpixel>.tns-item{position: relative;}button.notevents{pointer-events: none;color: #a4a9b4;}.btn-standard.section-header-btn.mini.call-to-action.fsu-getprice{margin-left: 1rem;}.btn-standard.section-header-btn.mini.call-to-action.fsu-getprice:hover{background-color:#e9dfcd}.view-modal-container.form-modal header .fsu-getprice{position: absolute;top: .5rem;left: 0;height: 2rem;line-height: 2rem;}.ut-sbc-set-tile-view.production-tagged .tileHeader::before{display:none;}a.header_explain{color: #a2a2a2;text-decoration: none;line-height: 3rem;}a.header_explain:hover{color: #ffffff;}.ut-fifa-header-view{display: flex;justify-content: space-between;}    .fsu-loading-close{display: none;position: absolute;bottom: 38%;z-index: 999;}.fsu-loading .fsu-loading-close{display: block;text-align: center;}                                                               .fsu-sbc-info div{width: 50%;}.fsu-sbc-info div:last-child{display: flex;justify-content: space-around;}.fsu-sbc-info .currency-coins::after{font-size:16px}                .rewards-footer li{position: relative;}.fsu-sbc-vplayer {position: absolute;bottom: .25rem;right:0;background-color: #8A6E2C;padding: .5rem;color: #15191d;line-height: 1rem;font-size: 16px;}.fsu-sbc-vplayer:hover{background-color: #f6b803;}                 @media screen and (min-width:1280px) and (max-width:1441px) {.ut-split-view {padding:0;}.ut-split-view>.ut-content {max-height:100%;}}                     li.with-icon.hide {display: none;}                      .fsu-input{border: 0 !important;background-color: rgba(0,0,0,0) !important;padding-left: 0 !important;font-family: UltimateTeamCondensed,sans-serif;font-size: 1em;color: #f8eede;}                  .fsu-quick{position:absolute;top:100%;width:100%;display:flex;align-items:center;font-family:UltimateTeam,sans-serif;justify-content:center;margin-top:.2rem}.fsu-quick.top .fsu-quick-list{display:flex;align-items:center}.fsu-quick-list .im{height:1.8rem;line-height:1.8rem;cursor:pointer;background-color:#2b3540;font-family:UltimateTeam,sans-serif;border-radius:4px;padding:0 .2rem;font-size:1rem;font-weight:900;color:#f2f2f2;overflow: hidden;}.fsu-quick-list .im:hover{background-color:#394754}.fsu-quick-list.other .im{background-color:#f8eede;color:#ef6405;font-weight:500;margin-left:.3rem;text-align:center;}.fsu-quick-list.other .im:hover{background-color:#f5efe6}.fsu-quick-list .im span{font-size:.8rem;font-weight:300;color:#a4a9b4}.fsu-quick-list.left .im{margin-right:.3rem}.fsu-quick-list.right .im{margin-left:.3rem}.fsu-quick-inr{font-size:.8rem;margin:0 .3rem}.fsu-quick.right{position:absolute;top:50%;width:2rem;display:block;right:0%;z-index:3;-webkit-transform:translateY(-50%) !important;transform:translateY(-50%) !important}.phone .fsu-quick.right{top:8rem;-webkit-transform:translateY(0%) !important;transform:translateY(0%) !important}.fsu-quick.right .fsu-quick-list .im{width:1.4rem;margin-bottom:.2rem;text-align:center}.fsu-quick.right .fsu-quick-list .im.disabled{background-color:#30302e;color:#656563}.entityContainer>.name.untradeable{color:#f6b803}                                  .phone .fsu-sbc-info{font-size:.875rem}.phone .fsu-task{display:block;font-size:.875rem}.phone .fsu-price-box.right > div .value{font-size:1rem;margin-top:.2rem}.phone .fsu-price-box.right > div .title{font-size:.875rem}.phone .fsu-player-other > div{font-size:0.6rem}.phone .small.player .fsu-cards-price{font-size:.875rem}.phone .small.player .fsu-cards-price::after{font-size:.875rem}.phone .fsu-cards.fsu-cards-attr{font-size:.6rem}.phone .fsu-quick-list .im{font-size:.875rem}                                              .ut-pinned-item .listFUTItem.has-auction-data .fsu-player-other{margin-top:0 !important;top:.8rem;right:.2rem;position:absolute;z-index:2}        .fsu-sbcfilter-box{align-items:center;background-color:#394754;display:flex;justify-content:center;padding:1rem;z-index:10}.fsu-sbcfilter-option{align-items:center;box-sizing:border-box;display:flex;flex:1;max-width:300px}.fsu-sbcfilter-option .ut-drop-down-control{margin-left:1rem;flex:1}                                .fsu-setbox{display: grid;grid-template-columns: repeat(3, minmax(0, 1fr));}.phone .fsu-setbox{display: grid;grid-template-columns: repeat(1, minmax(0, 1fr));}                                  .btn-standard.mini.fsu-reward-but{height:2rem;line-height:2rem;position:absolute;top:.2rem;left:50%;transform:translateX(-50%)}.btn-standard.mini.fsu-reward-but.pcr{bottom:1.9rem;top:auto}           .btn-standard.mini.fsu-pickspc{line-height:2rem;height:2rem;margin:.5rem auto 0 auto}.ut-image-button-control.back-btn.fsu-picksback{height:100%;width:3rem;position:absolute;left:0;font-size:1.6rem}                       .fsu-fcount{position:absolute;right:0.5rem;height:1.4rem;top:.8rem;line-height:1.5rem;padding:0 .4rem;border-radius:.2rem;z-index:1;background-color: #264A35;}        .phone .fsu-store-tile .ut-tile-content-graphic-info .description{display:block;}        .fsu-range button{margin:0}                                                               .fsu-price-box{font-family:UltimateTeamCondensed,sans-serif}.fsu-price-box.right{position:absolute;right:1rem;top:50%;-webkit-transform:translateY(-50%);transform:translateY(-50%);display:flex;align-items:center}.fsu-price-box.right>div{background-color:#3B4754;color: #ffffff;padding:0.5rem;text-align:center;border-radius:4px;margin-top:0;display:block}.fsu-price-box.right>div .title{color:#a4a9b4;padding:0;font-size:1rem;line-height:1rem}.fsu-price-box.right>div .title span.plus{color:#36b84b;font-weight:500;padding-left:.2rem}.fsu-price-box.right>div .title span.minus{color:#d21433;font-weight:500;padding-left:.2rem}.fsu-price-val .currency-coins::after{font-size:1rem;margin-top:-3px}.fsu-price-box.bottom{padding-left:6.3rem;margin:.2rem 0rem}.fsu-price-box.bottom>div{display:flex;align-items:center;font-size:0.9375rem}.fsu-price-box.bottom>div .title{color:#a4a9b4;margin-right:.2rem}.fsu-price-box.bottom .fsu-price-val .currency-coins::after{font-size:inherit}.fsu-price-box.trf{position:absolute;left:54%;margin-top:.2rem}.fsu-price-box.trf .fsu-price-val{display:flex;align-items:center;background-color:#3B4754;color: #ffffff;text-align:center;border-radius:4px;padding:0 .3rem;height:20px}.fsu-price-box.trf .fsu-price-val .title{font-size:.875rem;margin-right:.2rem}.fsu-price-box.trf .fsu-price-val .currency-coins::after{margin-top:-2px}.fsu-price-box.top{position:absolute;right:0%;top:8%;display:flex;align-items:center}.fsu-price-box.top>div{display:flex;align-items:center;background-color:#3B4754;color: #ffffff;padding:.1rem 0.5rem;text-align:center;border-radius:4px}.fsu-price-box.top>div .title{font-size:0.875rem;margin-right:0.5rem}.fsu-price-last{margin-right:.5rem}.fsu-player-other{display:flex;margin-top:.2rem;font-family:UltimateTeamCondensed,sans-serif;font-size:.8rem;line-height:1rem}.fsu-price-box.top+.fsu-player-other{margin-top:.4rem}                                                                    .fsu-cards-lea-small,.fsu-cards-accele-large,.fsu-cards-meta,.fsu-cards-price{position:absolute;z-index:2;font-family:UltimateTeamCondensed,sans-serif;font-weight:300;text-align:center;width:1.6rem;top:25%}.fsu-cards-lea-small{bottom:8%;height:16%;font-size:70%;width:100%;top:auto;font-weight:500;line-height:1}.fsu-cards-lea-small~.playStyle,.ut-squad-pitch-view:not(.sbc) .fsu-cards-lea-small{display:none !important}.specials .fsu-cards-lea-small{bottom:10%}.fsu-cards-accele-large,.fsu-cards-meta,.fsu-cards-price{width:auto !important;padding:0 0.2rem;left:50%;-webkit-transform:translateX(-50%) !important;transform:translateX(-50%) !important;white-space:nowrap;background-color:#13151d;border:1px solid;border-radius:5px}.fsu-cards-accele-large,.fsu-cards-meta{bottom:0;top:auto !important}.fsu-cards-price{color:#fff;top:0 !important}.ut-squad-pitch-view:not(.sbc) .fsu-cards-lea-small~.playStyle{display:block !important}            .fsu-cards-attr,.fsu-cards-pos{position:absolute;z-index:2;font-family:UltimateTeamCondensed,sans-serif;font-weight:300;text-align:center;top:25%;display:flex;flex-direction:column;gap:2px;transform: scale(0.9);}                .large.player~.fsu-cards-attr,.large.player .fsu-cards-attr,.ut-tactics-instruction-menu-view  .fsu-cards-attr{left:calc(50% + 61px);font-size:14px;gap:4px;transform: scale(1);}           .large.player~.fsu-cards-attr > div,.large.player .fsu-cards-attr > div,.large.player~.fsu-cards-pos > div,.large.player .fsu-cards-pos > div{width:28px;height:16px;line-height:17px}       .small.player~.fsu-cards-attr{left:70px;font-size:12px;top:50%;transform:translateY(-50%) scale(0.9);}.small.player~.fsu-cards-attr > .fsu-bodytype{font-size:11px}                         .reward.small .small.player~.fsu-cards-attr{left:calc(50% + 42px);top:20%}.reward.small .small.player~.fsu-cards-pos{left:calc(50% - 66px);top:20%;font-size:12px}             .ut-squad-slot-view .small.player~.fsu-cards-attr{left:auto;right:-4px}              .large.player~.fsu-cards-pos,.large.player .fsu-cards-pos,.ut-tactics-instruction-menu-view  .fsu-cards-pos{left:calc(50% - 90px);font-size:14px;gap:4px;transform: scale(1);}                  .ut-squad-slot-view .small.player~.fsu-cards-pos{flex-direction:row;font-size:12px;top:auto;bottom:-1.6rem;left:50%;transform:translate(-50%,0)}                   .ut-squad-slot-dock-view .ut-squad-slot-view .small.player~.fsu-cards-pos{bottom:-.6rem}.ut-store-xray-pack-details-view .large.player~.fsu-cards-attr{left:calc(50% + 42px)}.large.player .fsu-cards-attr{right:0;left:auto;}.large.player .fsu-cards-pos{right:auto;left:0;}       .fsu-akb .ut-toggle-cell-view>.ut-toggle-control .ut-toggle-control--grip,.fsu-akb-title .ut-toggle-cell-view>.ut-toggle-control .ut-toggle-control--grip{font-family:UltimateTeam-Icons,sans-serif;font-style:normal;font-variant:normal;font-weight:400;text-transform:none;flex-shrink:0;font-size:1em;text-decoration:none;text-align:center;line-height:1.5rem;transition:color .3s,bottom .3s,top .3s}.fsu-akb .ut-toggle-cell-view>.ut-toggle-control .ut-toggle-control--grip::before,.fsu-akb-title .ut-toggle-cell-view>.ut-toggle-control .ut-toggle-control--grip::before{content:'\\E051';color:#3a4755}.fsu-akb .ut-toggle-cell-view>.ut-toggle-control.toggled:not(.disabled) .ut-toggle-control--grip::before,.fsu-akb-title .ut-toggle-cell-view>.ut-toggle-control.toggled:not(.disabled) .ut-toggle-control--grip::before{content:'\\E02F';color:#36b94b}.fsu-akb .ut-toggle-cell-view>.ut-toggle-control.toggled:not(.disabled) .ut-toggle-control--track,.fsu-akb-title .ut-toggle-cell-view>.ut-toggle-control.toggled:not(.disabled) .ut-toggle-control--track{background-color:#36b94b}.fsu-akb .ut-toggle-cell-view>.ut-toggle-cell-view--label{display:none}.fsu-akb .ut-toggle-cell-view{position:absolute;z-index:10;transform:scale(0.7);padding:0 1rem 1rem 0;cursor:pointer}.fsu-akb-title{align-items:center;background-color:#2b3540;display:flex;justify-content:space-between;padding:.75rem .5rem;border-top:solid 1px #556c95}.fsu-akb-left{display:flex;align-items:center}.fsu-akb-title .ut-toggle-cell-view>.ut-toggle-control .ut-toggle-control--grip{transition:color .3s,left .3s,right .3s}.fsu-akb-left>div{padding:0 .675rem 0 0}.fsu-akb-left>div:last-child{padding-right:0}                  body.landscape.futweb{min-height: 38rem;}                                                         html[dir=ltr] .listFUTItem .entityContainer>.name.fsulocked.locked,html[dir=ltr] .listFUTItem .entityContainer>.name.fsulocked.untradeable{padding-right:2.7em}html[dir=ltr] .listFUTItem .entityContainer>.name.fsulocked.locked::before,html[dir=ltr] .listFUTItem .entityContainer>.name.fsulocked.untradeable::before{right:1.4em}                                    .filter-btn.fsu-eligibilitysearch{height:1.8rem;width:1.8rem;position:absolute;right:0}.ut-image-button-control.filter-btn.fsu-eligibilitysearch::after{font-size:1rem;content:'\\E09D'}                  .item.player>.fsu-cards-rating{position:absolute;left:50%;top:50%;font-size:5rem;transform:translate(-50%,-50%)}.large.item.player>.fsu-cards-rating{font-size:7rem}.item.player.ut-item-loading>.fsu-cards-rating{opacity:1}.item.player.ut-item-loaded>.fsu-cards-rating{opacity:0}                        .fsu-chemistryfilter{position:absolute;right:.5rem;top:.5rem;}                          .ut-list-active-tag-view .label-container.fsu-inclubtag{background-color:#0b96ff}.ut-list-active-tag-view .label-container.fsu-inclubtag::after{border-color:#0b96ff}                                           .fsu-optionbest{position:relative}.fsu-optionbest > span,.fsu-optionbest > .player-pick-option,.fsu-optionbest > .fsu-pickspc{position:relative;z-index:1}.fsu-optionbest >.no-favorites-tile{position:absolute;max-width:100%;height:120%;width:100%;margin:-15% 0 0 0;z-index:0;top:0px;right:0px;padding:0;background-image: url(https://www.ea.com/ea-sports-fc/ultimate-team/web-app/content/25E4CDAE-799B-45BE-B257-667FDCDE8044/2025/fut/dynamicObjectives/groups/f4c231d9-a38c-44a4-a932-87af2136cca5/group_background.png);}.fsu-optionbest > .no-favorites-tile::before{font-size:2.2rem;height:2.2rem;width:2.2rem;line-height:2.2rem;}.fsu-optionbest > .player-pick-option.selected ~ .no-favorites-tile::before{display:none}                      .fsu-navsbc{height:80%;justify-content:flex-end;margin-right:1rem;flex: 0 0 auto;}.fsu-navsbc button{margin:-0.25rem;width:60px;}.phone .fsu-navsbc{margin-right:.25rem}.phone .fsu-navsbc button{margin:-.1rem}    .fsu-shownavsbc .ut-navigation-button-control{width:3rem}.fsu-shownavsbc .title{flex:1 0;position:relative !important;width:auto !important;text-align:left !important;padding:0 0 0 0.5rem !important}.fsu-shownavsbc .fsu-navsbc{height:3rem}.fsu-shownavsbc .ut-iteminfochange-button-control{display:none}.fsu-shownavsbc .fsu-navsbc button{width:2.6rem}        .phone .fsu-optionbest > .no-favorites-tile{height:108%;margin:-4% 0 0 0;border-radius:10px}.phone .fsu-optionbest > .no-favorites-tile::before{font-size:1rem;height:1rem;width:1rem;line-height:1rem;margin:.25rem}                .fsu-cards-attr div.fsu-academytips{display:flex;align-content:center;justify-content:center;background:linear-gradient(to bottom,#00A7CC 0,#007D99 100%);color:#0f1010;box-shadow:0 1px 1px 0 rgba(0,0,0,.5);border:none}.fsu-academytips-icon{height:0;width:10px;margin-left:-2px;}                              .fsu-academytips-icon::before,.ut-store-pack-details-view--description.fsu-packprice:before,.fsu-cards-price.fsu-unassigned:before{font-family:UltimateTeam-Icons,sans-serif;font-style:normal;font-variant:normal;font-weight:400;text-decoration:none;text-transform:none}.fsu-academytips-icon::before{content:'\\E001'}.ut-store-pack-details-view--description.fsu-packprice:before{color:#f7b702;display:inline-block;content:'\\E096';margin-right:.25rem}.fsu-cards-price.fsu-unassigned:before{content:'\\E0C4';display:inline-block;margin-right:.3em;vertical-align:middle;color:#f7b702}                                      .fsu-cards-meta{padding:0;display:flex;font-family:UltimateTeam,sans-serif;font-size:.8rem;height:1rem;align-items:center;z-index:5;cursor:pointer;}.fsu-cards-meta > div{margin-right:.2rem}.fsu-cards-meta > div:first-child{border-radius:4px 0 0 4px;height:1rem;width:1.6rem;font-weight:900;}                                button.currency.call-to-action.fsu-challengefastbtn{height:2.6rem;line-height:1.4rem;padding:0px 1rem;font-size:1rem}button.currency.call-to-action.fsu-challengefastbtn > span{display: block !important;}button.currency.call-to-action.fsu-challengefastbtn .subtext{font-size:80%;line-height:1rem;color:#a6a6a6;}.ut-sbc-challenge-table-row-view .fsu-challengefastbtn{width:70%}@media (min-width:768px){.ut-sbc-challenge-table-row-view .fsu-challengefastbtn{width:60%}}.ut-sbc-challenge-table-row-view.selected button.currency.call-to-action.fsu-challengefastbtn{background-color:#222426;color:#fcfcf7}.ut-sbc-challenge-table-row-view.selected button.currency.call-to-action.fsu-challengefastbtn.hover{background-color:#575753}.ut-sbc-challenge-table-row-view button.currency.call-to-action.fsu-challengefastbtn.disabled{background-color:#575753;color:#30312f}                                     .fsu-navsbccount{padding:.2em 0;margin-right:.5rem;align-items:center;display:flex;justify-content:flex-end}.fsu-navsbccount::after{background-position:right top;content:'';background-repeat:no-repeat;background-size:100%;display:inline-block;height:1em;vertical-align:middle;width:1em;background-image:url(https://www.ea.com/ea-sports-fc/ultimate-team/web-app/images/sbc/logo_SBC_home_tile.png);margin-top:-.15em;margin-left:.3em}                                .ut-image-button-control.filter-btn.fsu-transfer::after{content:'\\E0E5';font-size:1.6rem}.ut-image-button-control.filter-btn.fsu-club::after{content:'\\E052';font-size:1.6rem}.ut-image-button-control.filter-btn.fsu-swap::after{content:'\\E0E4';font-size:1.4rem}.ut-image-button-control.filter-btn.fsu-refresh::after{content:'\\E0C4';font-size:1.4rem}.ut-image-button-control.filter-btn.fsu-storage::after{content:'\\E0C9';font-size:1.4rem}.filter-btn.fsu-swap,.filter-btn.fsu-transfer,.filter-btn.fsu-club,.filter-btn.fsu-storage,.filter-btn.fsu-refresh{margin-left:1rem;width:3rem;height:3rem}                                            .ut-club-hub-view .tile.fsu-storage .tileContent:before { content:'\\E0C9'; }                          .ut-list-active-tag-view .label-container.fsu-instoragetag,.listFUTItem.hover .ut-list-active-tag-view .label-container.fsu-instoragetag{background-color:#f19be6}.ut-list-active-tag-view .label-container.fsu-instoragetag::after,.listFUTItem.hover .ut-list-active-tag-view .label-container.fsu-instoragetag::after{border-top-color:#f19be6}                                                                                                                                      .ut-player-picks-view .carousel-indicator-dots.fsu-pickbest li{width:16px;height:16px;text-align:center;overflow:hidden}.ut-player-picks-view .carousel-indicator-dots.fsu-pickbest li.active{transform:scale(1.4)}.ut-player-picks-view .carousel-indicator-dots.fsu-pickbest li.best::after{content:'\\E0D4';font-family:UltimateTeam-Icons,sans-serif;font-style:normal;font-variant:normal;font-weight:400;text-decoration:none;text-transform:none;color:#07f468;font-size:1rem;line-height:1.1rem}.ut-player-picks-view .carousel-indicator-dots.fsu-pickbest li.best.active::after{color:#fd4821}                                     .ut-button-group button.more.fsu-open::after{-webkit-transform:rotate(0deg) !important;transform:rotate(0deg) !important}                                                                .fsu-sbcNeedsBody,.fsu-realProdBody{height:30vh;overflow-y:auto}.fsu-sbcNeedsTitle,.fsu-sbcNeedsBodyItem,.fsu-realProdTitle,.fsu-realProdBodyItem{display:flex}.fsu-sbcNeedsTitle,.fsu-realProdTitle{padding:.5rem 1rem;background-color:#30312f;font-size:1rem}.fsu-sbcNeedsBodyItem,.fsu-realProdBodyItem{padding:.75rem 1rem;align-items:center;background-color:#18191b;font-size:1em}.fsu-sbcNeedsBodyItem:nth-of-type(even),.fsu-realProdBodyItem:nth-of-type(even){background-color:#212224}.fsu-sbcNeedsTitle div,.fsu-sbcNeedsBodyItem div{width:18%}.fsu-realProdTitle div,.fsu-realProdBodyItem div{width:20%}.fsu-sbcNeedsTitle div:last-child,.fsu-sbcNeedsBodyItem div:last-child{width:28%;text-align:right}.fsu-realProdTitle div:first-child,.fsu-realProdBodyItem div:first-child{width:40%}                                    .fsu-price-reward::after{font-family:UltimateTeam-Icons,sans-serif;content:'\\E0C9';font-size:94%;color:#fae8e6}.small.player .fsu-price-box{font-size:90%}.large.player .fsu-price-box{font-size:1rem}.small.player .fsu-price-box,.large.player .fsu-price-box{display:flex;justify-content:center;align-items:center}.fsu-price-box.old{background-color:#0f1417;color:#a4a9b4;border:0}.fsu-price-val[data-value='0'][data-type='1']{display:none !important}.fsu-cards-price::after{margin-left:.2em !important;margin-top:0}.large.player .fsu-cards-price.currency-coins::after{margin-top:-.15em}.fsu-price-box.right>div .value{font-size:1.2rem;margin-top:.5rem;line-height:1.2rem;display:flex;justify-content:center;align-items:center}.fsu-price-val .fsu-price-reward::after{margin-left:.3em;font-size:80%;margin-top:-.15em}                              .fsu-cards-foot{position:relative}.fsu-cards-foot::after{content:'';height:3px;width:3px;background-color:var(--fsu-cards-foot-color);display:block;position:absolute;bottom:0px;border-radius:2px}.fsu-cards-foot.l::after{left:0px}.fsu-cards-foot.r::after{right:0px}                    .fsu-cards-attr div,.fsu-cards-pos div{border:1px solid;border-color:inherit;line-height:100%;border-radius:5px;color:var(--fsu-cards-color);background:var(--fsu-cards-background);width:22px;white-space:nowrap;height: 13px;line-height: 15px;}                        .fsu-lockbtn{padding:0 8px !important;min-height:30px !important;position:absolute;right:64px;bottom:0;font-size:0.75rem !important;z-index:2;display:flex;align-items:center}.fsu-lockbtn.lock::before{content:'\\E09C'}.fsu-lockbtn.unlock::before{content:'\\E09C'}.fsu-lockbtn::before{font-family:UltimateTeam-Icons,sans-serif;padding-right:.2rem;content:'';display:block}.fsu-lockbtn.unlock{background-color:#fcfcf7;color:#151616}.fsu-lockbtn.unlock::after{content:'';display:block;position:absolute;left:18px;top:10px;width:2px;height:16px;background:#ff4c4c;transform:rotate(45deg);transform-origin:top center}.ut-club-hub-view .tile.fsu-lock .tileContent:before { content:'\\E09C'; }html[dir=ltr] .listFUTItem .entityContainer>.name.fsulocked::after{font-family:UltimateTeam-Icons,sans-serif;color:#d31332;margin-top:2px;position:absolute;width:1.1em;content:'\\E09C';right:0}html[dir=ltr] .listFUTItem .entityContainer>.name.fsulocked{padding-right:1.4em}html[dir=ltr] :not(.phone) .listFUTItem .entityContainer>.name.fsulocked.untradeable { max-width: 42%; }.fsu-cardlock{position:absolute;height:.9rem;width:.9rem;right:0;bottom:5%;z-index:2;background-color:#222426;border:1px solid #333d47;border-radius:100%;text-align:center;box-shadow:0 1px 3px #000;font-size:10.8px}.fsu-cardlock::before{font-family:UltimateTeam-Icons,sans-serif;content:'\\E09C';display:inline-block;vertical-align:middle;background-size:100% auto;color:#d31332;background-repeat:no-repeat}                                  .listfilter-btn{padding:0;width:100%;height:1.6rem;line-height:1.8rem;border-radius:.4rem;font-size:.9rem;min-height:1.6rem}                                      .ut-squad-building-set-status-label-view.refresh.sbccount{display:flex;align-items:center;gap:4px;opacity:0.5}.ut-squad-building-set-status-label-view.refresh.sbccount::before{content:'\\E0C2';color:#36b84b;font-size:14px;line-height:17px}                                                           .fsu-trypack-box{position:absolute;right:0}.landscape button.currency.fsu-trypack{padding:.25rem .5rem;width:auto;color:#f2f2f2;background:#556c95;border-radius:.6rem;align-items:center;display:flex;font-family:UltimateTeam-Icons,sans-serif;min-height:36px}.landscape button.currency.fsu-trypack .text{font-size:1rem;font-weight:600}.landscape button.currency.fsu-trypack::after{content:'\\E0A2';font-size:110%;padding-left:.2rem}.landscape button.currency.fsu-trypack.hover{background:#9e9e99}.phone .fsu-trypack-box{position:relative;}                                .fsu-player-other>div{background:#3B4754;color:#a4a9b4;padding:0.1rem 0.3rem;text-align:center;border-radius:20px;font-size:inherit;line-height:1.5;margin-right:0.5rem;height:1rem;white-space:nowrap}.fsu-player-other>div.swap{background:#36b84b;color:#201e20}.fsu-player-other>div.not{background:#8A6E2C;color:#201e20}.fsu-player-other>div.storage{background:#f6b803;color:#201e20}.fsu-player-other>div.yes{background:#264A35;color:#201e20}.large.player+.fsu-player-other{justify-content:center}.large.player+.fsu-player-other>div{margin-right:0rem}.fsu-player-other .currency-coins::after{font-size:.875rem;margin-top:-3px;margin-left:2px !important}@media (max-width:1130px){.has-auction-data .fsu-player-other{margin-top:5rem !important}.has-auction-data .fsu-price-box.trf{margin-top:5rem !important;left:auto;right:3%}}                                                                                     /*商店数量标识*/.ut-store-hub-view .storehub-tile.packs-tile.highlight[data-num]::after{content:attr(data-num);top:22px;padding:2px 6px;border-radius:4px;line-height:1.2rem;font-size:1.2rem;color:#0c0d0d;height:16px;width:auto}@media (min-width:768px){.ut-store-hub-view .storehub-tile.packs-tile.highlight[data-num]::after{height:20px;font-size:1.4rem;line-height:1.4rem;top:26px;padding:2px 8px}}                         /*旧卡样式去除边框*/.fsu-cards.old div{border:none}                                 /*阵容价值部分*/.fsu-squad-pValue{font-family:UltimateTeamCondensed,sans-serif;font-weight:400;font-size:.875rem;text-overflow:ellipsis;white-space:nowrap}.fsu-squad-pValue.currency-coins::after{font-size:.875rem;margin-left:.2em !important;margin-top:-.2em !important}.fsu-squad-pTitle .plus{color:#36b84b;padding-left:.1rem}.fsu-squad-pTitle .minus{color:#d21433;padding-left:.1rem}                                    /*弹窗球员列表显示优化*/.fsu-popupItemList{display:flex;flex-direction:column;gap:12px}.fsu-popupItemList > .listFUTItem{margin:0 !important}                                           /*改变为公共新标识*/.fsu-newtips{background-color: #ee2208;z-index:2;position:absolute;left:0;top:20px;transform:rotate(-45deg);transform-origin:0 100%;height:36px;line-height:42px;width:80px;text-align:center;font-weight:bold}            /*调整配色*/.fsu-task{display: flex;justify-content: space-between;padding: 0.5rem;background-color: #ee2208;}.fsu-task.no{background-color: #b1570c;}.task-expire{background-color: #b1570c;height: 2rem;line-height: 2rem;text-align: center;}.fsu-sbc-info{padding: 0.5rem;background-color: #2f4a5b;display: flex;font-family: UltimateTeamCondensed,sans-serif;justify-content: space-between;font-size: 1rem;}                        /*导航栏计数标识*/.fsu-tab-count{font-size:14px;align-self:center;padding:4px 6px;background-color: #575753;color:#a6a6a1;line-height:1;border-radius:4px;margin-left:6px}.selected > .fsu-tab-count{background-color: #ee2208;color:#fcfcfc}.selected > .fsu-tab-count.expire{background-color: #aa540c}.phone .fsu-tab-count{padding:2px 3px;font-size:12px;border-radius:3px}                           /*挑选包预览*/.fsu-popupItemList .listFUTItem .entityContainer>.name{padding-top:10px;padding-bottom:0px}html[dir=ltr] .fsu-popupItemList .listFUTItem .entityContainer .item{margin-right:14px}.fsu-popupItemOther{font-size:26px;display:flex;color:#ffffff;width:100%;justify-content:space-between;align-items:center;padding:8px;background-color:#2f4a5b;box-sizing:border-box;gap:12px}.fsu-popupItemOther .btn-standard{width:auto;flex:0;min-width:120px;margin-bottom:0}.fsu-popupItemTrait{display:flex;gap:8px}.phone .fsu-popupItemOther{flex-direction:column}.phone .fsu-popupItemOther .btn-standard{width:100%}.fsu-traitIcon.fut_icon.icon{color:#ffc91f}.fsu-traitIcon.fut_icon.icon_basetrait16{position:relative}.fsu-traitIcon.fut_icon.icon_basetrait16:before{content:'\\E074';z-index:1;position:relative;top:2px;background:#2f4a5b;clip-path:inset(5px 5px 10px 5px)}.fsu-traitIcon.fut_icon.icon_basetrait16::after{content:'\\E031';position:absolute;left:0;z-index:0}.fsu-popupItemList .listFUTItem .rowContent{border-radius:10px}                              /*卡片状态标识配色*/.fsu-cards-buyerror,.fsu-cards-storage,.fsu-cards-unassigned{left:auto !important;right:1% !important;background-color:#5b167d !important;border-color:#7c319e !important;color:#fae8e6 !important}.fsu-cards-buyerror{background-color:#d31332 !important;border-color:#d6675d !important;color:#fae8e6 !important}.fsu-cards-unassigned{background-color:#d19a01 !important;border-color:#DEBA43 !important;color:#FCFBF0 !important}                                             /*未分配快速任务标签*/.fsu-unassigned-fastsbcbox{display:flex;padding:6px 16px;gap:12px;overflow-x:auto}.fsu-unassigned-fastsbcbox .btn-standard{overflow:visible;position:relative;padding:3px 6px;border-radius:6px}.fsu-unassigned-fastsbcinfo{display:flex;align-items:flex-start;justify-content:center;flex-direction:column;max-width:10rem;overflow:hidden}.fsu-unassigned-fastsbcdot{position:absolute;top:-6px;right:-6px;background:#0ff;height:14px;width:14px;line-height:14px}.fsu-unassigned-fastsbctext{line-height:20px;max-width:10rem;font-size:14px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}.fsu-unassigned-fastsbctsub{line-height:12px;max-width:10rem;font-size:12px;color:rgb(166,166,166)}.fsu-unassigned-fastsbctsub span{margin:0px 2px}                                                                   /*可开球员tile和特殊品质tile*/.fsu-showPlayerstile header p{padding-top:4px;color:#a6a6a1}.fsu-showPlayerstile .img-box{text-align:center;height:160px}.fsu-showPlayerstile .img-box img{height:auto;width:80%}.fsu-showPlayerstile.fsu-specialTile .img-box img{height:80%;width:auto}.fsu-showPlayerstile.fsu-specialTile .img-box img:first-child{height:70%}.fsu-showPlayerstile.fsu-specialTile .img-box img:last-child{height:70%}.fsu-showPlayerstile .ut-label-view{margin-top:-32px}                               /*包内球员*/.fsu-showPlayers{}.fsu-showPlayersList{grid-template-columns:repeat(auto-fill,300px);display:grid;justify-content:center;gap:30px;padding:48px}.fsu-showPlayersItem{background-color:#2d2c36;border-radius:16px;color:#fcfcfc;padding:16px 16px 48px 16px;overflow:clip;position:relative}.phone .fsu-showPlayersList{padding:8px;gap:8px;grid-template-columns:1fr 1fr}.phone .fsu-showPlayersItem{zoom:0.6}.fsu-showPlayersTrais{display:flex;gap:8px;justify-content:center;font-size:24px;margin:8px 0;padding:8px 0;opacity:0.6;flex-wrap: wrap;}.fsu-showPlayersCard{display:grid;justify-content:center}.fsu-showPlayersBtn{width:100%;margin:0 -16px;border-radius:0;border:none;line-height:32px;position:absolute;bottom:0}.fsu-showPlayersLabel{position:absolute;left:0;top:0;line-height:32px;font-size:14px;color:#0f0f0f;background-color:#0b96ff;padding:0 20px;border-radius:0 0 16px 0}                               /*移除部分界面name的内间距*/.fsu-removeNamePadding ~ div.name{padding-top:14px !important;padding-bottom:0px !important}                                            /*卡组展示*/.fsu-showPlayersItem.fsu-showRarity{display:flex;flex-direction:column;font-size:14px;line-height:14px}.fsu-showRarityCard{display:grid;text-align:center;position:relative;margin-top:-16px}.fsu-showRarityCard img{height:200px;margin:auto}.fsu-showRarityCount{position:absolute;top:138px;width:100%;line-height:32px;font-size:32px;font-family:UltimateTeamCondensed,sans-serif;font-weight:bold}.fsu-showRarityBtns{display:flex;position:absolute;bottom:0;width:100%;margin:0 -16px;gap:1px;background-color:rgba(222,222,216,.25)}.fsu-showRarityBtns > button{flex:1;border:0;border-radius:0;line-height:32px}.fsu-showRarityBtns > button.btn-standard.disabled{background-color:#6a6a65}.fsu-showRarityTips{padding:0 16px;background-color:#0b96ff;color:#0f0f0f;height:32px;line-height:32px;position:absolute;top:0;left:0;border-bottom-right-radius:19px}.fsu-showRarityInfo{padding:16px 0;display:flex;flex-direction:column;gap:4px;font-size:12px;line-height:12px}.fsu-showRarityAttrs,.fsu-showRarityExpiry{display:flex;align-items:center;gap:8px;justify-content:center;flex-wrap:wrap}.fsu-showRarityExpiry{gap:6px}.fsu-showRarityExpiry i{color:#f7b702}.fsu-showRarityAttrs div{padding:4px 8px;background-color:rgba(7,244,104,.4);border-radius:20px}                          /*新SBC右侧快捷列表*/.fsu-substitutionBox{margin:0 16px;padding:12px;display:flex;flex-direction:column;gap:6px}.fsu-substitutionTitle{font-size:12px;line-height:14px}.fsu-substitutionBtns{background:#6a696d;display:flex;justify-content:space-around;font-size:14px;line-height:14px;gap:1px;border-radius:12px;overflow:clip;align-items:center}.fsu-substitutionBtns > button{flex:1;text-align:center;padding:12px 0;background:#504f52;font-size:inherit;line-height:inherit;border-radius:0;border:0;min-height:auto;}.fsu-substitutionTitle:not(:first-of-type) {margin-top: 12px;}                                                    /*新排序筛选*/.fsu-SortFilterBox{display:flex;gap:8px;margin:0px 16px 8px 16px}.fsu-SortFilterItem{flex:1;min-width:0}.fsu-SortFilterTitle{font-size:12px;line-height:14px;margin-bottom:4px;color:#a6a6a1}.fsu-SortFilterBtn{border:none;border-radius:8px;width:100%;min-height:auto;font-size:14px;background:#504f52;padding:8px 0px;white-space:nowrap;line-height:14px;overflow:hidden}.fsu-SortFilterBtn.priority{background: #786735;}                                   /*新阵容价值*/.fsu-SquadValue{position:absolute;right:20px;top:20px;font-family:UltimateTeamCondensed,sans-serif;font-weight:400}.fsu-SquadValueItem{background:#4e4f4dcc;font-size:17px;line-height:18px;padding:8px 10px 6px 10px;border-radius:4px;display:flex;align-items:center;gap:8px;color:#fcfcfc;justify-content:space-between;margin-bottom:10px}.fsu-SquadValueTitle{font-size:14px}.fsu-SquadValuePrice{}.phone .fsu-SquadValue{right:auto;left:14px;top:auto;bottom:62px;text-shadow:2px 2px 3px rgba(0,0,0,.5)}.phone .fsu-SquadValueItem{font-size:15px;line-height:16px;padding:0px;margin-bottom:0px;background:none;margin-top:8px}.phone .fsu-SquadValueTitle{font-size:13px}                               /*新价格显示框*/.fsu-PriceBar{position:absolute;transform:translateX(-50%) scale(0.9) !important;left:50%;z-index:2;font-family:UltimateTeamCondensed,sans-serif;display:flex;gap:8px}.fsu-PriceBarItem{display:flex;align-items:stretch;justify-content:center;background-color:#13151d;border:1px solid #3f444b;font-size:15px;border-radius:4px;overflow:hidden;height:17px;box-shadow:0px 1px 3px rgb(63 68 75 / 40%)}.fsu-PriceBarItem .fsu-PriceValue{display:flex;align-items:center;padding:3px 4px 0px 4px;color:#f7b702}.fsu-PriceBarItem .fsu-PriceType{display:flex;align-items:center;padding:2px 3px 0 1.6px;background-color:#2b3036;color:#a0a0a0;font-size:11px;font-weight:700;font-style:italic;letter-spacing:.4px;text-transform:uppercase}.large.player .fsu-PriceBar{transform:translateX(-50%) scale(1.2) !important;top:4px}.fsu-PriceRightBox{position:absolute;right:16px;z-index:2;transform:translateY(-50%) !important;top:50%;display:flex;gap:16px;font-family:UltimateTeamCondensed,sans-serif}.fsu-PriceRightItem{background-color:#3b4754;border-radius:8px;padding:8px 6px;color:#a4a9b4;display:flex;flex-direction:column;gap:8px;align-items:center}.fsu-PriceRightBox.top{top:16px}.fsu-PriceRightBox.top .fsu-PriceRightItem{flex-direction:row;padding:4px 6px 2px}.fsu-PriceRightBoxTitle{font-size:14px;text-align:center;line-height:14px}.fsu-PriceRightBoxBar{display:flex;justify-content:center;align-items:center}.fsu-PriceRightItem .fsu-PriceValue{font-size:22px;line-height:18px;color:#f7b702}.fsu-PriceRightItem .fsu-PriceType{text-transform:uppercase;font-size:14px;font-weight:500;padding:3px 4px 2.2px 1.6px;background-color:#2b3036;color:#a0a0a0;font-style:italic;margin-left:4px;border-radius:4px;margin-top:-3px}.fsu-PriceBarItem[data-show='0'],.fsu-PriceRightItem[data-show='0']{display:none !important}.fsu-PriceBarItem.tradable .fsu-PriceValue,.fsu-PriceRightItem.tradable .fsu-PriceValue{color:#fcfcfc}.fsu-PriceType[data-content='ut']{font-size:0}.fsu-PriceType[data-content='ut']::after{background-position:right top;content:'';background-repeat:no-repeat;background-size:100%;display:inline-block;height:12px;vertical-align:middle;width:12px;background-image:url(../web-app/images/coinIcon.png);margin-top:-2px;margin-right:-1px}.fsu-PriceBarItem.precious .fsu-PriceType{background-color:#fd7254}.fsu-PriceBarItem.precious{background:#ee2208;border-color:#fd7254}.fsu-PriceRightBoxBar .fsu-PriceType[data-content='ut']{height:16px;width:16px}.fsu-PriceRightBoxBar .fsu-PriceType[data-content='ut']::after{margin-top:0.5px;margin-right:0px;margin-left:2px;height:14px;width:14px}                                /*进化增加属性展示*/.fsu-academyAttribute{font-family:UltimateTeam-Icons,sans-serif;font-size:14px;line-height:16px;color:#80807a}.fsu-academyAttributeIncrease{padding-left:8px;padding-right:4px}.fsu-academyAttributeIncrease span{color:#07f468}.fsu-academyAttributeValue{font-weight:bold;font-size:16px}.fsu-academyAttributeValue.added{color:#0b96ff}.fsu-academyAttributeValue.addedMain{color:#fd4821}                                    /*进化属性显示*/.academieBtn{background:#2d2c36;border-radius:8px;padding:8px 12px 6px 12px;cursor:pointer;margin-bottom:8px;font-family:UltimateTeamCondensed,sans-serif;border:1px solid #2d2c36}.academieBtn.not{opacity:0.5}.academieBtn:hover{border-color:#1fc3c1}.academieBtnTitle{display:flex;align-items:center;justify-content:space-between;line-height:14px;margin-bottom:6px}.academieBtnName{color:#b5b9c3;font-size:14px}.academieBtnTime{font-size:12px;color:#9e9e9a}.academyBoostsBox{display:flex;gap:4px;font-size:12px;line-height:11px;text-transform:uppercase;flex-wrap:wrap;flex-direction:row}.academyBoostsItem{padding:4px 4px 1px 4px;border-radius:4px;font-weight:500;background:#3a4652;color:#d4d8de}.academyBoostsItem span{color:#07f468;font-size:16px;padding-left:2px;font-weight:100}.academyBoostsTips{flex:100%;padding-top:6px;color:#9e9e9a}.academyBtnTips{color:#fd7254;padding:8px 4px;font-size:14px;text-align:center}.academyViewBox{background:#191820;border-radius:8px;padding:8px 12px 6px 12px;margin-bottom:8px;font-family:UltimateTeamCondensed,sans-serif}.academyViewBox .academyBoostsBox{gap:8px;justify-content:center}.academyViewBox .academyBoostsTips{text-align:center}.academyViewBox.itemList{padding:24px 8px 8px;margin:-32px 16px 16px}.academyViewBox.itemList .academyBoostsBox{gap:4px}.academyViewBox.itemList .academyBoostsBox > *{zoom:0.8}                                    /*进化需求按钮*/.fsu-substitutionBtns>button.fsu-substitutionReqBtn{display:flex;align-items:center;justify-content:center;gap:4px;position:relative;height:36px}.fsu-substitutionReqBtn>img{height:24px;width:auto}.fsu-substitutionReqBtn>img.small{height:20px;width:20px}.fsu-substitutionReqBtn>div{position:absolute;right:0;bottom:0;padding:3px 4px 0px;background:rgb(253 114 84 / 70%);font-size:14px;line-height:12px;border-top-left-radius:4px}.fsu-substitutionReqBtn.state-meet>div{background:rgb(38 133 53 / 70%)} */                                                     /*CSS*/"


        priceService.setErrorHandler((error) => {
            events.notice(fy("notice.loaderror") + error, 2);
            events.hideLoader();
        });

        events.getFutbinUrl = (url) => priceService.getFutbinUrl(url);
        events.getPriceForUrl = (definitionIds) => priceService.getPriceForUrl(definitionIds);
        events.getPriceForFubin = (playerResourceId) => priceService.getPriceForFutbin(playerResourceId);
        events.getCachePrice = (definitionId, type) => priceService.getCachePrice(definitionId, type);
        events.priceLastDiff = (purchasePrice, lastPrice) => priceService.priceLastDiff(purchasePrice, lastPrice);

        events.externalRequest = (method, url , body , cType) => {
            return httpClient.request(method, url, body, cType);
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

        installUnassignedPatches({ call, events, fy, cntlr, info, debug });

        Object.assign(events, ctx.createSbcChemistryService(repositories.TeamConfig).createEventsFacade());

        installLoginPatches({ call, events, info, services, debug, GM_getValue, GM_xmlhttpRequest });
        //25.01 捕获转会市场收集到的球员价格 → installMarketPatches

        installNavigationPatches({ call, events, info, isPhone, SBCCount });

        //25.01 战术选择界面显示meta评分
        UTTacticsRoleSelectViewController.prototype.viewDidAppear = function(...args) {
            call.view.tacticsRole.call(this,...args);
            // let pId = this.tacticsViewModel.getSquad().getSlot(this.tacticsViewModel.getSelectedSlotId()).item.definitionId;
            // if(pId && _.has(info.meta,pId)){
            //     let metas = info.meta[pId].text;
            //     if(_.size(metas) > 1){
            //         _.map(this.getView().roleCellViews,i => {
            //             if(_.has(metas,i.id)){
            //                 let z = events.createElementWithConfig("span",{
            //                     textContent:`(${metas[i.id].rank} ${metas[i.id].rating} ${services.Localization.localize("playstyles.playstyle" + metas[i.id].chemstyle)})`,
            //                     style:{
            //                         fontSize:"80%",
            //                         opacity:".8",
            //                         padding:"0 .5rem"
            //                     }
            //                 })
            //                 i.__name.appendChild(z)
            //             }
            //         })
            //     }
            // }
        }


        //navigation → installNavigationPatches
        installSquadBuilderPatches({ call, events, fy, info, build });
        installPlayerCardPatches({ call, events, fy, cntlr, info, lock });

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



        installPicksRewardsPatches({ call, events, info, fy, isPhone, debug });
        installSquadOverviewViewPatches({ call, events, info, fy, cntlr, isPhone, repositories, services, debug, SBCEligibilityKey, GM_openInTab });
        installSectionedListPatches({ call, events, info, fy, cntlr, services, debug });
        //25.07 创建拍卖按钮移动出成为单独的实践，以免不激活。
        //24.16 排除球员配置按钮：排除生效事件
        registerBuildIgnoreEvents({ events, info, fy, set, build, debug });
        // events.popup → ModuleRegistry

        registerPlayerListEvents({ events, info, cntlr, debug, futbinId, priceService, GM_setValue });
        installPlayerListPatches({ call, events, info, cntlr, isPhone, debug, repositories, services });
        call.task = {
            sbcT:UTSBCHubView.prototype.populateTiles,
            sbcN:UTSBCHubView.prototype.populateNavigation,
            objN:UTObjectivesHubView.prototype.setupNavigation,
            objG:UTObjectiveCategoryView.prototype.setCategoryGroups,
            home:UTHomeHubView.prototype._generate,
            objSetTitle:UTObjectivesHubTileView.prototype.setSubtitle,
            sbcSetDate:UTSBCSetTileView.prototype.setData,
            rewardList:UTSBCGroupRewardListView.prototype.setRewards,
            seasonSet:FCObjectiveSeasonView.prototype.setCampaign
        }

        installSbcHubPatches({ info, events, services, fy, cntlr });
        installAcademyHubPatches({ info, events, fy, repositories, debug });
        registerSbcInfoFillEvent({ events, info, fy, html, repositories });

        registerSbcNavEvents({ events, info, fy, cntlr, isPhone, repositories, services, futbinId, GM_openInTab });
        //字符串转换html对象
        // events.createDF → ModuleRegistry


        registerSbcSubPriceEvent({ events, info, fy, isPhone, repositories });
        installSbcChallengesPatch({
            info,
            events,
            services,
            eligibilityKeys: SBCEligibilityKey,
            localize: fy
        });

        call.panel = {
            quickRender:UTQuickListPanelViewController.prototype.renderView,
            market:UTMarketSearchFiltersView.prototype.setPinnedItem,
            reward:UTRewardSelectionChoiceView.prototype.expandRewardSet,
        }


        installPlayerBioPatches({ events, info, cntlr, services, debug, fy, repositories });
        //UTMarketSearchFiltersView.setPinnedItem → installMarketPatches
        installPanelPatches({ call, events, info, fy, cntlr, isPhone });
        // events.detailsButtonSet → ModuleRegistry


        // events.requirementsToText → ModuleRegistry

        
        //添加fut默认按钮
        // events.createButton → ModuleRegistry


        //添加fut滑动切换选项
        // events.createToggle → ModuleRegistry

        //添加futHome块
        // events.createTile → ModuleRegistry


        const getSbcMatchHelpers = () => ({
            calculateChemistry: (...args) => events.calculateChemistry(...args),
            getChemistryPlayers: (...args) => events.getChemistryPlayers(...args),
            getItemBy: (...args) => events.getItemBy(...args),
            createVirtualChallenge: (...args) => events.createVirtualChallenge(...args)
        });

        events.SBCSetMeetsPlayers = (controller) =>
            sbcPlayerMatchService.findMeetsPlayers(controller, getSbcMatchHelpers());

        registerSbcSubstitutionEvents({ events });

        installObjectivesHubPatches({ call, events, info, fy, isPhone, services });
        registerHomeHubEvents({ events, info, cntlr, isPhone, services });
        installHomeHubPatches({ call, events, info, fy, cntlr, services, debug, fsuSC });

        //objectives/home hub → installObjectivesHubPatches / installHomeHubPatches
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

        installMarketPatches({ call, events, info, cntlr, isPhone, fy, debug, repositories, services, GM_setValue });
        installStorePatches({ call, events, info, cntlr, isPhone, fy, debug, repositories, services, GM_setValue, AssetLocationUtils, unsafeWindow });

        //UTClubSearchFiltersViewController / UTClubSearchResultsView → installMarketPatches

        installSearchPatches({ call, events, info, isPhone, cntlr });
        registerSearchEvents({ events, info, cntlr, isPhone });
        //转会列表界面 → installMarketPatches

        //转会名单发送球员后调用事件
        // events.transferToClub → ModuleRegistry

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
        installSbcSquadSubmitPatches({ call, events, info, repositories, services, cntlr, debug, fy });
        registerSbcFillEvents({ call, events, info, cntlr, isPhone, services, debug, repositories, build, fastSbcService, oneFillCriteriaService, sbcSquadFillService, sbcTemplateService, sbcSquadSaveService });
        registerSbcTileEvents({ events, info, fy, cntlr, isPhone, services, GM_setValue, AssetLocationUtils });
        //开包动画 / eOpenPack → installStorePatches

        //一键填充需求生成程序
        //24.20 新插入程序用以手机端快捷按钮判定和快速任务
        registerSbcRewardEvents({ events, info, cntlr, isPhone, repositories, services, debug, oneFillCriteriaService, SBCEligibilityKey });
        registerFastSbcEvents({ events, cntlr, info, debug, repositories, services });
        //SBC submit → installSbcSquadSubmitPatches
        installClubSelectPatches({ call, events, info, fy, cntlr, isPhone, repositories, services, debug });

        installRewardPatches({ call, events, info, fy, cntlr, repositories, debug });
        installClubHubPatches({ call, events, info, fy, cntlr, isPhone, repositories, services });

        registerListFilterEvents({ events, repositories });
        registerUiUtilsEvents({ events, info, cntlr, debug, fy, services });
        installUiUtilsPatches();
        installLocalizationPatch({ call });
        registerPlayerMetaEvents({ events, info, fy, services });

        installSbcSubmitPatch({
            sbcCountService: ctx.sbcCountService,
            onCountChanged: () => SBCCount.changeCount()
        });

        registerMiscEvents({ events, info, cntlr, services, repositories, debug, fy });
        installMiscPatches({ events, info, fy, debug });

        installSbcRequirementsPatch({ events, info, fy, repositories });

        registerLifecycleEvents({ events, info, fy, debug });
        installLifecyclePatches({ events, cntlr, isPhone });
        installAcademyDetailsPatches({ info, events, repositories, services, cntlr, isPhone, debug });

        events.isPrecious = (rating, flag, price, type) => {
            if((Number(flag) === ItemRarity.NONE || Number(flag) === ItemRarity.RARE) && type === 0){
                if(price == 0 || _.gte(price, 2 * info.base.price[rating])){
                    return true;
                }
                return false;
            }
            return false;
        };

        registerSbcIgnoreTextEvent({ events, info, fy });
        installSbcSquadOverviewPatches({
            events,
            info,
            fy,
            cntlr,
            isPhone,
            repositories,
            debug,
            SBCEligibilityKey
        });
        installSbcSquadDetailPanelPatches({ events, info, cntlr });

        futbinId = futbinId || priceService.createFutbinIdFacade();

        registerLateModules({
            events,
            info,
            repositories,
            services,
            cntlr,
            debug,
            fy,
            futbinId,
            pdb,
            isPhone,
            httpClient,
            priceService
        });

        unsafeWindow.call = call;
        unsafeWindow.info = info;
        unsafeWindow.cntlr = cntlr;
        unsafeWindow.events = events;
        unsafeWindow.fy = fy;
        unsafeWindow.GM_addStyle = GM_addStyle;
}
