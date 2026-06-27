export function registerMiscEvents(deps) {
  const { events, info, cntlr, services, repositories, debug, fy } = deps;
  events.jsonToItemEntity = (json, isUntradeable) => {
    const baseItem = {
        "assetId": 0,
        "assists": 0,
        "attributeArray": [0, 0, 0, 0, 0, 0],
        "baseTraits": [],
        "cardsubtypeid": 2,
        "contract": 7,
        "discardValue": 0,
        "formation": "f3412",
        "gender": 0,
        "id": 0,
        "injuryGames": 0,
        "injuryType": "none",
        "itemState": "free",
        "itemType": "player",
        "lastSalePrice": 0,
        "leagueId": 0,
        "lifetimeAssists": 0,
        "lifetimeStatsArray": [0, 0, 0, 0, 0],
        "loyaltyBonus": 1,
        "marketDataMaxPrice": 0,
        "marketDataMinPrice": 0,
        "nation": 0,
        "owners": 1,
        "pile": 7,
        "playStyle": 250,
        "plusRoles": [],
        "possiblePositions": [],
        "preferredPosition": "",
        "preferredfoot": 1,
        "rareflag": 0,
        "rating": 0,
        "resourceGameYear": 2026,
        "resourceId": 0,
        "skillmoves": 0,
        "statsArray": [0, 0, 0, 0, 0],
        "teamid": 0,
        "timestamp": 0,
        "untradeable": true,
        "weakfootabilitytypecode": 0
    }
    const items = _.map(json.packItem.items, i => _.assign({}, baseItem, {
        assetId: i.id,
        resourceId: i.id,
        rating: i.rating,
        preferredPosition: _.get(_.find(i.positions, { isPreferred: true }), 'name', ''),
        teamid: _.get(i, 'club.id', 0),
        leagueId: _.get(i, 'league.id', 0),
        nation: _.get(i, 'nation.id', 0),
        attributeArray: _.values(i.attributes || {}),
        skillmoves: (i.skills || 1) - 1,
        weakfootabilitytypecode: i.weekFoot ?? 0,
        preferredfoot: i.foot ?? 1,
        possiblePositions: _.map(i.positions, "name"),
        baseTraits: _.map(_.filter(i.traits, { isIcon: false }), 'id'),
        iconTraits: _.map(_.filter(i.traits, { isIcon: true }), 'id'),
        rareflag: _.get(i, 'rarity.id', 0),
        untradeable: isUntradeable
    }));
    let itemFactory = new UTItemEntityFactory;
    if(items && items.length){
        return _.map(items,i => {return itemFactory.createItem(i)});
    }else{
        return false;
    }
}

//25.04 模拟开包程序，创建弹窗
// events.tryPackPopup → ModuleRegistry


//25.04 模拟开包程序，获取模拟开包后的数据
//26.02 兼容Pick包的模拟开包
// events.getTryPackData → ModuleRegistry

/** 25.18 真实开包概率获取 */
// events.getRealProbability → ModuleRegistry

/** 25.20 球员自动购买 界面进入事件 */
// events.goToAutoBuy → ModuleRegistry


//** 25.20 球员自动购买 球员搜索 */
// events.autoBuySearchPlayer → ModuleRegistry


//UTClubSearchResultsViewController autobuy → installMarketPatches
// events.autoBuyRightRefresh → ModuleRegistry


//UTClubSearchResultsViewController.refreshPinnedItem autobuy → installMarketPatches

//** 25.20 球员自动购买 设置右侧界面拦截 */
const UTSplitViewController_setRightController = UTSplitViewController.prototype.setRightController;
UTSplitViewController.prototype.setRightController = function(t, e) {
    const leftController = this.leftController;
    if(leftController && leftController.className && leftController.className == "UTClubSearchResultsViewController" && _.has(leftController,"_fsuAutoBuy")){
        UTSplitViewController_setRightController.call(this, leftController._fsuAutoBuyRight, e);
    }else{
        UTSplitViewController_setRightController.call(this, t, e);
    }
}

//** 25.20 球员自动购买 右侧界面tabs创造 */
const UTPlayerBioView_setupNavigation = UTPlayerBioView.prototype.setupNavigation;
UTPlayerBioView.prototype.setupNavigation = function(t, e) {
    if(this.isFsuAutoBuy){
        this._navigation.clearTabs(),
        this._navigation.addTab(444101, fy("autobuy.tabs.text0")),
        this._navigation.addTab(444102, fy("autobuy.tabs.text1")),
        this._navigation.setActiveTab(444101),
        this._navigation.addTarget(this, t, EventType.TAP),
        this._navigation.layoutSubviews()
        this._fsuSubviews = {};
    }else{
        UTPlayerBioView_setupNavigation.call(this, t, e);
    }
}


//** 25.20 球员自动购买 创建右侧信息界面 */
// events.autoBuyCreateInfoView → ModuleRegistry


//** 25.20 球员自动购买 创建右侧日志界面 */
// events.autoBuyCreateLogView → ModuleRegistry


//** 25.20 球员自动购买 右侧点选信息 */
// events.autoBuyRightRenderInfo → ModuleRegistry


//** 25.20 球员自动购买 minbuy设置 */
// events.autoBuyRightMinBuyChanged → ModuleRegistry


//** 25.20 球员自动购买 maxbuy设置 */
// events.autoBuyRightMaxBuyChanged → ModuleRegistry


//** 25.20 球员自动购买 右侧点选日志 */
// events.autoBuyRightRenderLog → ModuleRegistry


//** 25.20 球员自动购买 右侧界面构造 */

// events.autoBuyCreateItemController → ModuleRegistry
}

