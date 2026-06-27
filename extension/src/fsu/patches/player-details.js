export function renderPlayerDetailsButtons(deps, context) {
  const { events, fy, info, repositories, services, pdb } = deps;
  const { controller, panelView, item, defId, e } = context;

  if (item && item.isPlayer()) {
    controller._fsu = {};

    if (defId !== 0) {
      const playerBio = panelView._bioButton || panelView._btnBio || panelView._playerBioButton;
      if (info.set.player_futbin) {
        let goToFutbin = controller._fsu?.goToFutbin;
        if (!goToFutbin) {
          goToFutbin = events.createButton(
            new UTGroupButtonControl(),
            fy("quicklist.gotofutbin"),
            (e) => { events.openFutbinPlayerUrl(e, item); },
            "more"
          );
          controller._fsu.goToFutbin = goToFutbin;
        }
        if (playerBio) {
          playerBio.getRootElement().after(goToFutbin.getRootElement());
        }
      }

      //添加进化任务展示
      let getAcademies = controller._fsu?.getAcademies;
      if (!getAcademies) {
        getAcademies = events.createButton(
          new UTGroupButtonControl(),
          fy("academy.btntext2"),
          (e) => {
            const filtered = _.pickBy(e.fsu, (value, key) =>
              _.includes(key, `academieBtn_${e.item.id}`)
            );
            if (_.size(filtered)) {
              //debug.log(filtered)

              _.forEach(filtered, (item) => {
                const action = e.isShow ? 'hide' : 'show';
                if (item instanceof UTButtonControl) {
                  item[action]();
                } else if (item instanceof Element) {
                  item.style.display = e.isShow ? 'none' : '';
                }
              });

              e.isShow = !e.isShow;
            } else {
              const createBtns = () => {
                const attrs = e.academies.map(academy => {
                  const attr = events.academyAddAttr(academy.attr, academy.isGK, item);
                  const sizeValue = attr.map.size ? 1 : 0;
                  return {
                    id: academy.id,
                    name: academy.name,
                    time: academy.timeText,
                    diff: academy.timeDiff,
                    attr: attr.map,
                    count: attr.count,
                    class: attr.map.size === 0 ? "not" : "yes",
                    size: sizeValue
                  };
                });

                const sortedAttrs = _.orderBy(
                  attrs,
                  ['size', 'count', 'diff'],
                  ['desc', 'desc', 'asc']
                );

                _.forEachRight(sortedAttrs, (academy) => {
                  let academieBtn = events.createButton(
                    new UTButtonControl(),
                    "",
                    (e) => {
                      events.academyPreviewEvolutionAttr(e._fsu.academyId, controller, item);
                    },
                    `mini academieBtn accordian ${academy.class}`
                  );
                  academieBtn._fsu ??= {};
                  academieBtn._fsu.academyId = academy.id;
                  let academieBtnElment = academieBtn.getRootElement();
                  let academieBtnTitleBox = events.createElementWithConfig("div", {
                    className: "academieBtnTitle"
                  });
                  academieBtnTitleBox.appendChild(
                    events.createElementWithConfig("div", {
                      textContent: academy.name,
                      className: "academieBtnName"
                    })
                  );
                  academieBtnTitleBox.appendChild(
                    events.createElementWithConfig("div", {
                      textContent: academy.time,
                      className: "academieBtnTime"
                    })
                  );
                  academieBtnElment.appendChild(academieBtnTitleBox);
                  academieBtnElment.appendChild(events.academyAddAttrOutput(academy.attr));
                  e.fsu[`academieBtn_${item.id}_${academy.id}`] = academieBtn;
                  e.getRootElement().after(academieBtn.getRootElement());

                });
                if (e.academies.length) {
                  let academyBtnTips = events.createElementWithConfig("div", {
                    className: "academyBtnTips",
                    textContent: fy("academy.attr.tips")
                  });
                  e.fsu[`academieBtn_${item.id}_tips`] = academyBtnTips;
                  getAcademies.getRootElement().after(academyBtnTips);
                }
                e.isShow = true;
                events.hideLoader();
              };
              events.showLoader();
              if (!repositories.PlayerMeta.get(item.definitionId)) {
                services.PlayerMetaData.updateItemPlayerMeta([item]).observe(controller, function (q, w) {
                  q.unobserve(controller);
                  if (w.success) {
                    item.setMetaData(repositories.PlayerMeta.get(item.definitionId));
                    createBtns();
                  } else {
                    events.notice("notice.loaderror", 2);
                    events.hideLoader();
                  }
                });
              } else {
                createBtns();
              }
            }
          },
          "more"
        );
        controller._fsu.getAcademies = getAcademies;
      }

      const academies = info.academy
        .filter(
          a =>
            a.practical &&
            a.el.every(t => t.meetsRequirements(item))
        )
        .map(a => {
          return {
            id: a.id,
            name: a.name,
            isGK: a.isGK,
            attr: a.attr,
            timeDiff: a.timeDiff,
            timeText: a.timeDiffText
          };
        });

      if (academies.length) {
        getAcademies.academies = academies;
        getAcademies.item = item;
        getAcademies.fsu = controller._fsu;

        //移除额外的按钮
        _.forEach(controller._fsu, (value, key) => {
          if (_.includes(key, 'academieBtn') && !_.includes(key, `academieBtn_${item.id}`)) {
            value.destroy();
            delete controller._fsu[key];
          }
        });

        if (playerBio) {
          playerBio.getRootElement().before(getAcademies.getRootElement());
        }
      }

      //添加读取拍卖价格按钮
      if (info.set.player_getprice && services.User.getUser().tradeAccess === TradeAccessLevel.ALLOWED) {
        let getAuction = controller._fsu?.getAuction;
        if (!getAuction) {
          getAuction = events.createButton(
            new UTGroupButtonControl(),
            fy("quicklist.getprice"),
            (e) => {
              events.getAuction(e, item);
            },
            "accordian"
          );
          controller._fsu.getAuction = getAuction;
        }
        if (_.has(pdb, defId)) {
          getAuction.setText(fy("quicklist.getpricey"));
          getAuction.setSubtext(pdb[defId]);
          getAuction.displayCurrencyIcon(!0);
        }
        const lastGroup = _.last(panelView.getRootElement().querySelectorAll('.ut-button-group'));
        lastGroup.appendChild(getAuction.getRootElement());
      }


      //添加一键拍卖按钮
      if (info.set.player_auction && services.User.getUser().tradeAccess === TradeAccessLevel.ALLOWED) {

        let setAuction = controller._fsu?.setAuction;
        if (!setAuction) {
          setAuction = events.createButton(
            new UTGroupButtonControl(),
            fy("quicklist.auction"),
            (e) => {
              events.showLoader();
              events.playerToAuction(e.itemId, events.getCachePrice(e.defId, 1).num, 1);
              events.hideLoader();
            },
            "accordian fsu-setAuction"
          );
          controller._fsu.setAuction = setAuction;
        }
        setAuction.itemId = item.id;
        setAuction.defId = defId;
        setAuction.getRootElement().setAttribute('data-id', defId);
        const cachePrice = events.getCachePrice(defId, 1);
        if (cachePrice.num) {
          setAuction.setSubtext(cachePrice.text);
        } else {
          setAuction.setSubtext("--");
        }
        setAuction.displayCurrencyIcon(!0);
        let oldSetAuction = e.getView().getRootElement().querySelector('.fsu-setAuction');
        if (oldSetAuction) {
          oldSetAuction.remove();
        }
        e.getView()._btnToggle.getRootElement().after(setAuction.getRootElement());
      }


    }
  }
}