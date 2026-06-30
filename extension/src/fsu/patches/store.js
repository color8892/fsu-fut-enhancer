let inPacksController;
let specialPlayersController;

export function installStorePatches(deps) {
    const { call, events, info, cntlr, isPhone, fy, repositories, services, GM_setValue, AssetLocationUtils, unsafeWindow } = deps;
    const GM_openInTab = unsafeWindow.GM_openInTab;

    events.showPlayerListPopup = (title, text, players, desc) => {
        const popupController = new EADialogViewController({
            dialogOptions: [{ labelEnum: enums.UIDialogOptions.OK }],
            message: "",
            title,
            type: EADialogView.Type.MESSAGE
        });
        popupController.init();
        popupController.onExit.observe(popupController, (e, _z) => {
            e.unobserve(popupController);
            popupController.dealloc();
            const current = cntlr.current();
            if (current instanceof UTStorePackViewController) {
                current.getStorePacks(true);
            }
        });
        popupController._fsu = {};
        const popupView = popupController.getView();
        popupView.__msg.remove();
        popupView.__btnContainer.querySelector("button").classList.remove("text");
        popupView.__btnContainer.querySelector("button").classList.add("primary", "mini");
        const popupBox = document.createElement("div");
        if (players.length) {
            popupController._fsu.listBox = events.createElementWithConfig("div", {
                classList: "ut-store-reveal-modal-list-view",
                style: { borderRadius: "0", padding: "0" }
            });
            popupController._fsu.list = events.createElementWithConfig("ul", {
                classList: ["itemList", "fsu-popupItemList"]
            });
            popupController._fsu.listBox.appendChild(popupController._fsu.list);
            players.forEach((i) => {
                const row = new UTItemTableCellView();
                row.setData(i, void 0, ListItemPriority.DEFAULT);
                row.render();
                if (!desc && i._playStyles.length) {
                    const popupItemOther = events.createElementWithConfig("div", {
                        classList: "fsu-popupItemOther"
                    });
                    const traitBox = events.createElementWithConfig("div", {
                        classList: "fsu-popupItemTrait"
                    });
                    popupItemOther.appendChild(traitBox);
                    _.map(
                        _.orderBy(i._playStyles, [(item) => (item.isIcon ? 0 : 1), "category"], ["asc", "asc"]),
                        (t) => {
                            const classList = ["fut_icon", "fsu-traitIcon"];
                            if (t.isIcon) {
                                classList.push(`icon_icontrait${t.traitId}`, "icon");
                            } else {
                                classList.push(`icon_basetrait${t.traitId}`);
                            }
                            traitBox.appendChild(events.createElementWithConfig("i", { classList }));
                        }
                    );
                    const popupItemOtherBtn = events.createButton(
                        new UTButtonControl(),
                        fy("sbc.watchplayer"),
                        (e) => events.openFutbinPlayerUrl(e, i),
                        "btn-standard mini"
                    );
                    popupItemOther.appendChild(popupItemOtherBtn.getRootElement());
                    row.__rowContent.appendChild(popupItemOther);
                }
                popupController._fsu.list.appendChild(row.getRootElement());
            });
            popupBox.appendChild(popupController._fsu.listBox);
        }
        popupBox.appendChild(events.createElementWithConfig("div", {
            textContent: text,
            style: { paddingTop: ".5rem", fontSize: "1rem" }
        }));
        if (desc) {
            popupBox.appendChild(events.createElementWithConfig("div", {
                textContent: desc,
                style: { paddingTop: ".5rem", fontSize: "1rem", opacity: ".5" }
            }));
        }
        events.loadPlayerInfo(players, popupView);
        popupView.getRootElement().querySelector(".ea-dialog-view--body").prepend(popupBox);
        gPopupClickShield.setActivePopup(popupController);
    };

    //球员预览包打开 读取球员列表查询价格
    UTStoreRevealModalListView.prototype.addItems = function(e, t, i, o) {
        //25.21 预览包重排序 球员、稀有度、评分
        const showPlayers = _.orderBy(e, [i => i.isPlayer(), "rareflag", "rating"], ["desc", "desc", "desc"]);
        call.plist.storeReveal.call(this, showPlayers, t, i, o);
        events.loadPlayerInfo(e);
    }

    //** 25.21 移除包名多余字符 */
    events.truncateStrict = (text, maxLength = 26, tail = '...') => {
        let width = 0;
        let result = '';
        for (const ch of text) {
            width += ch.charCodeAt(0) > 255 ? 2 : 1;
            if (width > maxLength - tail.length) {
                return result + tail;
            }
            result += ch;
        }
        return result;
    };
    UTStoreView.prototype.setPacks = function(e, t, i, o) {
        
        //** 25.21 包排重加载 */
        const HideAndShow = this.getStoreCategory() == 'mypacks';
        let showList;
        if(HideAndShow){
            const packList = [];
            this._fsuPacks = {};
            for (const ep of e) {
                const key = `${ep.id}-${ep.tradable}`;
                if (!packList.some(plp => `${plp.id}-${plp.tradable}` === key)) {
                    packList.push(ep);
                }
                this._fsuPacks[key] ??= (() => {
                    let rawName = services.Localization.localize(ep.packName);
                    const name = ep.tradable ? `*${rawName}` : rawName;
                    return {
                        packId: ep.id,
                        tradable: ep.tradable,
                        count: 0,
                        isPlayers: ep.contentType === 'players',
                        name: events.truncateStrict(name),
                        fullName: name,
                        value: events.getOddo(ep.id)
                    };
                })();
                this._fsuPacks[key].count++;
            }
            //debug.log(packList, this._fsuPacks)
            showList = _.orderBy(packList, item => events.getOddo(item.id), info.myPacksSort);
        }else{
            const ONE_DAY = 86400; // 秒
            const now = Math.floor(Date.now() / 1000);
            const categoryId = this.getStoreCategory();

            // 25.22 增加新包的new标识
            e.forEach(item => {
                item.isNew = item.start && now - item.start <= ONE_DAY && categoryId !== 3;
            });

            const sorted = _.orderBy(e, [
                item => !item.getPrice(GameCurrency.POINTS) && item.getPrice(GameCurrency.COINS) && item.id !== 101,
                item => item.isNew, // 直接用 isNew 属性
                item => 'previewCreateTime' in item,
                item => {
                    const price = item.getPrice(GameCurrency.COINS) || 1;
                    return events.getOddo(item.id) / price;
                }
            ], ['desc', 'desc', 'desc', 'desc']);
            showList = sorted;
        }
        call.other.store.setPacks.call(this, showList, t, i, o)

        setTimeout(() => {
            let packTileExists = "_fsuPackTile" in this,
            SBCTileExists = "_fsuSBCTile" in this,
            packFilter = "_fsufilter" in this,
            unassignedTile = "_fsuUnassignedTile" in this,
            itemListElement = this.__itemList,
            unassignedItems = repositories.Item.getUnassignedItems().length;
            this.storePacks.forEach((item) => {

                const packCoin = events.getOddo(item.articleId);
                const itemElement = item.getRootElement();
                const packData = repositories.Store.getArticle(item.articleId);
                
                // 25.22 添加包的新标签标志
                if(packData && packData.isNew && !itemElement.querySelector(".fsu-newtips")){
                    let newTips = events.createElementWithConfig("div", {
                        textContent:fy("task.new"),
                        classList:["fsu-newtips"]
                    });
                    itemElement.prepend(newTips);
                    itemElement.style.position = "relative";
                }


                if(packCoin && !itemElement.querySelector(".fsu-packprice")){
                    let packCoinBox = document.createElement("p");
                    packCoinBox.classList.add("ut-store-pack-details-view--description","currency-coins","fsu-packprice");
                    packCoinBox.textContent = `${fy("returns.text")}${packCoin.toLocaleString()}`;
                    if(!isPhone()){
                        packCoinBox.style.marginBottom = "0";
                    }
                    if(packData){
                        if(packData.getPrice(GameCurrency.COINS)){
                            let packDiff = Math.round((packCoin/packData.getPrice(GameCurrency.COINS)-1)*100);
                            let packDiffElement = document.createElement("span");
                            packDiffElement.style.paddingLeft = ".3em";
                            if(packDiff > 0){
                                packDiffElement.style.color = "#36b84b"
                                packDiffElement.textContent = `(+${packDiff}%)`
                            }else{
                                packDiffElement.style.color = "#d21433"
                                packDiffElement.textContent = `(${packDiff}%)`
                            }
                            packCoinBox.appendChild(packDiffElement);
                        }
                    }
                    let packExtraInfo = events.createElementWithConfig("div", {
                        style:{
                            display:isPhone() ? "block" : "flex",
                            justifyContent:"space-between",
                            alignItems:"center",
                        }
                    })
                    packExtraInfo.appendChild(packCoinBox)
                    item._fsuExtraInfo = packExtraInfo;
                    item.__articleDesc.after(item._fsuExtraInfo)
                    let packInfoBox = events.createElementWithConfig("div", {
                        style:{
                            position:"absolute",
                            bottom:"0",
                            backgroundColor:"rgb(0 0 0 / 60%)",
                            width:"100%",
                            textAlign:"center",
                            padding:".2rem 0",
                            color:"#ffffff",
                            fontSize:"1rem",
                        }
                    });
                    let packInfoTitle = events.createElementWithConfig("div", {
                        textContent:_.replace(_.replace(fy("returns.text"),":",""),"：","")
                    });
                    packInfoBox.appendChild(packInfoTitle)
                    let packInfoCoin = events.createElementWithConfig("div", {
                        classList: ['currency-coins'],
                        textContent:packCoin.toLocaleString()
                    });
                    packInfoBox.appendChild(packInfoCoin);
                    if(_.has(item,"_pack")){
                        item._pack.getRootElement().appendChild(packInfoBox);
                    }
                }
                if(HideAndShow){
                    const packInfo = this._fsuPacks[`${item.articleId}-${!item.__root.classList.contains('is-untradeable')}`];
                    if(packInfo){
                        if (!itemElement.querySelector(".fsu-packcount")) {
                            itemElement.style.position = "relative";
                            let packCount = events.createElementWithConfig("div", {
                                textContent: packInfo.count,
                                classList: ['ut-tab-bar-item-notif', 'fsu-packcount'],
                                style: {
                                    position: "absolute",
                                    top: "1.4rem",
                                    right: "1rem",
                                    width: "1.6rem",
                                    height: "1.6rem",
                                    textAlign: "center",
                                    fontSize: "1.2rem",
                                    lineHeight: "1.7rem",
                                    zIndex: "1",
                                }
                            });
                            itemElement.appendChild(packCount)
                        }

                    }
                }
            })

            if(packFilter){
                if(HideAndShow && _.size(this._fsuPacks)){
                    this._fsufilter.style.display = "flex";
                    let filterOptionId = this._fsufilterOption.getId();
                    let filterOptionArray = [];
                    let tradeableCount = this.__itemList.querySelectorAll(".is-tradeable").length;
                    let packTotal = _.sumBy(_.values(this._fsuPacks), 'count');
                    let packValue = _.sum(_.map(this._fsuPacks,(i) => { return i.count * i.value}));
                    filterOptionArray.push(new UTDataProviderEntryDTO(-1,-1,fy(`sbc.filter0`)))
                    filterOptionArray.push(new UTDataProviderEntryDTO(0,0,fy([`packfilter.total`,packTotal,packValue.toLocaleString()])))
                    if(tradeableCount){
                        filterOptionArray.push(new UTDataProviderEntryDTO(1,1,`${fy(`pack.filter0`)} × ${tradeableCount}`))
                    }
                    for (const value of _.orderBy(this._fsuPacks,"value",info.myPacksSort)) {
                        const dto = new UTDataProviderEntryDTO(Number(value.packId),Number(value.packId),`${value.name} × ${value.count}`)
                        filterOptionArray.push(dto);
                    }

                    this._fsufilterOption.setOptions(filterOptionArray);
                    if(filterOptionId in this._fsuPacks){
                        this._fsufilterOption.setIndexById(filterOptionId)
                    }else{
                        this._fsufilterOption.setIndexById(filterOptionId == 1 ? 1 : -1)
                    }
                }else{
                    this._fsufilter.style.display = "none";
                }
            }else{
                if(_.size(this._fsuPacks)){
                    let filterOption = new UTDropDownControl();
                    filterOption.init();
                    filterOption._parent = this;
                    filterOption.addTarget(filterOption, (e) => {
                        let filterId = e.getId();
                        if(filterId == 0){
                            e.setIndex(0);
                            return;
                        }
                        e._parent.storePacks.forEach((i) => {
                            if(i.articleId == filterId || filterId == -1 || (filterId == 1 && i.getRootElement().classList.contains('is-tradeable'))){
                                i.show();
                            }else{
                                i.hide();
                            }
                            if(filterId == -1){
                                e._parent.__itemList.addEventListener(EventType.SCROLL, e._parent.debounceCallback, !1)
                            }else{
                                e._parent.__itemList.removeEventListener(EventType.SCROLL, e._parent.debounceCallback, !1)
                            }
                        })
                    }, EventType.CHANGE);
                    this._fsufilterOption = filterOption;
                    this._fsufilter = events.createElementWithConfig("div",{
                        classList:["fsu-sbcfilter-box"],
                        style:{
                            zIndex:"3"
                        }
                    })
                    let filterOptionBox = events.createElementWithConfig("div",{
                        classList:["fsu-sbcfilter-option"]
                    })
                    let filterText = events.createElementWithConfig("div",{
                        textContent:fy(`sbc.filtert`)
                    })
                    filterOptionBox.appendChild(filterText);
                    filterOptionBox.appendChild(this._fsufilterOption.__root);
                    this._fsufilter.appendChild(filterOptionBox);

                    //25.21 包排序按钮添加
                    let packsSortBtn = events.createButton(
                        new UTStandardButtonControl(),
                        ``,
                        (e) => {
                            info.myPacksSort = info.myPacksSort === "desc" ? "asc" : "desc";
                            const isDesc = info.myPacksSort == "desc";
                            const iconElement = e.getRootElement().querySelector(".fut_icon");
                            iconElement.className = "fut_icon";
                            iconElement.classList.add(isDesc ? "icon_arrow" : "icon_chevron");
                            GM_setValue("packsSort",info.myPacksSort);
                            events.notice(fy(["packssort.switch.notice",services.Localization.localize("store.group.mypacks"),fy(`sort.${info.myPacksSort}`)]),0);
                            cntlr.current().getStorePacks();
                        },
                        "mini"
                    )
                    let packsSortBtnIcon = events.createElementWithConfig("span",{
                        classList:["fut_icon",info.myPacksSort === "desc" ? "icon_arrow" : "icon_chevron"]
                    })
                    packsSortBtn.getRootElement().style.marginLeft = "1rem";
                    packsSortBtn.getRootElement().appendChild(packsSortBtnIcon);
                    this._fsufilter.appendChild(packsSortBtn.getRootElement());


                    let targetElement = this._navigation.getRootElement();
                    targetElement.parentNode.insertBefore(this._fsufilter, targetElement.nextSibling);
                    this._fsufilter.style.display = HideAndShow ? "flex" : "none";
                }
            }
            if(packTileExists || SBCTileExists){
                if(packTileExists){
                    this._fsuPackTile.setInteractionState(0);
                    events.setPackTileText(this._fsuPackTile);
                    this._fsuPackTile[HideAndShow ? 'show' : 'hide']();
                }
                if(SBCTileExists){
                    this._fsuSBCTile.setInteractionState(0);
                    events.judgmentSbcCount(this._fsuSBCTile);
                    this._fsuSBCTile[HideAndShow ? 'show' : 'hide']();
                }
            }else{
                let tileBox = document.createElement("div");
                tileBox.classList.add("ut-store-bundle-details-view");
                tileBox.style.cssText = "display: flex;background: none; border: none; justify-content: space-between; padding:0;";
                let tileStyle = info.set.info_packagain && info.set.info_sbcagain ? `margin:0;` : `margin:0;flex-basis: 100%;max-width: 100%;`,
                tileClass = info.set.info_packagain && info.set.info_sbcagain ? "col-1-2" : "col-1-1";
                if(info.set.info_packagain){
                    let packTile = events.createTile(
                        fy("douagain.packtile.title"),
                        fy("douagain.packtile.text"),
                        (_e) => {
                            let current = cntlr.current();
                            let pack = current.viewmodel.getPacks('mypacks').filter(i => i.id == info.douagain.pack).pop();
                            current.eOpenPack(
                                current.getView(),
                                UTStorePackDetailsView.Event.OPEN,
                                {"articleId":pack.id,"tradable":pack.tradable}
                            )
                        }
                    )
                    packTile.__root.classList.remove("col-1-3");
                    packTile.__root.classList.add(tileClass,"fsu-store-tile");
                    packTile.__root.style.cssText = tileStyle;
                    packTile[HideAndShow ? 'show' : 'hide']();
                    events.setPackTileText(packTile);
                    tileBox.appendChild(packTile.__root);
                    this._fsuPackTile = packTile;
                    this._fsuPackTile[HideAndShow ? 'show' : 'hide']();
                }
                if(info.set.info_sbcagain){
                    let sbcTile = events.createTile(
                        fy("douagain.sbctile.title"),
                        fy("douagain.sbctile.text"),
                        (_e) => {
                            if(info.douagain.sbc){
                                events.goToSBC(services.SBC.repository.getSetById(info.douagain.sbc));
                            }else{
                                events.notice("douagain.error",2);
                            }
                        }
                    )
                    sbcTile.__root.classList.remove("col-1-3");
                    sbcTile.__root.classList.add(tileClass,"fsu-store-tile");
                    sbcTile.__root.style.cssText = tileStyle;
                    sbcTile[HideAndShow ? 'show' : 'hide']();
                    sbcTile.setInteractionState(0);
                    events.judgmentSbcCount(sbcTile);
                    tileBox.appendChild(sbcTile.__root);
                    this._fsuSBCTile = sbcTile;
                    this._fsuSBCTile[HideAndShow ? 'show' : 'hide']();
                }
                if(info.set.info_packagain || info.set.info_sbcagain){
                    itemListElement.insertBefore(tileBox, itemListElement.firstChild);
                }
            }
            if(!unassignedTile && unassignedItems){
                let tileBox = document.createElement("div");
                tileBox.classList.add("ut-store-pack-details-view");
                tileBox.style.padding = 0;
                let uTile = new UTUnassignedTileView();
                uTile.getRootElement().style.margin = 0;
                tileBox.appendChild(uTile.getRootElement());
                uTile.init();
                uTile.setNumberOfItems(unassignedItems);
                this._fsuUnassignedTile = uTile;
                this._fsuUnassignedTile.addTarget(
                    this._fsuUnassignedTile,
                    (_e) => {
                        TelemetryManager.trackEvent(TelemetryManager.Sections.STORE, TelemetryManager.Categories.BUTTON_PRESS, "Store - Unassigned Tile"),
                        cntlr.current().gotoUnassigned()
                    },
                    EventType.TAP
                )
                itemListElement.insertBefore(tileBox, itemListElement.firstChild);
            }
            if(unassignedTile){
                if(unassignedItems){
                    this._fsuUnassignedTile.setNumberOfItems(unassignedItems);
                    this._fsuUnassignedTile.show();
                }else{
                    this._fsuUnassignedTile.hide();
                }
            }

        }, 50)
    }

    //开包动画
    UTPackAnimationViewController.prototype.runAnimation = function() {
        if (!this.running) {
            this.running = !0;
            var e = this.getView()
            , t = services.Configuration.getItemRarity(this.presentedItem);
            e.setPackTier(this.packTier),
            e.generateItem(this.presentedItem);
            if(!info.set.info_skipanimation){
                e.runAnimation(this.presentedItem, t);
            }
            this.animationTimeout = window.setTimeout(this.runCallback.bind(this), info.set.info_skipanimation ? 0 : 4500)
        }
    }
    //开包设置再次开包
    const UTSVCEOP_CALL= UTStoreViewController.prototype.eOpenPack;
    UTStoreViewController.prototype.eOpenPack = function(p, e, t) {
        UTSVCEOP_CALL.call(this,p, e, t)
        let i,d = null === (i = this.viewmodel) || void 0 === i ? void 0 : i.getPackById(t.articleId, e === UTStorePackDetailsView.Event.OPEN, JSUtils.isBoolean(t.tradable) ? t.tradable : void 0);
        if(d.isMyPack){
            if(repositories.Store.myPacks.values().filter(i => i.id == d.id).length > 1){
                info.douagain.pack = d.id;
            }else{
                if(!repositories.Store.myPacks.values().filter(i => i.id == info.douagain.pack).length){
                    info.douagain.pack = 0;
                }
            }
        }
    }

    //商店页面设置标题
    UTStoreViewController.prototype.setCategory = function(e) {
        call.other.store.setCategory.call(this,e)
        if(this.viewmodel !== void 0){
            let conditions = ['UT_STORE_CAT_S_PFU', 'FUT_STORE_CAT_SPECIAL_NAME', 'FUT_STORE_CAT_PROVISIONS'];
            let searchCategoryIds = _.map(
                _.filter(this.viewmodel.categories, obj =>
                    conditions.includes(obj.localizedName)
                ),'categoryId'
            );

            let classic = _.find(this.viewmodel.categories, c => c.localizedName == "FUT_STORE_CAT_CLASSIC_NAME")

            //24.18 修复无法展示纯金币包的问题
            _.forEach(this.getView()._navigation.items,item => {
                if(searchCategoryIds.includes(item.id)){
                    let coinsPack = _.filter(this.viewmodel.getCategoryArticles(item.id), pack => _.isEqual(pack.state, 'active') && !pack.getPrice(GameCurrency.POINTS) && pack.getPrice(GameCurrency.COINS))
                    if(coinsPack.length){
                        item.addNotificationBubble(coinsPack.length);
                    }
                }
                if(item.id == classic.categoryId){
                    //25.04 查询预览包是否预览
                    let xrayPack = _.filter(this.viewmodel.getCategoryArticles(classic.categoryId),pack => _.has(pack,"previewCreateTime") && pack.previewCreateTime == 0)
                    if(xrayPack.length){
                        item.addNotificationBubble(xrayPack.length);
                    }
                }
            })

        }
    }

    //26.04 添加可开球员tile
    //26.04 添加特殊品质tile
    const UTStoreHubViewController_onPackLoadComplete = UTStoreHubViewController.prototype.onPackLoadComplete;
    UTStoreHubViewController.prototype.onPackLoadComplete = function(e, t) {
        UTStoreHubViewController_onPackLoadComplete.call(this, e, t);
        let view = this.getView();
        if(info.inpacks.defIds.length && !("_fsuInPacksTile" in view)){
            let inPacksTile = new UTTileView();
            inPacksTile.getRootElement().classList.add("col-1-2", "fsu-showPlayerstile");
            inPacksTile.title = fy("inpacktile.title")
            inPacksTile.__tileTitle.after(
                events.createElementWithConfig("p", {
                    textContent: fy("inpacktile.desc")
                })
            )
            inPacksTile.fsuImgBox = events.createElementWithConfig("div", {
                classList: "img-box"
            })
            let imgSrc = _.find(services.Messages.messagesRepository.hubMessages, {goToLink:"gotostore"})?.bodyImagePath || 'https://www.ea.com/ea-sports-fc/ultimate-team/web-app/images/squad/activeSquadTile_squad.png';
            inPacksTile.fsuImgBox.appendChild(
                events.createElementWithConfig("img", {
                    src: imgSrc
                })
            )
            inPacksTile.__tileContent.appendChild(inPacksTile.fsuImgBox);
            inPacksTile.fsuCount = new UTLabelView;
            inPacksTile.fsuCount.setRoundedCorner(UTLabelView.Rounded.TOP_RIGHT);
            inPacksTile.fsuCount.setLabel(services.Localization.localize("tile.label.itemCount", [info.inpacks.defIds.length.toString()]));
            inPacksTile.__tileContent.appendChild(inPacksTile.fsuCount.getRootElement())
            view._fsuInPacksTile = inPacksTile;
            view._fsuInPacksTile.addTarget(view,(_e) => {
                events.goToInPacks(this.getNavigationController())
            },EventType.TAP);
            view._fsuInPacksTile.setInteractionState(true);
            view.__hubGrid.appendChild(view._fsuInPacksTile.getRootElement());
        }
        if(_.has(info, 'specialPlayers') && (_.size(_.get(info, 'specialPlayers.dynamic')) + _.size(_.get(info, 'specialPlayers.extraChem')) > 0) && !("_fsuSpecialTile" in view)){
            let specialTile = new UTTileView();
            specialTile.getRootElement().classList.add("col-1-2", "fsu-showPlayerstile", "fsu-specialTile");
            specialTile.title = fy("specialtile.title")
            specialTile.__tileTitle.after(
                events.createElementWithConfig("p", {
                    textContent: fy("specialtile.desc")
                })
            )
            specialTile.fsuImgBox = events.createElementWithConfig("div", {
                classList: "img-box"
            })
            const keys = _.keys(info.specialPlayers.dynamic);
            const randomKeys = _.sampleSize(keys, 3);
            randomKeys.forEach(key => {
                const img = events.createElementWithConfig("img", {
                    src: AssetLocationUtils.getFilterImage(AssetLocationUtils.FILTER.RARITY, key)
                });
                specialTile.fsuImgBox.appendChild(img);
            });
            specialTile.__tileContent.appendChild(specialTile.fsuImgBox);
            specialTile.fsuCount = new UTLabelView;
            specialTile.fsuCount.setRoundedCorner(UTLabelView.Rounded.TOP_RIGHT);
            specialTile.fsuCount.setLabel(services.Localization.localize("tile.label.itemCount", [_.size(info.specialPlayers.dynamic) + _.size(info.specialPlayers.extraChem)]));
            specialTile.__tileContent.appendChild(specialTile.fsuCount.getRootElement())
            view._fsuSpecialTile = specialTile;
            view._fsuSpecialTile.addTarget(view,(_e) => {
                this.getNavigationController().pushViewController(new specialPlayersController());
            },EventType.TAP);
            view._fsuSpecialTile.setInteractionState(true);
            view.__hubGrid.appendChild(view._fsuSpecialTile.getRootElement());
        }
    }

    //26.04 打开包内球员页面
    events.goToInPacks = async(nav) => {
        if(nav){
            if(info.inpacks.players.length === 0){
                events.showLoader()
                let allItems = [];
                let offset = 0;
                const limit = 200;
                while (true) {
                    let done = await new Promise(resolve => {
                        let searchCriteria = new UTSearchCriteriaDTO;
                        searchCriteria.count = limit;
                        searchCriteria.offset = offset;
                        searchCriteria.defId = info.inpacks.defIds;
                        searchCriteria.rarities = info.inpacks.rarityIds;

                        services.Item.searchConceptItems(searchCriteria)
                            .observe(cntlr.current(), function (e, t) {
                                e.unobserve(cntlr.current());
                                if (!t.success) {
                                    events.notice("读取球员数据失败！", 2);
                                    return resolve(true); // 结束循环
                                }

                                const items = t.response.items || [];
                                allItems.push(...items);

                                // 若返回数量 < 200，则说明数据读取结束
                                if (items.length < limit) {
                                    resolve(true);
                                } else {
                                    offset += limit;
                                    resolve(false);
                                }
                            });

                    });
                    if (done) break;
                }

                if(allItems.length){
                    _.forEach(info.inpacks.defIds, defId => {
                        let player = _.find(allItems, item => { return item.definitionId === defId })
                        if(player){
                            player.concept = false
                            player.isInPacks = true
                            info.inpacks.players.push(player)
                        }
                    })
                }

                events.hideLoader();
            }
            var controller = new inPacksController();
            nav.pushViewController(controller);
        }
    }

    //26.04 包内球员界面创建
    const inPacksControllerView = function (_t) {
        EAView.call(this);
    };
    JSUtils.inherits(inPacksControllerView, EAView);
    inPacksControllerView.prototype._generate = function _generate() {
        if (!this._generated) {
            this._fsu ??= {};
            let view = events.createElementWithConfig("div", {
                classList: "fsu-showPlayers"
            })
            let listBox = events.createElementWithConfig("div", {
                classList: "fsu-showPlayersList"
            })
            const inClub = events.getItemBy(1, {"definitionId": _.map(info.inpacks.players, "definitionId")});
            _.forEach(info.inpacks.players, player => {
                let itemViewBox = events.createElementWithConfig("div", {
                    classList: "fsu-showPlayersItem"
                })
                
                let itemViewCard = events.createElementWithConfig("div", {
                    classList: "fsu-showPlayersCard"
                })
                let itemView = UTItemViewFactory.createLargeItem(player);
                itemView.init();
                itemView.render(player);
                this._fsu[`itemViews_${player.id}`] = itemView;
                itemViewCard.appendChild(itemView.getRootElement());
                itemViewBox.appendChild(itemViewCard);

                

                let itemViewTrais = events.createElementWithConfig("div", {
                    classList: "fsu-showPlayersTrais"
                })
                _.map(_.orderBy(player._playStyles, [item => item.isIcon ? 0 : 1, 'category'], ['asc', 'asc']), t => {
                    let classList = ["fut_icon", "fsu-traitIcon"]
                    if (t.isIcon) {
                        classList.push(`icon_icontrait${t.traitId}`)
                        classList.push("icon")
                    } else {
                        classList.push(`icon_basetrait${t.traitId}`)
                    }
                    itemViewTrais.appendChild(events.createElementWithConfig("div", {
                        classList: classList
                    }))
                })
                itemViewBox.appendChild(itemViewTrais);

                let itemViewBtn = events.createButton(
                    new UTStandardButtonControl(),
                    fy("quicklist.gotofutbin"),
                    (_e) => {events.openFutbinPlayerUrl(_e, player);},
                    "call-to-action mini fsu-showPlayersBtn"
                )
                this._fsu[`itemViewBtn_${player.id}`] = itemViewBtn;
                itemViewBox.appendChild(itemViewBtn.getRootElement());

                if(_.includes(inClub, player.definitionId)){
                    itemViewBox.appendChild(events.createElementWithConfig("div", {
                        classList: "fsu-showPlayersLabel",
                        textContent: fy("player.inclub")
                    }))
                }

                listBox.appendChild(itemViewBox);
                this._fsu.itemBox = itemViewBox;
            })
            view.appendChild(listBox);
            this._fsu.listBox = listBox;
            this.__root = view;
            events.loadPlayerInfo(info.inpacks.players)
            this._generated = !0;
        }
    }
    inPacksControllerView.prototype.dealloc = function () {
        //清除创建的资源
        events.fsuDispose(this, "_fsu")
        this.__root = null;
    }
    inPacksController = function (_t) {
        EAViewController.call(this);
    };
    JSUtils.inherits(inPacksController, EAViewController);
    inPacksController.prototype._getViewInstanceFromData = function () {
        return new inPacksControllerView();
    };
    inPacksController.prototype.viewDidAppear = function () {
        this.getNavigationController().setNavigationVisibility(true, true);
    };
    inPacksController.prototype.getNavigationTitle = function () {
        return fy("inpacktile.title") + `(${info.inpacks.players.length})`;
    };

    //26.04 特殊品质界面创建
    const specialPlayersControllerView = function (_t) {
        EAView.call(this);
    };
    JSUtils.inherits(specialPlayersControllerView, EAView);
    specialPlayersControllerView.prototype._generate = function _generate() {
        if (!this._generated) {
            this._fsu ??= {};
            let view = events.createElementWithConfig("div", {
                classList: "fsu-showPlayers"
            })
            let SL = services.Localization;
            if(_.size(info.specialPlayers.dynamic)){
                let dynamic = _.map(info.specialPlayers.dynamic, (v, k) => {
                    const id = Number(k);
                    const count = events.getItemBy(1, { _rareflag: id, loans: -1}, repositories.Item.getTransferItems()).length;
                    return { id, count, ...v };
                });
                dynamic = _.orderBy(dynamic, ['count', 'exp'], ['desc', 'desc']);
                
                let listBox = events.createElementWithConfig("div", {
                    classList: "fsu-showPlayersList"
                })
                _.forEach(dynamic, d => {
                    
                    const nameColor = repositories.Rarity.get(d.id).largeColorMaps.get(0).name;

                    let item = events.createElementWithConfig("div", {
                        classList: ["fsu-showPlayersItem", "fsu-showRarity"]
                    })
                    item.appendChild(events.createElementWithConfig("div", {
                        classList: "fsu-showRarityTips",
                        textContent: fy("special.dynamic")
                    }))
                    let card = events.createElementWithConfig("div", {
                        classList: ["fsu-showRarityCard"]
                    })
                    card.appendChild(events.createElementWithConfig("img", {
                        src: AssetLocationUtils.getFilterImage(AssetLocationUtils.FILTER.RARITY, d.id)
                    }))
                    card.appendChild(events.createElementWithConfig("div", {
                        textContent: SL.localize(`item.raretype${d.id}`)
                    }))
                    card.appendChild(events.createElementWithConfig("div", {
                        textContent: d.count,
                        classList: "fsu-showRarityCount",
                        style: {
                            color: `rgba(${nameColor.r},${nameColor.g},${nameColor.b},1)`
                        }
                    }))
                    item.appendChild(card)

                    let infos = events.createElementWithConfig("div", {
                        classList: "fsu-showRarityInfo"
                    })
                    const days = Math.max(0, Math.ceil((d.exp - Date.now()/1000) / (60 * 60 * 24)));
                    const daysText = days ? SL.localize("auctionduration.day.plural", [days]) : SL.localize("academy.timer.slot.expired");
                    
                    let expiry = events.createElementWithConfig("div", {
                        classList: "fsu-showRarityExpiry"
                    })
                    expiry.innerHTML = `<i class="fut_icon icon_timer_expiry"></i><div>${SL.localize("academy.itemdetails.header.enrollment", [daysText])}</div>`;
                    infos.appendChild(expiry);

                    let attrs = events.createElementWithConfig("div", {
                        classList: "fsu-showRarityAttrs"
                    })
                    _.forEach(d.change, (change) => {
                        let attrText = _.map(info.dynamicStats[`${change}`], c => {
                            return SL.localize(c)
                        })
                        attrs.appendChild(events.createElementWithConfig("div", {
                            textContent: attrText.join(" / ")
                        }))
                    })
                    infos.appendChild(attrs);
                    item.appendChild(infos)

                    let btns = events.createElementWithConfig("div", {
                        classList: "fsu-showRarityBtns"
                    })
                    const btnText = d.count > 0 ? fy("player.inclub") + `(${d.count})` : fy("player.noclub");
                    let clubBtn = events.createButton(
                        new UTStandardButtonControl(),
                        btnText,
                        (_e) => {
                            let players = _.cloneDeep(events.getItemBy(2, { _rareflag: d.id, BTWrating:[99, 45], loans: -1}, repositories.Item.getTransferItems()));
                            _.forEach(players , p => {
                                p.storeLoc = true
                            })
                            events.showPlayerListPopup(SL.localize(`item.raretype${d.id}`), fy("special.dynamic.popupm"), players);
                        },
                        "call-to-action mini"
                    )
                    if(d.count === 0){
                        clubBtn.setInteractionState(0);
                    }
                    this._fsu[`clubBtn_${d.id}`] = clubBtn;

                    btns.appendChild(clubBtn.getRootElement())
                    let futbinBtn = events.createButton(
                        new UTStandardButtonControl(),
                        fy("quicklist.gotofutbin"),
                        (_e) => {
                            GM_openInTab(`https://www.futbin.com/${d.url}`, { active: true, insert: true, setParent :true });
                        },
                        "call-to-action mini"
                    )
                    btns.appendChild(futbinBtn.getRootElement())
                    this._fsu[`futbinBtn_${d.id}`] = futbinBtn;

                    item.appendChild(btns)
                    listBox.appendChild(item)
                })
                view.appendChild(listBox);
                this._fsu.listBox = listBox;
            }

            if(_.size(info.specialPlayers.extraChem)){
                let extraChem = _.map(info.specialPlayers.extraChem, (v, k) => {
                    const id = Number(k);
                    const count = events.getItemBy(1, { rareflag: id, loans: -1 }, repositories.Item.getTransferItems()).length;
                    return { id, count, ...v };
                });
                extraChem = _.orderBy(extraChem, ['count'], ['desc']);
                let chemListBox = events.createElementWithConfig("div", {
                    classList: "fsu-showPlayersList"
                })
                _.forEach(extraChem, ec => {
                    
                    const chemNameColor = repositories.Rarity.get(ec.id).largeColorMaps.get(0).name;

                    let item = events.createElementWithConfig("div", {
                        classList: ["fsu-showPlayersItem", "fsu-showRarity"]
                    })
                    item.appendChild(events.createElementWithConfig("div", {
                        classList: "fsu-showRarityTips",
                        textContent: fy("special.extrachem")
                    }))
                    let card = events.createElementWithConfig("div", {
                        classList: ["fsu-showRarityCard"]
                    })
                    card.appendChild(events.createElementWithConfig("img", {
                        src: AssetLocationUtils.getFilterImage(AssetLocationUtils.FILTER.RARITY, ec.id)
                    }))
                    card.appendChild(events.createElementWithConfig("div", {
                        textContent: SL.localize(`item.raretype${ec.id}`)
                    }))
                    card.appendChild(events.createElementWithConfig("div", {
                        textContent: ec.count,
                        classList: "fsu-showRarityCount",
                        style: {
                            color: `rgba(${chemNameColor.r},${chemNameColor.g},${chemNameColor.b},1)`
                        }
                    }))
                    item.appendChild(card)

                    let infos = events.createElementWithConfig("div", {
                        classList: "fsu-showRarityInfo"
                    })

                    let attrs = events.createElementWithConfig("div", {
                        classList: "fsu-showRarityAttrs"
                    })
                    _.forEach(info.extraChemKeys, (cKey) => {
                        if(ec[cKey] !== 0){
                            attrs.appendChild(events.createElementWithConfig("div", {
                                textContent: fy([`special.extrachem.${cKey}`, ec[cKey]])
                            }))
                        }
                    })
                    infos.appendChild(attrs);
                    item.appendChild(infos)

                    let btns = events.createElementWithConfig("div", {
                        classList: "fsu-showRarityBtns"
                    })
                    const btnText = ec.count > 0 ? fy("player.inclub") + `(${ec.count})` : fy("player.noclub");
                    let clubBtn = events.createButton(
                        new UTStandardButtonControl(),
                        btnText,
                        (_e) => {
                            let players = _.cloneDeep(events.getItemBy(2, { rareflag: ec.id, BTWrating:[99, 45], loans: -1 }, repositories.Item.getTransferItems()));
                            _.forEach(players , p => {
                                p.storeLoc = true
                            })
                            events.showPlayerListPopup(SL.localize(`item.raretype${ec.id}`), fy("special.extrachem.popupm"), players);
                        },
                        "call-to-action mini"
                    )
                    if(ec.count === 0){
                        clubBtn.setInteractionState(0);
                    }
                    btns.appendChild(clubBtn.getRootElement())
                    this._fsu[`clubBtn_${ec.id}`] = clubBtn

                    let futbinBtn = events.createButton(
                        new UTStandardButtonControl(),
                        fy("quicklist.gotofutbin"),
                        (_e) => {
                            GM_openInTab(`https://www.futbin.com/${ec.url}`, { active: true, insert: true, setParent :true });
                        },
                        "call-to-action mini"
                    )
                    btns.appendChild(futbinBtn.getRootElement())
                    this._fsu[`futbinBtn_${ec.id}`] = futbinBtn

                    item.appendChild(btns)
                    chemListBox.appendChild(item)
                })
                view.appendChild(chemListBox);
                this._fsu.chemListBox = chemListBox;
    
            }
            this.__root = view;
            this._generated = !0;
        }
    }
    specialPlayersController = function (_t) {
        EAViewController.call(this);
    };
    
    specialPlayersControllerView.prototype.dealloc = function () {
        //清除创建的资源
        events.fsuDispose(this, "_fsu")
        this.__root = null;
    }
    JSUtils.inherits(specialPlayersController, EAViewController);
    specialPlayersController.prototype._getViewInstanceFromData = function () {
        return new specialPlayersControllerView();
    };
    specialPlayersController.prototype.viewDidAppear = function () {
        this.getNavigationController().setNavigationVisibility(true, true);
    };
    specialPlayersController.prototype.getNavigationTitle = function () {
        return fy("specialtile.title");
    };
}

export { inPacksController, specialPlayersController };