export function installPlayerItemPatch(deps) {
  const { call, events, fy, cntlr, info, lock } = deps;

  UTPlayerItemView.prototype.renderItem = function (p, t) {
      call.view.card.call(this, p, t);
      if (p.isValid()) {
          setTimeout(() => {
              if(this.__root === null){
                  //空白元素停止加载信息
                  return;
              }

              this._fsu ??= {};

              const parentNode = this.__root.parentNode;
              const pid = Number(this.__root.querySelector("span[p-id]")?.getAttribute("p-id"));
              const idx = Number(parentNode?.getAttribute("index")) || 0;

              if (pid === p.id) {
                  if (this._fsu.squadIndex === idx) return;
                  this._fsu.squadIndex = idx;
              }

              const unassignedIds = _.map(repositories.Item.unassigned.values(),"duplicateId");
              const isSmall = this.__root.classList.contains("small");

              //卡片样式 0新版 1旧版
              let stc = info.set.card_style == 1 ? "old" : "new" ;
              let ct = t.getExpColorMap(p.getTier());
              const cardColor = info.set.card_style == 1 ? `rgb(255,255,255)` : `rgb(${ct.name.r},${ct.name.g},${ct.name.b})`;
              const cardBackground = info.set.card_style == 1 ? `rgb(0,64,166)` : `rgb(${ct.background.r},${ct.background.g},${ct.background.b})`; 

              //位置区块添加

              let otherPos = p.possiblePositions.filter((z) => {return z !== p.preferredPosition}).map((z) => {return UTLocalizationUtil.positionIdToName(z, services.Localization)})

              let controller = cntlr.current();

              let posElement = events.createElementWithConfig("div",{
                  classList:["fsu-cards","fsu-cards-pos",stc],
                  var:{
                      '--fsu-cards-background': cardBackground,
                      '--fsu-cards-color': cardColor,
                  },
                  attributes:{
                      "data-id":p.id
                  }
              })
              posElement.innerHTML = events.normalizePositions(otherPos).map((z) => {return `<div>${z}</div>`}).join(``);
              this._fsu.pos = posElement;

              //额外属性区块
              let extraElement = events.createElementWithConfig("div",{
                  classList:["fsu-cards","fsu-cards-attr",stc],
                  var:{
                      '--fsu-cards-foot-color': cardColor,
                      '--fsu-cards-background': cardBackground,
                      '--fsu-cards-color': cardColor,
                  }
              })
              let footElement = events.createElementWithConfig("div",{
                  classList:["fsu-cards-foot",p.isLeftFoot() ? "l" : "r"],
                  innerHTML:`<span>${p.getSkillMoves()}/${p.getWeakFoot()}</span>`
              })
              extraElement.appendChild(footElement);

              // 25.22 非门将位置加速类型显示
              if(!p.isGK() && !isSmall){
                  const isLoadMeta = services.PlayerMetaData.metaDAO.metaRepo.has(p.definitionId);
                  let accele = events.createButton(
                      new UTButtonControl(),
                      events.getAcceleRate(p) + `${isLoadMeta ? "" : "*"}`,
                      async(e) => {
                          events.accelePopup(p)
                      },
                      "fsu-cards-accele"
                  )
                  accele.getRootElement().setAttribute("data-defid",p.definitionId);
                  accele.getRootElement().style.cursor = `pointer`;
                  this._fsu.accele = accele;
                  extraElement.appendChild(accele.getRootElement());
              }

              let bodyTypeId = info.playermeta?.[p.databaseId]?.badytype || 0;
              if(bodyTypeId){
                  let bodytype = events.createButton(
                      new UTButtonControl(),
                      "",
                      async(e) => {
                          events.popup(
                              fy("plyers.bodytype.popupt"),
                              fy(["plyers.bodytype.popupm",info.bodytypetext[bodyTypeId],fy(`players.bodytype_${bodyTypeId}`)]),
                              (t) => {
                              }
                          )
                      },
                      "fsu-bodytype"
                  )
                  bodytype.getRootElement().style.cursor = `pointer`;
                  bodytype.getRootElement().innerHTML = _.replace(info.bodytypetext[bodyTypeId], '&', `<span style='font-size:80%'>&</span>`);
                  this._fsu.bodytype = bodytype;
                  extraElement.appendChild(bodytype.getRootElement());
              }
              this._fsu.extra = extraElement;

              if(!isSmall){
                  let realFace = info.playermeta?.[p.databaseId]?.realface || 0;
                  this._fsu.realFace = events.createButton(
                      new UTButtonControl(),
                      realFace == 1 ? "YES" : "NO",
                      async(e) => {
                          events.notice(fy(["notice.players.realface", p._staticData.name, fy(`players.realface_${realFace}`)]), realFace == 1 ? 0 : 2);
                      },
                      ""
                  )
                  extraElement.appendChild(this._fsu.realFace.getRootElement());
              }

              //24.18 可进化标识：计算展现标识数据
              //26.04 修改为新方法
              if(p.loans === -1){
                  const academyIds = info.academy
                      .filter(a => a.practical && a.el.every(t => t.meetsRequirements(p)))
                      .map(a => a.id);
                  if(academyIds.length){
                      this._fsu.academyTips = events.createElementWithConfig("div", {
                          innerHTML: `<span class="fsu-academytips-icon"></span><span>${academyIds.length}</span>`,
                          classList:["fsu-academytips"],
                      })
                      this._fsu.academyIds = academyIds;
                      extraElement.appendChild(this._fsu.academyTips);
                  }
              }


              //价格区块
              //25.22 简化重写价格区块显示逻辑
              const ppValue = events.getCachePrice(p.definitionId,1);
              const ppInCache = events.getCachePrice(p.definitionId,3);
              const tradableClass = p.untradeableCount ? "untradeable" : "tradable";
              const priceElementType = ppInCache ? info.priceType[ppValue.type] : "ut";

              let priceElement = events.createElementWithConfig("div", {
                  classList:["fsu-PriceBar", "fsu-cards"],
              });

              let priceItemElement = events.createElementWithConfig("div", {
                  classList:["fsu-PriceBarItem", "priceItem",  tradableClass ],
                  attributes: {
                      'data-show': ppInCache ? 1 : 0,
                  },
              });
              priceElement.appendChild(priceItemElement)
              priceItemElement.appendChild(
                  events.createElementWithConfig("div", {
                      classList:["fsu-PriceValue"],
                      textContent: ppValue.text
                  })
              )
              priceItemElement.appendChild(
                  events.createElementWithConfig("div", {
                      classList:["fsu-PriceType"],
                      textContent: priceElementType,
                      attributes: {
                          'data-content': priceElementType,
                      },
                  })
              )
              
              this._fsu.price = priceElement;
              this._fsu.priceItem = priceItemElement;

              this._fsu.ratingBackground = events.createElementWithConfig("div",{
                  textContent: p.rating,
                  classList: ["fsu-cards-rating", "fsu-cards"],
                  style: {
                      color: info.set.card_style == 1 ? `rgb(0,64,166)` : `rgb(${ct.dividers.r},${ct.dividers.g},${ct.dividers.b})`
                  }
              })


              let priceBoxElement = events.createElementWithConfig("div",{
                  classList:["fsu-PriceRightBox", "fsu-cards"],
              });
              let priceBoxItemElement = events.createElementWithConfig("div",{
                  classList:["fsu-PriceRightItem", "priceItem", tradableClass ],
                  attributes: {
                      'data-show': ppInCache ? 1 : 0,
                  },
              });
              priceBoxElement.appendChild(priceBoxItemElement)
              priceBoxItemElement.appendChild(
                  events.createElementWithConfig("div", {
                      classList:["fsu-PriceRightBoxTitle"],
                      textContent: fy("price.now")
                  })
              )
              let priceBoxPriceBar =events.createElementWithConfig("div", {
                  classList:["fsu-PriceRightBoxBar"],
              })
              priceBoxItemElement.appendChild(priceBoxPriceBar)
              priceBoxPriceBar.appendChild(
                  events.createElementWithConfig("div", {
                      classList:["fsu-PriceValue"],
                      textContent: ppValue.text
                  })
              )
              priceBoxPriceBar.appendChild(
                  events.createElementWithConfig("div", {
                      classList:["fsu-PriceType"],
                      textContent: priceElementType,
                      attributes: {
                          'data-content': priceElementType,
                      },
                  })
              )
              
              if(p.lastSalePrice){
                  let priceBoxLastItemElement = priceBoxItemElement.cloneNode(true);
                  priceBoxLastItemElement.setAttribute("data-show", 1);
                  priceBoxLastItemElement.classList.remove("untradeable");
                  priceBoxLastItemElement.querySelector(".fsu-PriceRightBoxTitle").textContent = fy("price.last");
                  priceBoxLastItemElement.querySelector(".fsu-PriceValue").textContent = p.lastSalePrice.toLocaleString();
                  let typeElement = priceBoxLastItemElement.querySelector(".fsu-PriceType");
                  typeElement.textContent = "ut";
                  typeElement.setAttribute("data-content", "ut");
                  priceBoxElement.prepend(priceBoxLastItemElement);
                  this._fsu.priceBoxLastItem = priceBoxLastItemElement;
              }

              this._fsu.priceBoxBar = priceBoxPriceBar;
              this._fsu.priceBoxItem = priceBoxItemElement;
              this._fsu.priceBox = priceBoxElement;

              

              


              //26.04 插入info.roster.element 来替换价格
              if(!ppInCache){
                  info.roster.element[p.definitionId] ??= [];
                  priceItemElement.setAttribute("data-rating", p.rating)
                  priceItemElement.setAttribute("data-rareflag", p.rareflag)
                  info.roster.element[p.definitionId].push(priceItemElement);
                  info.roster.element[p.definitionId].push(priceBoxItemElement);

              }


              let plow = info.base.price.hasOwnProperty(p.rating) && p.rating > info.base.price.low && p.rating < info.base.price.high ? `<div class="fsu-other-low currency-coins">${p.rating} Min: ${Number(info.base.price[p.rating]).toLocaleString()}</div>` : `<span class="fsu-other-low"></span>`;

              let pOtherPos = otherPos.length ? `<div class="fsu-other-pos">${otherPos.join(" / ")}</div>` : `<span class="fsu-other-pos"></span>`;

              let pd = "";

              let pe = -1,sp = events.getItemBy(2,{"definitionId":p.definitionId});
              if(sp.length == 1){
                  pe = sp[0].untradeableCount ? 0 : 1;
              }
              if(p.duplicateId){
                  if(services.Item.itemDao.itemRepo.club.items._collection.hasOwnProperty(p.duplicateId)){
                      pe = services.Item.itemDao.itemRepo.club.items._collection[p.duplicateId].untradeableCount ? 0 : 1;
                  }
              }else{
                  if(info.roster.thousand.hasOwnProperty(p.definitionId)){
                      pe = info.roster.thousand[p.definitionId].untradeableCount ? 0 : 1;
                  }
              }
              if(pe == -1){
                  if(p.duplicateId !== 0){
                      pd = `<div class="fsu-other-dup">${fy("duplicate.nodata")}</div>`;
                  }else{
                      pd = `<div class="fsu-other-dup swap">${fy("duplicate.swap")}</div>`;
                  }
              }else if(pe == 0){
                  pd = `<div class="fsu-other-dup not">${fy("duplicate.not")}</div>`;
              }else{
                  pd = `<div class="fsu-other-dup yes">${fy("duplicate.yes")}</div>`;
              }

              let otherElement = events.createElementWithConfig("div", {
                  innerHTML: `${pd}${pOtherPos}${plow}`,
                  classList: ["fsu-player-other", "fsu-cards"]
              })
              this._fsu.other = otherElement;

              
              if(info.set.card_meta){
                  let playerFG = events.fgCalc(p);
                  let metaElement = events.createButton(
                      new UTButtonControl(),
                      "",
                      async(e) => {
                          events.fgPopup(p);
                      },
                      "item fsu-cards fsu-cards-meta"
                  )
                  metaElement.getRootElement().setAttribute("data-id",p.id);
                  metaElement.getRootElement().setAttribute("data-defid",p.definitionId);
                  events.fgCreateElment(metaElement.getRootElement(), playerFG);
                  this._fsu.meta = metaElement;
                  
                  if(isSmall){
                      let metaRating = events.createElementWithConfig("div", {
                          textContent: playerFG.grade,
                          classList:["fsu-cards-metarating"],
                          attributes:{
                              "data-id": p.id,
                              "data-defid": p.definitionId,
                          }
                      })
                      this._fsu.metaRating = metaRating;
                      extraElement.prepend(metaRating);
                  }
              }
              if(info.set.card_meta && [1, 2].includes(info.apiPlatform) && false){
                  let playerGGR = events.getPlayerGGR(p);
                  playerGGR["textColor"] = "#0f1010";
                  if(info.set.card_style == 1){
                      playerGGR.gradeColor = `rgb(0,64,166)`;
                      playerGGR.textColor = "#fcfcf7";
                  }
                  let metaElement = events.createButton(
                      new UTButtonControl(),
                      "",
                      async(e) => {
                          GM_openInTab(`https://www.fut.gg/players/${p.databaseId}/${info.base.year}-${p.definitionId}/`, { active: true, insert: true, setParent :true });
                      },
                      "item fsu-cards fsu-cards-meta"
                  )
                  this._fsu.meta = metaElement;
                  metaElement.getRootElement().setAttribute("data-id",p.id);
                  metaElement.getRootElement().setAttribute("data-defid",p.definitionId);
                  metaElement.getRootElement().style.borderColor = playerGGR.gradeColor;
                  let mRk = events.createElementWithConfig("div", {
                      textContent:playerGGR.grade,
                      style:{
                          color:playerGGR.textColor,
                          backgroundColor:playerGGR.gradeColor,
                          lineHeight:`1.1rem`,
                      },
                      classList:["mrk"],
                  })
                  metaElement.getRootElement().appendChild(mRk)
                  let mPr = events.createElementWithConfig("div", {
                      textContent:playerGGR.scoreText,
                      classList:["mpr"],
                  })
                  metaElement.getRootElement().appendChild(mPr)
                  let mRp = events.createElementWithConfig("div", {
                      textContent:playerGGR.posText,
                      classList:["mrp"],
                  })
                  metaElement.getRootElement().appendChild(mRp)
                  if(isSmall){
                      let metaRating = events.createElementWithConfig("div", {
                          textContent:playerGGR.grade,
                          classList:["fsu-cards-metarating"],
                          attributes:{
                              "data-id":p.id,
                              "data-defid":p.definitionId,
                          }
                      })
                      this._fsu.metaRating = metaRating;
                      extraElement.prepend(metaRating);
                      if(playerGGR.score === 0){
                          metaRating.style.display = "none";
                          metaElement.getRootElement().style.display = "none";
                      }
                  }
              }

              //26.04 添加特殊品质的显示按钮
              if(info.specialPlayers?.DList?.includes(p.rareflag) || info.specialPlayers?.ECList?.includes(p.rareflag)){
                  this._fsu.special = events.createButton(
                      new UTButtonControl(),
                      "",
                      async(e) => {
                          events.noticeSpecialPlayerInfo(p);
                      },
                      "fsu-specialPlayer"
                  )
                  this._fsu.special.getRootElement().innerHTML = `<i class="fut_icon icon_chevron"></i>`;
                  if(isSmall){
                      this._fsu.special.setInteractionState(0)
                  }else{
                      this._fsu.special.getRootElement().style.cursor = `pointer`;
                  }
                  extraElement.prepend(this._fsu.special.getRootElement());
              }

              let pId = p.id ? p.id : p.definitionId;
              let playerLock = info.lock.includes(p.id);
              if(!this.__root) return;
              if(!this.__root.querySelector("span[p-id]")){
                  if(parentNode?.classList.contains("ut-squad-slot-view")){
                      this._fsu.squadIndex = Number(parentNode?.getAttribute("index")) || 0;
                  }
                  this._fsu.pId = events.createElementWithConfig("span",{
                      sytle: {
                          display: "none"
                      },
                      attributes:{
                          "p-id": pId
                      }
                  })
                  this.__root.append(this._fsu.pId);
              }else{
                  this.__root.querySelector("span[p-id]").setAttribute('p-id',pId);
              }
              if(parentNode && !parentNode.classList.contains("CompareDetails")){
                  parentNode.querySelectorAll(".fsu-cards:not(.reserve)").forEach(e => e.remove());
              }
              
              if(isSmall){
                  let sp = `span[p-id="${pId}"]`;
                  let pm = {
                      1:`.itemList > .listFUTItem.won ${sp}`,
                      2:`.itemList > .listFUTItem.has-auction-data ${sp}`,
                      3:`.itemList > .listFUTItem ${sp}`,
                      //拍卖行
                      4:`.ut-navigation-container-view.ui-layout-right .SearchResults .paginated-item-list .listFUTItem.has-auction-data ${sp}`,
                      7:`.SearchResults .paginated-item-list .listFUTItem.has-auction-data ${sp}`,
                      //替换球员上部
                      5:`.ut-pinned-item.has-iterator .listFUTItem ${sp}`,
                      //比较价格上部
                      6:`.ut-pinned-item .listFUTItem ${sp}`,
                      //比较价格
                      //普通样式
                      8:`.ut-club-search-results-view .paginated-item-list .listFUTItem ${sp}`,
                      //俱乐部

                      10:`.paginated-item-list .listFUTItem ${sp}`,
                      21:`.ut-squad-pitch-view.sbc ${sp}`,
                      22:`.ut-squad-pitch-view ${sp}`,
                      23:`.ut-squad-slot-dock-view.sbc ${sp}`,
                      24:`.ut-squad-slot-dock-view ${sp}`,
                      25:`.reward.small ${sp}`,
                      31:`.player-pick-option .small  ${sp}`
                  }
                  let cs = 0;
                  for (let i in pm) {
                      if(document.querySelector(pm[i])){
                          if(!document.querySelector(pm[i]).parentNode.querySelectorAll(".fsu-cards").length){
                              cs = Number(i);
                              break
                          }
                      }
                  }
                  if(cs == 7 && document.querySelector(".icon-transfer.selected")) cs = 12;
                  if(cs == 8 && (document.querySelector(".icon-club.selected") || document.querySelector(".fsu-aotobuy"))) cs = 9;
                  if(cs == 2 && controller.className == "UTWatchListViewController") cs = 11;
                  if(cs == 8 && controller.className == "UTAcademyPlayerFromClubViewController") cs = 3;
                  if(cs == 6 && document.querySelector(".fsu-autobuy-right")) cs = 13;

                  //修复进化预览价格覆盖的问题
                  //有问题需要判定，是进化页面再修改
                  if(isPhone() && cs === 3){
                      cs = 8;
                  }
                  //debug.log(cs)
                  if(cs !== 0){
                      priceElement.setAttribute('data-cs',cs);
                      priceBoxElement.setAttribute('data-cs',cs);
                      
                      let parentElement = this.getRootElement().parentNode;

                      if(bodyTypeId){
                          this._fsu.bodytype.setInteractionState(0)
                      }

                      //位置区块添加
                      //额外属性区块
                      if(![31].includes(cs)){
                          this.__root.after(extraElement);
                          //26.04 移除部分界面name部分的内边距
                          if([8].includes(cs)){
                              extraElement.classList.add("fsu-removeNamePadding")
                          }
                      }
                      if(cs == 25){
                          Object.assign(posElement.style, {
                              top: "36%",
                              left: "calc(50% - 52px)",
                              fontSize: "8px",
                          });
                          Object.assign(extraElement.style, {
                              top: "36%",
                              left: "calc(50% + 30px)",
                              fontSize: "8px",
                          });
                      }
                      if([21,22,23,24,25].includes(cs)){
                          this.__root.after(posElement);
                          if([21,23].includes(cs) && info.lock.includes(pId)){
                              let cardLock = document.createElement("div");
                              cardLock.classList.add("fsu-cards","fsu-cardlock");
                              this.__root.after(cardLock);
                          }
                      }
                      if([5,21,22,23,24,25,31].includes(cs)){
                          if(cs == 21){
                              const posElement = this.__root.parentElement.querySelector(".ut-squad-slot-pedestal-view");
                              if(posElement){
                                  // 25.22 添加阵容直接移除球员按钮
                                 this._fsu.removeBtn = events.createButton(
                                      new UTImageButtonControl(),
                                      "",
                                      (e) => {
                                          events.showLoader();
                                          let newSquad = _.cloneDeep(_.last(cntlr.current()._squad._fsu.oldSquad));
                                          newSquad = _.map(newSquad, (item) => {
                                              return item.id === p.id ? new UTItemEntity() : item;
                                          });
                                          let challengeId = isPhone() ? cntlr.current()._challenge.id : cntlr.current()._challengeId;
                                          events.saveSquad(cntlr.current()._set.challenges.get(challengeId),cntlr.current()._squad,newSquad);
                                          events.saveOldSquad(cntlr.current()._squad,false);
                                      },
                                      "fsu-cards exit-btn"
                                  )
                                  Object.assign(this._fsu.removeBtn.getRootElement().style, {
                                      margin: "-6px",
                                      fontSize: "12px",
                                  })
                                  posElement.appendChild(this._fsu.removeBtn.getRootElement())
                              }
                              if(!p.untradeableCount){
                                  let uP = _.find(repositories.Item.getUnassignedItems(), (item) => item.definitionId === p.definitionId);
                                  if(uP && uP.untradeableCount){
                                      priceElement.classList.add("fsu-unassigned")
                                  }
                              }

                              //珍贵球员判断
                              if(ppInCache && events.isPrecious(p.rating, p.rareflag, ppValue.num, ppValue.type)){
                                  priceItemElement.classList.add("precious");
                              }
                              //添加给元素判断珍贵球员
                              priceItemElement.setAttribute("data-cs", cs)
                          }
                          this.__root.prepend(priceElement);
                      }else{
                          if([1,2,12,11].includes(cs)){
                              priceBoxElement.classList.add("top");
                              if(isPhone()){
                                  this.getRootElement().parentNode.querySelector(".name").style.width = "25%";
                              }
                          }
                          if([2, 11, 12].includes(cs)){
                              parentNode.append(priceBoxElement);
                          }else if([6,8,7,4,13].includes(cs)){
                              this.__root.prepend(priceElement);
                          }else{
                              this.__root.after(priceBoxElement);
                          }

                          if(cs == 12 || cs == 6) otherElement.querySelector(".fsu-other-low").remove();
                          if(cs == 1 || cs == 8  || cs == 9 || cs == 13) otherElement.querySelector(".fsu-other-dup").remove();
                          if(![7,4].includes(cs)){
                              parentNode.append(otherElement);
                          }
                          if(cs == 13 && info.autobuy.infoViews[p.definitionId]){
                              debug.log(info.autobuy.infoViews[p.definitionId].goToSalesBtn,info.autobuy.infoViews[p.definitionId].setPriceBtn)
                              parentElement.querySelector(".fsu-autobuy-btn").remove();
                              parentElement.appendChild(info.autobuy.infoViews[p.definitionId]._cardBtnBox)
                          }
                      }
                      if([8,9].includes(cs) && playerLock){
                          parentElement.querySelector(".name").classList.add("fsulocked")
                      }


                      if(controller.className.includes("UTSBCSquad") && cs == 21){
                          //阵容刷新后购买失败标识添加
                          if("_fsuBuyEroor" in controller._squad && controller._squad._fsuBuyEroor.includes(pId) && p.concept){
                              if(parentElement.querySelector(".fsu-cards-buyerror") == null){
                                  parentElement.insertBefore(events.getCardTipsHtml(1), this.getRootElement());
                              }
                          }

                          //25.02 添加SBC仓库标识
                          if(!p.concept && repositories.Item.storage.get(p.id)){
                              if(parentElement.querySelector(".fsu-cards-storage") == null){
                                  parentElement.insertBefore(events.getCardTipsHtml(2), this.getRootElement());
                              }
                          }

                          //25.22 添加未分配列表图标
                          if(!p.concept && _.includes(unassignedIds,p.id)){
                              if(parentElement.querySelector(".fsu-cards-unassigned") == null){
                                  parentElement.insertBefore(events.getCardTipsHtml(3), this.getRootElement());
                              }
                          }
                      }

                      //25.21 开包后处理位置显示
                      //26.04 调整显示的逻辑
                      if (cs === 3 && _.has(p, "storeLoc")) {
                          const dup = otherElement.querySelector(".fsu-other-dup");
                          if (dup) {
                              dup.className = "fsu-other-dup";
                              if(p.pile == ItemPile.TRANSFER){
                                  dup.classList.add("yes");
                                  dup.innerText = info.base.localization[`navbar.label.tradepile`];
                              }else if(p.pile == ItemPile.STORAGE){
                                  dup.classList.add("storage");
                                  dup.innerText = fy(`storage.tile`);
                              }else{
                                  dup.classList.add("swap");
                                  dup.innerText = info.base.localization[`nav.label.club`];
                              }
                          }
                      }

                      //25.24 在奖励卡添加GGR
                      if(cs == 25 && _.has(this,"_fsuCardMeta")){
                          this._fsu.meta.getRootElement().style.height = ".8rem";
                          this._fsu.meta.getRootElement().style.fontSize = ".6rem";
                          this.__root.after(this._fsu.meta.getRootElement());
                          priceElement.style.fontSize = ".8rem";
                          priceElement.style.marginTop = ".2rem";
                      }
                  }

              }else{
                  let cardParen = this.__root.parentElement;
                  if(!cardParen){
                      return;
                  }
                  let isCompare = false;
                  if(document.querySelector(`.CompareDetails .large.player span[p-id="${pId}"]`) && info.set.card_meta && [1, 2].includes(info.apiPlatform) && false){
                      isCompare = true;
                      extraElement.classList.add("reserve")
                      this._fsu.meta.getRootElement().classList.add("reserve");
                  }
                  //24.18 修复锁定按钮显示不了的问题
                  if(p.loans == -1 && !p.concept && p.state == ItemState.FREE && !p.isDuplicate() && events.getItemBy(1,{"id":p.id}).length && !isCompare){
                      let lockElement = events.createButton(
                          new UTStandardButtonControl(),
                          playerLock ? fy("locked.unlock") : fy("locked.lock"),
                          (e) => {
                              lock.save(e.id);
                              let playerLock = info.lock.includes(e.id);
                              e.setText(playerLock ? fy("locked.unlock") : fy("locked.lock"));
                              e.getRootElement().classList.remove("unlock","lock");
                              e.getRootElement().classList.add(playerLock ? "unlock" : "lock");
                              if(!isPhone()){
                                  if("_fsuLock" in cntlr.left()){
                                      cntlr.left()._requestItems(false);
                                      cntlr.left().refreshList();
                                  }
                              }
                          },
                          `fsu-cards fsu-lockbtn ${playerLock ? "unlock" : "lock"} ${isPhone() ? "" : "mini"}`
                      )
                      this._fsu.lock = lockElement;
                      lockElement.id = p.id;
                      cardParen.insertBefore(lockElement.getRootElement(),cardParen.firstChild)
                  }
                  if(cardParen.querySelectorAll(".player").length > 1){
                      if(!isCompare){
                          this.__root.prepend(posElement);
                      }
                      this.__root.prepend(extraElement);
                  }else{
                      this.__root.after(posElement);
                      this.__root.after(extraElement);
                      if(parentNode.style.position == ""){
                          parentNode.style.position = "relative"
                      }
                  }
                  this.__root.prepend(priceElement);


                  if(this._fsu?.meta){
                      this.__root.after(this._fsu.meta.getRootElement());
                  }
                  if(cardParen.classList.contains('player-pick-option')){
                      cardParen.style.position = "relative";
                      cardParen.style.padding = "0 1.2rem";
                      otherElement.querySelector(".fsu-other-low").remove();
                      otherElement.querySelector(".fsu-other-pos").remove();
                      if(!isPhone()){
                          this._fsu.meta.getRootElement().style.bottom = "1.4rem";
                      }else{
                          this._fsu.meta.getRootElement().style.bottom = "4rem";
                      }
                      this.__root.after(otherElement)
                  }

                  //25.02 奖励大卡片状态下meta上移
                  if(cardParen.classList.contains('reward')){
                      this._fsu.meta.getRootElement().style.bottom = "2.2rem";
                  }



                  //大卡预览处增加购买失败描述
                  if("_squad" in controller && "_fsuBuyEroor" in controller._squad && controller._squad._fsuBuyEroor.includes(pId) && p.concept && cardParen.classList.contains("tns-item")){
                      if(cardParen.querySelector(".fsu-cards-buyerror") == null){
                          this.getRootElement().appendChild(events.getCardTipsHtml(1))
                      }
                  }

                  //25.02 大卡预览增加SBC仓库标识
                  if(!p.concept && repositories.Item.storage.get(p.id)){
                      if(cardParen.querySelector(".fsu-cards-storage") == null){
                          this.getRootElement().appendChild(events.getCardTipsHtml(2))
                      }
                  }

                  //25.22 大卡预览添加未分配列表图标
                  //26.02 修复图标不显示的问题
                  if(!p.concept && _.includes(unassignedIds,p.id)){
                      if(cardParen.querySelector(".fsu-cards-unassigned") == null){
                          this.getRootElement().appendChild(events.getCardTipsHtml(3))
                      }
                  }

                  //战术编辑处调整大卡片的属性显示错误。
                  if((cardParen.classList.contains("ut-tactics-instruction-menu-view--item-container") || cardParen.classList.contains("main-reward")) && cardParen.classList.length === 1){
                      cardParen.style.position = "relative";
                  }

                  //25.24 SBC或奖励页面添加已拥有标识
                  if(cardParen.classList.contains("main-reward") && cardParen.classList.length === 1){
                      
                  }

                  //25.01 战术编辑处角色调整
                  if(cardParen.classList.contains("ut-tactics-role-menu-view--item-container")){

                      extraElement.style.left = "auto";
                      extraElement.style.right = ".2rem";

                      posElement.style.left = "auto";
                      posElement.style.right = "124px";

                      lockElement.getRootElement().style.display = "none";

                      this._fsu.meta.getRootElement().style.left = "auto";
                      this._fsu.meta.getRootElement().style.right = "1rem";
                      this._fsu.meta.getRootElement().style.setProperty('transform', 'translateX(0)', 'important');
                      this._fsu.meta.getRootElement().style.setProperty('-webkit-transform', 'translateX(0)', 'important');

                  }
                  
                  //26.02 调整进化页面预览效果隐藏评分
                  //26.04 调整进化左右两侧位置显示
                  //26.07 进化评分预览变化
                  if(cardParen.querySelector(".ut-academy-slot-item-details-view--carousel-label")){
                      events.fgCreateElment(this._fsu.meta.getRootElement(), events.fgCalc(p, true, false));
                      this._fsu.extra.style.top = "15%";
                      this._fsu.pos.style.top = "15%";
                  }
              }

              
              this.__root.appendChild(this._fsu.ratingBackground);
              if(!info.set.card_pos){
                  posElement.remove();
              }
              if(!info.set.card_price){
                  priceBoxElement.remove();
                  priceElement.remove();
              }
              if(!info.set.card_other){
                  extraElement.remove();
              }
              if(!info.set.card_low){
                  otherElement.querySelector(".fsu-other-low")?.remove();
              }
              if(!info.set.card_club){
                  otherElement.querySelector(".fsu-other-dup")?.remove();
              }
          }, 10);
      };
  };

}
