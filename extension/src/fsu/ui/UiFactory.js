export function createButton(s, t, b, c, style) {
  const btn = s;
  btn.init();
  btn.addTarget(btn, b.bind(btn), EventType.TAP);
  btn.setText(t);
  if (c) {
    const cl = c.split(" ").filter(Boolean);
    for (let ci of cl) btn.getRootElement().classList.add(ci);
  }
  if (style) {
    Object.keys(style).forEach((styleName) => {
      btn.getRootElement().style[styleName] = style[styleName];
    });
  }
  return btn;
}

export function createToggle(t, b) {
  const te = new UTToggleCellView();
  te.init();
  te.addTarget(te, b.bind(te), EventType.TAP);
  te.setLabel(t);
  return te;
}

export function createTile(a, b, c) {
  const t = new UTGraphicalInfoTileView();
  t.__root.classList.add("col-1-3");
  t.loadContentView();
  t.__tileContent.querySelector(".image").remove();
  t.init();
  t.addTarget(t, c.bind(t), EventType.TAP);
  t.setTitle(a);
  t.setDescription(b);
  return t;
}

export function createElementWithConfig(tag, config) {
  const element = document.createElement(tag);
  Object.keys(config).forEach((key) => {
    if (key === "classList") {
      const classes = [].concat(config[key]);
      classes.forEach((c) => element.classList.add(c));
    } else if (key === "style") {
      Object.keys(config.style).forEach((styleName) => {
        element.style[styleName] = config.style[styleName];
      });
    } else if (key === "attributes") {
      Object.entries(config.attributes).forEach(([attr, value]) => {
        element.setAttribute(attr, value);
      });
    } else if (key === "var") {
      Object.keys(config.var).forEach((styleName) => {
        element.style.setProperty(styleName, config.var[styleName]);
      });
    } else {
      element[key] = config[key];
    }
  });
  return element;
}

export function createDF(t) {
  return document.createRange().createContextualFragment(t);
}

export function popup(deps, t, m, c, o, i, n, s) {
  const { info, fy, createDF } = deps;

  if (!o) {
    o = [
      { labelEnum: enums.UIDialogOptions.OK },
      { labelEnum: enums.UIDialogOptions.CANCEL }
    ];
  }

  let message = m;
  if (info.isEnhancer) {
    message = document.createElement("div");
    message.innerHTML = m;
  }

  const mp = new EADialogViewController({
    dialogOptions: o,
    message,
    title: t,
    type: EADialogView.Type.MESSAGE
  });
  mp.init();
  mp.modalDisplayDimensions.minWidth = "300px";
  mp.onExit.observe(this, function (e, z) {
    e.unobserve(this);
    if (i) {
      c.call(this, z, mp._fsuInput);
    } else {
      c.call(this, z);
    }
  });
  gPopupClickShield.setActivePopup(mp);
  _.flatMap(mp.getView().dialogOptions, (v, index) => {
    if (v.__text.innerHTML == "*") {
      v.setText(fy(`popupButtonsText.${mp.options[index].labelEnum}`));
    }
    if (mp.options[index].labelEnum == 2) {
      v.removeClass("text");
      v.addClass("primary");
    }
  });
  if (i) {
    const pt = new UTTextInputControl();
    pt.init();
    if (i.constructor == Array) {
      if (i.length > 0) {
        pt.setPlaceholder(i[0]);
      }
      if (i.length > 1) {
        pt.setValue(i[1]);
      }
    } else if (i.constructor == String) {
      pt.setPlaceholder(i);
    }
    pt.__root.style.margin = ".5rem 0";
    pt.setInteractionState(n);
    mp._fsuInput = pt;
    mp.getView().__msg.appendChild(mp._fsuInput.__root);
    if (s) {
      mp.getView().__msg.appendChild(createDF(s));
    }
  }
}

export function registerUiEvents(deps) {
  const { events, info, fy } = deps;

  events.createButton = createButton;
  events.createToggle = createToggle;
  events.createTile = createTile;
  events.createElementWithConfig = createElementWithConfig;
  events.createDF = createDF;
  events.popup = (...args) => popup({ info, fy, createDF: events.createDF }, ...args);
}