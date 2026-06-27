export function registerBuildIgnoreEvents(deps) {
  const { events, info, fy, set, build, debug } = deps;
  //26.03 修复untradeable无法填充的问题
events.ignorePlayerToCriteria = (c) => {
    if(info.build.league){
        c["NEleagueId"] = info.set.shield_league;
    }
    if(info.build.untradeable){
        c["tradable"] = false;
    }
    if(!_.has(c,"rareflag")){
        c["rareflag"] = [0,1];
        if(info.build.flag){
            c["rareflag"] = c["rareflag"].concat(info.set.shield_flag);
        }
    }
    if(info.build.academy){
        c["upgrades"] = null;
    }
    if(info.build.firststorage){
        c["firststorage"] = true;
    }else{
        c["firststorage"] = false;
    }
    c["removeSquad"] = true;
    return c;
}

//25.13 排除联赛和不排除品质配置
events.ignorePlayerTypePopup = (type) => {
    //type 1:联赛、2：品质

    const config = {};
    const typeConfig = {
        1: {
            title: `shieldlea.btntext`,
            msg: `shieldlea.popupm`,
            set: `shield_league`,
            attribute: `leagueId`,
            factories: () => factories.DataProvider.getLeagueDP(true).filter(l => l.id !== -1)
        },
        2: {
            title: `shieldflag.btntext`,
            msg: `shieldflag.popupm`,
            set: `shield_flag`,
            attribute: `rareflag`,
            factories: () => factories.DataProvider.getItemRarityDP({
                itemSubTypes: [2],
                itemTypes: ["player"],
                quality: "any",
                tradableOnly: false
            }).filter(l => l.id !== -1)
        }
    };

    if (type in typeConfig) {
        const { title, msg, set, attribute, factories } = typeConfig[type];
        config.title = title;
        config.msg = msg;
        config.set = set;
        config.attribute = attribute;
        config.factories = factories();
    } else {
        return;
    }

    // 输出结果
    debug.log(config);
    let mp = new EADialogViewController({
        dialogOptions: [{ labelEnum: enums.UIDialogOptions.OK }],
        message: fy(config.msg),
        title: fy(config.title),
        type: EADialogView.Type.MESSAGE
    });
    mp.init();
    mp.onExit.observe(mp,(e, z) => {
        e.unobserve(mp);
        events.ignorePlayerPopup();
    });
    gPopupClickShield.setActivePopup(mp);
    _.flatMap(mp.getView().dialogOptions,(v,i) => {
        if(v.__text.innerHTML == "*"){
            v.setText(fy(`popupButtonsText.${mp.options[i].labelEnum}`))
        }
    })
    mp.getView().__msg.style.padding = "1rem";
    mp.getView().__msg.style.fontSize = "100%";
    mp._fsuToggle = [];
    const playerList = _.countBy(events.getItemBy(2, {}), config.attribute);
    const optionData = _.orderBy(config.factories.map(f => ({
        name: f.label,
        id: f.id,
        count: playerList[f.id] || 0,
        select: _.includes(info.set[config.set],f.id) ? 1 : 0
    })),["select","count"],["desc","desc"]);

    // 输出结果
    debug.log(optionData);
    let oBox = events.createElementWithConfig("div",{
        style:{
            height:"40vh",
            overflowY:"auto",
            padding:"1rem",
            backgroundColor:"#151616",
            marginTop:"1rem"
        }
    })

    _.forEach(optionData,o => {
        let oToggle = events.createToggle(
            o.name,
            async (e) => {
                if (e.getToggleState()) {
                    if (!_.includes(info.set[config.set], o.id)) {
                        info.set[config.set].push(o.id);
                    }
                } else {
                    _.pull(info.set[config.set], o.id);
                }
                debug.log(info.set[config.set])
                set.save(config.set, info.set[config.set])
            }
        )
        if(type == 2 && o.id < 2){
            oToggle.toggle(true);
            oToggle.setInteractionState(0);
        }else{
            oToggle.toggle(o.select == 1);
        }
        oToggle.__root.style.paddingLeft = "0";
        oToggle.__root.style.paddingRight = "0";
        oToggle.__root.style.position = "relative";
        let oCount = events.createElementWithConfig("span",{
            textContent: o.count,
            style:{
                position: "absolute",
                right: "3.6rem",
                top: ".9rem"
            }
        })
        oToggle.__root.appendChild(oCount);
        mp._fsuToggle.push(oToggle);
        oBox.appendChild(oToggle.__root);
    })
    mp.getView().__msg.appendChild(oBox);
}
//24.16 排除球员配置按钮：弹窗事件
events.ignorePlayerPopup = (ignoreTextElment) => {
    let mp = new EADialogViewController({
        dialogOptions: [{ labelEnum: 44404 },{ labelEnum: 44407 },{ labelEnum: 44405 },{ labelEnum: 44403 }],
        message: fy(`playerignore.popupm`),
        title: fy(`playerignore.popupt`),
        type: EADialogView.Type.MESSAGE
    });
    mp.init();
    mp.onExit.observe(mp,(e, z) => {
        e.unobserve(mp);
        if(z == 44404){
            events.ignorePlayerTypePopup(1)
        }else if(z == 44407){
            events.ignorePlayerTypePopup(2)
        }else if(z == 44405){
            events.popup(
                fy("goldenplayer.popupmt"),
                fy("goldenplayer.popupm"),
                (t,i) => {
                    if(t === 2){
                        let v = Number(i.getValue());
                        if(!_.isNaN(v) && v > 75 && v < 100){
                            set.save("goldenrange",v)
                        }else if(v == 0){
                            set.save("goldenrange",83)
                        }else{
                            events.notice(fy("notice.seterror"),2)
                        }
                    }
                    events.ignorePlayerPopup()
                },
                [
                    { labelEnum: enums.UIDialogOptions.OK },
                    { labelEnum: 44403 }]
                ,
                [fy("goldenplayer.placeholder"),info.set.goldenrange],
                true
            )
        }
        ignoreTextElment.textContent = events.getIgnoreText();
    });
    gPopupClickShield.setActivePopup(mp);
    _.flatMap(mp.getView().dialogOptions,(v,i) => {
        if(v.__text.innerHTML == "*"){
            v.setText(fy(`popupButtonsText.${mp.options[i].labelEnum}`))
        }
    })
    mp.getView().__msg.style.padding = "1rem";
    mp.getView().__msg.style.fontSize = "100%";
    let buildArray = ["ignorepos","untradeable","league","flag","academy","strictlypcik","comprange","comprare","firststorage","sbfirstcommon"];
    const getText = (b) => {
        const textMap = {
            league: () => `${fy(`builder.league`)}(${info.set.shield_league.length})`,
            flag: () => `${fy(`builder.flag`)}(${info.set.shield_flag.length})`,
            comprange: () => fy([`builder.comprange`, info.set.goldenrange]),
        };

        return textMap[b] ? textMap[b]() : fy(`builder.${b}`);
    };
    _.forEach(buildArray,b => {
        let bText = getText(b);
        let bToggle = events.createToggle(
            bText,
            async(e) => {
                build.set(b,e.getToggleState())
            }
        )
        bToggle.toggle(info.build[b]);
        bToggle.__root.style.paddingLeft = "0";
        bToggle.__root.style.paddingRight = "0";
        mp.getView().__msg.appendChild(bToggle.__root);
    })
}
}
