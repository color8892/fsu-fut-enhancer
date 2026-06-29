export function installSectionedListPatches(deps) {
  const { call, events, info, fy, cntlr, services } = deps;
  //分个形式(拍卖行待售、待分配)球员列表 读取球员列表查询价格
UTSectionedItemListView.prototype.addItems = function(t, e, i, r) {
    call.plist.sectioned.call(this,t, e, i, r);

    events.loadPlayerInfo(_.map(this.listRows,"data"),this);

    if(info.set.player_loas && services.User.getUser().tradeAccess == TradeAccessLevel.ALLOWED && cntlr.current().getNavigationTitle() !== services.Localization.localize("navbar.label.watchlist") && (cntlr.current().getNavigationTitle() !== services.Localization.localize("navbar.label.assigncards") || repositories.Item.getPileSize(ItemPile.TRANSFER) - repositories.Item.numItemsInCache(ItemPile.TRANSFER) > 0)){
        let pn = 0,pr = {},ln = 0;
        for (let n of this.listRows) {
            if(!n.data.untradeableCount && n.data.loans == -1 && n.data.type == "player" && !n.data._auction.isClosedTrade() && !n.data._auction.isActiveTrade()){
                pn++;
                n.__root.classList.add("fsu-akb");
                n._fsuLosAuction = events.createToggle(
                    "",
                    async(e) => {
                        if(e.getToggleState()){
                            e._parent._fsuAkbCurrent++;
                            e._parent._fsuAkbArray[e._id] = e;
                        }else{
                            e._parent._fsuAkbCurrent--;
                            delete e._parent._fsuAkbArray[e._id];
                        }
                        e._parent._fsuAkbToggle.toggle(e._parent._fsuAkbCurrent == e._parent._fsuAkbNumber);
                        events.losAuctionCount(e._parent,1)
                    },
                    ""
                )
                n._fsuLosAuction.toggle(1);
                n._fsuLosAuction._parent = this;
                pr[n.data.id] = n._fsuLosAuction;
                n._fsuLosAuction._id = n.data.id;
                n._fsuLosAuction._pId = n.data.definitionId;
                n._fsuLosAuction._l = ln;
                n._fsuLosAuction.setInteractionState(0);
                n.__root.insertBefore(n._fsuLosAuction.__root,n.__root.firstChild)
            }
            ln++;
        }
        if(pn){
            let b = document.createElement("div");
            b.classList.add("fsu-akb-left");
            this._fsuAkbToggle = events.createToggle(
                fy("losa.all"),
                async(e) => {
                    let sf = e.getToggleState() ? true : false;
                    e._parent._fsuAkbCurrent = sf ? e._parent._fsuAkbNumber : 0;
                    e._parent._fsuAkbArray = {};
                    for (let n of e._parent.listRows) {
                        if(n.hasOwnProperty("_fsuLosAuction") && n._fsuLosAuction._interactionState){
                            n._fsuLosAuction.toggle(sf)
                            if(sf){
                                if(n.hasOwnProperty("_fsuLosAuction")){
                                    if(events.getCachePrice(n._fsuLosAuction._pId,1).text){
                                        e._parent._fsuAkbArray[n._fsuLosAuction._id] = n._fsuLosAuction;
                                    }
                                }
                            }
                        }
                    }
                    events.losAuctionCount(e._parent,1)
                },
                ""
            )
            this._fsuAkbToggle.toggle(1);
            this._fsuAkbToggle.setInteractionState(0);
            this._fsuAkbToggle._parent = this;
            b.appendChild(this._fsuAkbToggle.__root);

            let bnd = document.createElement("div");
            bnd.insertAdjacentHTML('beforeend', `${fy("losa.select")} `);
            let bns = document.createElement("span");
            bns.classList.add("fsu-akb-num");
            bns.innerText = `${pn}`;
            bnd.appendChild(bns);
            bnd.insertAdjacentHTML('beforeend', `/`);
            let bnn = document.createElement("span");
            bnn.classList.add("fsu-akb-max");
            bnn.innerText = `${pn}`;
            bnd.appendChild(bnn);
            b.appendChild(bnd);

            let bpd = document.createElement("div");
            bpd.insertAdjacentHTML('beforeend', `${fy("losa.price")} `);
            let bpp = document.createElement("span");
            bpp.classList.add("fsu-akb-price","currency-coins");
            bpp.innerText = `0`;
            bpd.appendChild(bpp);
            b.appendChild(bpd);
            this._fsuAkbArray = pr;
            this._fsuAkbCurrent = pn;
            this._fsuAkbNumber = pn;
            this._fsuAkb = document.createElement("div");
            this._fsuAkb.classList.add("fsu-akb-title");
            this._fsuAkb.appendChild(b);

            this._fsuAkbButton = events.createButton(
                new UTStandardButtonControl(),
                fy("loas.button"),
                (e) => {
                    events.popup(
                        fy("loas.popupt"),
                        fy(["loas.popupm",e._parent._fsuAkb.querySelector(".fsu-akb-num").innerText,e._parent._fsuAkb.querySelector(".fsu-akb-price").innerText]),
                        (t,i) => {
                            if(t === 2){
                                //24.18 插入批量拍卖时间校正
                                let v = Number(i.getValue()),vAudit = [0,1,3,6,12,24,72]
                                if(!_.isNaN(v) && _.includes(vAudit,v)){
                                    events.losAuctionSell(e,v);
                                }else{
                                    events.notice(fy("loas.input.error"),2)
                                }
                            }
                        },
                        false,
                        fy("loas.input"),
                        true,
                        fy("loas.input.tips")
                    )
                },
                "btn-standard section-header-btn mini",
            )
            this._fsuAkbButton.setInteractionState(0);
            this._fsuAkbButton._parent = this;

            this._fsuAkb.appendChild(this._fsuAkbButton.__root);
            this._header.__root.after(this._fsuAkb);
            const playerIds = _.chain(this.listRows).filter(row => row.data.type === 'player' && !events.getCachePrice(row.data.definitionId, 3)).map(row => row.data.definitionId).value();
            if(playerIds.length == 0){
                events.losAuctionCount(this,0);
            }
        }
    }
}
}