export function installMiscPatches(deps) {
  const { events, info, fy, debug } = deps;
  /** 25.20 球员自动购买 入口创建 */
const UTTransfersHubView_init = UTTransfersHubView.prototype.init;
UTTransfersHubView.prototype.init = function() {
    UTTransfersHubView_init.call(this);
    return;
    let autoBuyTile = new UTPlayerPicksTileView();
    autoBuyTile.init();
    autoBuyTile.title = fy("autobuy.tile.title");
    autoBuyTile.__label.innerHTML = fy("autobuy.tile.content");
    autoBuyTile.addClass("col-1-1");
    const hubMessages = services.Messages.messagesRepository.getHubMessages();
    if(hubMessages.length){
        const firstMessage = hubMessages[0];
        if(firstMessage.goToLink == "gotostore"){
            let img = autoBuyTile.getRootElement().querySelector(".img")
            img.style.backgroundImage = `url(${firstMessage.bodyImagePath})`;
            img.style.width = "22rem";
            img.style.right = "-1rem";
        }
    }
    autoBuyTile.addTarget(
        autoBuyTile,
        (e) => {
            events.goToAutoBuy();
        },
        EventType.TAP
    )
    this._extLinkTile.getRootElement().after(autoBuyTile.getRootElement());

    this._fsuAutoBuyTile = autoBuyTile;

}


/** 25.20 存储头像图片 */
let UTItemView_requestResource = UTItemView.prototype.requestResource;
UTItemView.prototype.requestResource = async function (t, e, i, r) {
    /** 注释掉 网页端开放没实际意义 */
    if (false && e === ItemAssetType.MAIN && i.isPlayer() && repositories.Item.club.items.get(i.id)) {
        const imgName = t.split("/").pop().split("?")[0].replace(/\.[^/.]+$/, '');

        // 优先尝试获取缓存的图片
        const imgData = await events.getImageByName(imgName);
        let imgUrl = t;  // 默认使用原始 URL

        if (imgData) {
            debug.log("✅ 从缓存获取", imgName);
            imgUrl = imgData;  // 使用缓存的图片 URL
        } else {
            // 如果缓存中没有，网络请求图片并保存
            const res = await fetch(t);
            const blob = await res.blob();
            if (blob.type === "image/png") {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const img = new Image();
                    img.src = reader.result; // 使用 FileReader 的结果（dataURL）

                    img.onload = () => {
                        // 将图像绘制到 canvas 上
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0);

                        // 压缩图像并获取 dataURL（调整质量）
                        const dataURL = canvas.toDataURL('image/webp', 0.5); // 第二个参数为质量，0 到 1 之间

                        // 存储压缩后的 dataURL
                        events.saveImageToIndexedDB(imgName, dataURL);
                    };
                };
                reader.readAsDataURL(blob); // 读取为 dataURL
            }
        }

        // 统一调用 requestResource，减少重复代码
        UTItemView_requestResource.call(this, imgUrl, e, i, r);
    } else {
        UTItemView_requestResource.call(this, t, e, i, r); // 其他情况调用原始方法
    }
};

