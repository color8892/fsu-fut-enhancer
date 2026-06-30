export function installUnassignedPatches(deps) {
  const { call, events, fy, cntlr, info } = deps;

  UTUnassignedItemsViewController.prototype.updateUntradeableDuplicateSectionOptions = function (...args) {
      call.view.unassignedUpdateUDSO.call(this, ...args);
      let section = this.getView().getSection(UTUnassignedItemsViewModel.SECTION.UNTRADABLEDUPLICATES);
      if(section && this.viewmodel){
          if("_fsuSendClubCount" in section){
              section._header.__subtext.appendChild(section._fsuSendClubCount)
          }
      }
      //25.24 卡重复自动刷新
      const duplicateIds = _.filter(
          _.map(this.viewmodel.values(), "duplicateId"),
          id => id !== 0
      );
      if(duplicateIds.length && duplicateIds.length !== events.getItemBy(2,{"id":duplicateIds}).length && section && !this.getView().getSection(UTUnassignedItemsViewModel.SECTION.ITEMS) && !this.getView().getSection(UTUnassignedItemsViewModel.SECTION.DUPLICATES) && _.has(section,"_fsuGoToStorage")){
          const controller = this;
          section._fsuRefreshBtn = events.createButton(
              new UTStandardButtonControl(),
              fy("unassignedlist.refresh.btn"),
              async (_e) => {
                  await services.Item.itemDao.itemRepo.unassigned.reset();
                  await controller.getUnassignedItems();
                  events.notice("notice.uasreset", 0);
              },
              "call-to-action mini"
          )
          section._fsuRefreshBtn.getRootElement().style.marginLeft = ".5rem";
          section._fsuGoToStorage.getRootElement().after(section._fsuRefreshBtn.getRootElement())
      }
  }
  //25.02 未分配快捷按钮添加
  UTUnassignedItemsView.prototype.renderSection = function(e, t, i) {
      call.view.unassignedRenderSection.call(this,e,t,i);
      let section = this.sections[t];
      let controller = _.find(this.eventDelegates, ed => {
          return ed.className && ed.className.includes('UTUnassigned') && ed.className.includes('Controller');
      });
      if(t == UTUnassignedItemsViewModel.SECTION.ITEMS){
          let tradable = _.filter(e,i => {
              return i.loans == -1 && i.type == "player" && !i.untradeableCount
          })
          if(tradable.length){
              if(!(_.has(section,"_fsuTransfer"))){
                  section._fsuTransfer = events.createButton(
                      new UTImageButtonControl(),
                      "",
                      async(_e) => {
                          controller.sendStorablesToTransferList();
                      },
                      "filter-btn fsu-transfer"
                  )
                  section._header.getRootElement().appendChild(section._fsuTransfer.getRootElement())
              }
          }
          let toClubPlayers = _.filter(e,i => {
              return i.loans == -1 && i.type == "player"
          })
          if(toClubPlayers.length && !(_.has(section,"_fsuClub"))){
              section._fsuClub = events.createButton(
                  new UTImageButtonControl(),
                  "",
                  async(_e) => {
                      controller.storeInClub();
                  },
                  "filter-btn fsu-club"
              )
              section._header.getRootElement().appendChild(section._fsuClub.getRootElement())
          }
      }

      if(t == UTUnassignedItemsViewModel.SECTION.DUPLICATES){
          let players = _.filter(e,i => {
              return i.loans == -1 && i.type == "player"
          })
          if(players.length){
              if(!(_.has(section,"_fsuTransfer"))){
                  section._fsuTransfer = events.createButton(
                      new UTImageButtonControl(),
                      "",
                      async(_e) => {
                          controller.sendDuplicatesToTransferList();
                      },
                      "filter-btn fsu-transfer"
                  )
                  section._header.getRootElement().appendChild(section._fsuTransfer.getRootElement())
              }
          }
      }

      if(t == UTUnassignedItemsViewModel.SECTION.UNTRADABLEDUPLICATES){
          let players = _.filter(e,i => {
              return i.loans == -1 && i.type == "player"
          })
          if(players.length){
              let playerIds = _.map(players,i => {
                  return i.definitionId;
              })
              let r = repositories.Item;
              if(r.numItemsInCache(ItemPile.STORAGE) && !(_.has(section,"_fsuGoToStorage"))){
                  let sendClubPlayers = _.filter(repositories.Item.storage.values(),i => {
                      let clubPlayers = events.getItemBy(1,{"definitionId": i.definitionId, "upgrades": null},false,repositories.Item.club.items.values());
                      return clubPlayers.length == 0
                  })
                  if(sendClubPlayers.length){
                      section._fsuSendClubCount = events.createElementWithConfig("span",{
                          textContent:`(${sendClubPlayers.length})`,
                          style:{
                              color:"#36b84b",
                              paddingLeft:".2rem",
                              fontSize:"80%"
                          }
                      })
                      section._header.__subtext.appendChild(section._fsuSendClubCount)
                  }

                  section._fsuGoToStorage = events.createButton(
                      new UTStandardButtonControl(),
                      fy(`sbc.watchplayer`),
                      () => {
                          events.goToStoragePlayers()
                      },
                      "call-to-action mini"
                  )
                  section._header.getRootElement().appendChild(section._fsuGoToStorage.getRootElement())
              }
              const notif = events.createElementWithConfig("div",{
                  textContent:"ALL",
                  style:{
                      position:"absolute",
                      bottom:"-.2rem",
                      fontSize:".7rem",
                      height:"1rem",
                      lineHeight:"1.1rem",
                      fontWeight:"500",
                      width:"100%",
                      borderRadius:".6rem",
                      backgroundColor:"#151616",
                      color:"#fcfcfc"
                  }
              })
              const storageLack = r.getPileSize(ItemPile.STORAGE) - r.numItemsInCache(ItemPile.STORAGE);
              if(storageLack && storageLack >= playerIds.length && !(_.has(section,"_fsuStorage"))){
                  section._fsuStorage = events.createButton(
                      new UTImageButtonControl(),
                      "",
                      async(_e) => {
                          controller.confirmStoreUntradeablesTapped();
                      },
                      "filter-btn fsu-storage"
                  )
                  section._fsuStorage.getRootElement().style.position = "relative";
                  section._fsuStorage.getRootElement().appendChild(notif);
                  section._header.getRootElement().appendChild(section._fsuStorage.getRootElement())
              }
              //25.21 高分球员存入仓库按钮
              const hPlayers = _.orderBy(_.filter(players,i => i.rating > info.set.goldenrange),["rating"],["desc"]);
              if(storageLack && hPlayers.length && !(_.has(section,"_fsuHighStorage")) && (hPlayers.length < playerIds.length || hPlayers.length > storageLack)){
                  section._fsuHighStorage = events.createButton(
                      new UTImageButtonControl(),
                      "",
                      async(_e) => {
                          const controller = isPhone() ? cntlr.current() : cntlr.left();
                          let movePlayers = storageLack < hPlayers.length ? _.take(hPlayers,storageLack) : hPlayers;
                          services.Item.move(movePlayers, ItemPile.STORAGE, !0).observe(controller, controller.onMoveToStorageComplete);
                      },
                      "filter-btn fsu-storage"
                  )
                  let tempNotif = notif.cloneNode(false);
                  tempNotif.textContent = `>${info.set.goldenrange}`;
                  section._fsuHighStorage.getRootElement().style.position = "relative";
                  section._fsuHighStorage.getRootElement().appendChild(tempNotif);
                  section._header.getRootElement().appendChild(section._fsuHighStorage.getRootElement())
              }
              let swapPlayerIds = events.getItemBy(1,{"definitionId":playerIds,"untradeableCount":0});
              if(swapPlayerIds.length && !(_.has(section,"_fsuSwap"))){
                  section._fsuSwap = events.createButton(
                      new UTImageButtonControl(),
                      "",
                      async(_e) => {
                          controller.confirmSwapUntradeablesTapped();
                      },
                      "filter-btn fsu-swap"
                  )
                  section._header.getRootElement().appendChild(section._fsuSwap.getRootElement())
              }
          }
      }

      if("_fsuScreenshot" in controller){
          if(!controller.getView().getRootElement().querySelector("fsu-screenshot")){
              controller.getView().getRootElement().prepend(controller._fsuScreenshot.getRootElement())
          }
      }else{
          let sPrice = [];
          let sPlayers = [];
          _.map(controller.viewmodel.values(), i => {
              if(i.type == "player"){
                  sPlayers.push(i.definitionId)
                  sPrice.push(events.getCachePrice(i.definitionId,1).num);
              }
          })
          let sSection = new UTSectionedItemListView();
          sSection.init();
          sSection.getRootElement().classList.add("fsu-screenshot")
          sSection._header.getRootElement().querySelector("h2").style.fontSize = "1.3rem";
          sSection._header.getRootElement().querySelector("h2").classList.add("currency-coins");
          sSection._header.setText(fy(["screenshot.text",sPlayers.length,_.sum(sPrice).toLocaleString()]))
          controller._fsuScreenshot = sSection;
          controller.getView().getRootElement().prepend(controller._fsuScreenshot.getRootElement())
          // if(_.includes(sPrice,0)){
          //     events.loadPlayerInfo(sPlayers,controller)
          // }
      }


      //25.09 添加刷新快捷按钮
      if(!("_fsuRefreshBtn" in controller)){
          controller._fsuRefreshBtn = events.createButton(
              new UTImageButtonControl(),
              "",
              async(_e) => {
                  await services.Item.itemDao.itemRepo.unassigned.reset();
                  await controller.getUnassignedItems();
                  events.notice("notice.uasreset",0);
              },
              "filter-btn fsu-refresh"
          )
      }
      if(!(this.getRootElement().querySelector(".fsu-refresh"))){
          const target = section._header.getRootElement().querySelector(".filter-btn");
          if(target){
              target.before(controller._fsuRefreshBtn.getRootElement())
          }
      }

      //25.09 添加快捷任务按钮
      if (t === UTUnassignedItemsViewModel.SECTION.UNTRADABLEDUPLICATES && _.size(info.base.fastsbc) > 0) {
          let fastList = [];
          _.forOwn(info.base.fastsbc, (value, key) => {
              const c = events.fastSBCQuantity(false, e, value);
              if (c) {
                  const [cId, sId] = _.map(_.split(key, '#'), _.parseInt);
                  fastList.push({ sId, cId, c, n: key });
              }
          });
          console.log(fastList)
          if(fastList.length){
              if(_.size(services.SBC.repository.getSets())){
                  controller._fsuFastList = [];
                  
                  _.forOwn(fastList,i => {
                      const set = services.SBC.repository.getSetById(i.sId);
                      const challenge = set ? set.getChallenge(i.cId) : null;
                      if(set && !set.isComplete() && (challenge == null || !challenge.isCompleted())){
                          let btnTitle;
                          if (!_.has(info.base.fastsbc[i.n], "n")) {
                              if (set.challengesCount === 1) {
                                  info.base.fastsbc[i.n]["n"] = set.name;
                              } else if (challenge && challenge.name) {
                                  info.base.fastsbc[i.n]["n"] = `${set.name}-${challenge.name}`;
                              }
                          }

                          btnTitle = _.has(info.base.fastsbc[i.n], "n")
                              ? `${info.base.fastsbc[i.n].n}`
                              : `${set.name}-${i.cId}`;

                          console.log(btnTitle);

                          const duplicatePlayerIds = events.getItemBy(1, { id: _.map(e, "duplicateId"), untradeableCount: 0 });
                          const swapPlayers = e.filter(item => duplicatePlayerIds.includes(item.definitionId));

                          let fastBtn = events.createButton(
                              new UTStandardButtonControl(),
                              "",
                              (e) => {
                                  function goFastSBC(b){
                                      const btn = b;
                                      if(btn._swap.length){
                                          console.log("有可交换的")
                                          events.showLoader();
                                          services.Item.move(btn._swap, ItemPile.CLUB).observe(cntlr.current(),async (e, t) => {
                                              if (e.unobserve(cntlr.current()), t.success) {
                                                  services.Item.requestUnassignedItems().observe(cntlr.current(), (ee, tt) => {
                                                      ee.unobserve(cntlr.current());
                                                      if(tt.success){
                                                          events.isSBCCache(btn._sId, btn._cId)
                                                      }else{
                                                          events.notice("fastsbc.error_4",2)
                                                          events.hideLoader();
                                                      }
                                                  })
                                              }else{
                                                  services.Notification.queue([services.Localization.localize("notification.item.moveFailed"), UINotificationType.NEGATIVE])
                                              }
                                          });
                                      }else{
                                          events.isSBCCache(btn._sId, btn._cId)
                                      }
                                  }
                                  if (info.base.fastsbctips) {
                                      goFastSBC(e)
                                  } else {
                                      events.popup(
                                          fy("fastsbc.popupt"),
                                          fy("fastsbc.popupm"),
                                          (t) => {
                                              if (t === 2) {
                                                  info.base.fastsbctips = true;
                                                  goFastSBC(e)
                                              }
                                          }
                                      )
                                  }
                              },
                              "call-to-action"
                          );
                          let fastBtnBox = events.createElementWithConfig("div", {
                              classList: "fsu-unassigned-fastsbcinfo"
                          })
                          let fastBtnTitle = events.createElementWithConfig("div", {
                              textContent: btnTitle,
                              classList: "fsu-unassigned-fastsbctext"
                          })
                          fastBtnBox.appendChild(fastBtnTitle)
                          let fastBtnText = events.createElementWithConfig("div", {
                              classList: "fsu-unassigned-fastsbctsub"
                          })
                          fastBtnText.innerHTML = events.getFastSbcSubText(info.base.fastsbc[i.n]);
                          fastBtnBox.appendChild(fastBtnText)
                          let fastBtnTips = events.createElementWithConfig("div", {
                              textContent:i.c,
                              classList:["ut-tab-bar-item-notif", "fsu-unassigned-fastsbcdot"],
                          })
                          fastBtn.getRootElement().appendChild(fastBtnTips)
                          fastBtn.getRootElement().appendChild(fastBtnBox)
                          //fastBtn.__currencyLabel.innerHTML = events.getFastSbcSubText(info.base.fastsbc[`${i.cId}#${i.sId}`])

                          fastBtn._sId = i.sId;
                          fastBtn._cId = i.cId;
                          fastBtn._swap = swapPlayers;
                          controller._fsuFastList.push(fastBtn)

                          //25.22 注册快捷键
                          // const keyCount = _.size(info.keyEvent) + 1;
                          // info.keyEvent[keyCount] = fastBtn;
                      }
                  })
                  if(_.size(controller._fsuFastList)){
                      let fastBox = events.createElementWithConfig("div", {
                          classList: "fsu-unassigned-fastsbcbox"
                      })
                      _.forOwn(controller._fsuFastList,b => {
                          fastBox.appendChild(b.getRootElement())
                      })
                      let fastSection = new UTSectionedItemListView();
                      fastSection.init();
                      fastSection.getRootElement().classList.add("fsu-screenshot")
                      fastSection._header.getRootElement().querySelector("h2").style.fontSize = "1.3rem";
                      fastSection._header.setText(fy(["fastsbc.title",_.size(controller._fsuFastList)]))
                      fastSection.getRootElement().appendChild(fastBox);
                      controller._fsuFastSection = fastSection;
                      this.getRootElement().prepend(controller._fsuFastSection.getRootElement())
                  }
              }else{
                  events.notice("fastsbc.nosbcdata",2);
              }
          }

      }
  }
}
