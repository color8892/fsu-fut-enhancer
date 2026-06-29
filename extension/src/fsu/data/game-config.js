/** Initial runtime info state. Requires EA globals (PlayerAttribute, ItemSubAttribute). */
export function createGameInfo() {
  return {
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
    "playermeta": {},
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
}