/** 25.20 打开indexedDB */
events.getDB = async function () {
    if (info.base.imgDB) return info.base.imgDB;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ImageCacheDB', 1);

        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('images')) {
                db.createObjectStore('images'); // 默认 key
            }
        };

        request.onsuccess = function (event) {
            info.base.imgDB = event.target.result;
            resolve(info.base.imgDB);
        };

        request.onerror = function (event) {
            reject(event.target.error);
        };
    });
}

/** 25.20 存储图片到indexedDB */
events.saveImageToIndexedDB = async function(name, dataURL) {
    const db = await events.getDB();

    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 当前 +30天

    const tx = db.transaction('images', 'readwrite');
    const store = tx.objectStore('images');

    const data = {
        dataURL,
        expiresAt
    };

    store.put(data, name);

    return new Promise((resolve, reject) => {
        tx.oncomplete = () => {
            debug.log(`✅ 已保存图片：${name}`);
            resolve();
        };
        tx.onerror = reject;
    });
}

//** 25.20 获取图片 */
events.getImageByName = async function (imgName) {
    if (info.base.imgCache[imgName]) {
        return info.base.imgCache[imgName];  // 如果已经缓存了，就直接返回
    }

    const db = await events.getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('images', 'readonly');
        const store = tx.objectStore('images');
        const req = store.get(imgName);

        req.onsuccess = () => {
            const result = req.result;
            if (result && result.dataURL) {
                // 如果找到了 dataURL，直接返回
                info.base.imgCache[imgName] = result.dataURL;  // 缓存 dataURL
                resolve(result.dataURL);  // 返回 data URL
            } else {
                resolve(null);  // 没有找到，返回 null
            }
        };

        req.onerror = reject;
    });
};

//** 25.21 其他界面进入未分配列表 */
events.goToUnassigned = (controller) => {
    repositories.Item.unassigned.reset();
    services.Item.requestUnassignedItems().observe(controller, (e, t) => {
        if(e.unobserve(controller),t.success && JSUtils.isObject(t.response)){
            if(0 < t.response.items.length){
                const nowController = controller && controller instanceof EAViewController ? controller : cntlr.current();
                UTStoreViewController.prototype.gotoUnassigned.call(nowController);
            }
        }
    });
}

//** 25.21 批量开包：开启球员包 */
// events.openPacks → ModuleRegistry


//** 25.21 批量开包：开包确认弹窗 */
// events.openPacksConfirmPopup → ModuleRegistry


//** 25.21 批量开包：球员包结果弹窗 */
//26.02 调整样式错乱问题
// events.openPacksResultPopup → ModuleRegistry


//26.02 SBC固定挑选包预览添加
events.fixedPickPopup = async(pickItem) => {
    events.showLoader();
    let pickIdList = await events.getTryPackData(pickItem);
    debug.log(pickIdList)
    if(pickIdList && _.size(pickIdList)){
        let searchCriteria = new UTSearchCriteriaDTO;
        searchCriteria.count = 200;
        searchCriteria.defId = pickIdList;
        services.Item.searchConceptItems(searchCriteria).observe(cntlr.current(), function(e, t) {
            e.unobserve(cntlr.current());
            if(t.success){
                if(t.response.items.length){
                    let resultItems = _.filter(t.response.items, item => {
                        if (_.includes(pickIdList, item.definitionId)) {
                            item.concept = false;
                            return true;
                        }
                        return false;
                    });
                    debug.log(resultItems)
                    events.openPacksResultPopup(pickItem._staticData.description, fy("pickpreview.popupm"), resultItems);
                }else{
                    events.notice("没有匹配的球员数据，需EA更新！", 2)
                }
            } else {
                events.notice("读取球员数据失败！", 2)
            }
            events.hideLoader();
        })
    }
    // const items = events.jsonToItemEntity(pickJson, pickItem.untradeableCount);
    // if(items){
    //     debug.log(items)
    // }else {
    //     events.notice(fy("notice.loaderror") + "player data error",2);
    //     events.hideLoader();
    // }
}
}
