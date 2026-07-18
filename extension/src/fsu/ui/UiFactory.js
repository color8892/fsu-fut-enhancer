import {
  appendText,
  createTrustedHtmlFragment,
  isTrustedMarkup,
  normalizeExternalUrl,
  setTrustedHtml,
  HTML_CONFIG_FORBIDDEN_KEYS
} from "./HtmlSafety.js";

const FORBIDDEN_CONFIG_KEYS = new Set(HTML_CONFIG_FORBIDDEN_KEYS);
const URL_PROPERTY_KEYS = new Set(["href", "src"]);

/**
 * @param {string} key
 */
function assertSafeConfigKey(key) {
  if (FORBIDDEN_CONFIG_KEYS.has(key) || /^on/i.test(key)) {
    throw new TypeError(
      `createElementWithConfig forbids HTML/event sinks: "${key}"`
    );
  }
}

/**
 * @param {string} attr
 */
function assertSafeAttributeName(attr) {
  if (/^on/i.test(attr)) {
    throw new TypeError(
      `createElementWithConfig forbids event attributes: "${attr}"`
    );
  }
}

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

/**
 * Build a DOM element from a constrained config bag.
 * Rejects innerHTML/outerHTML/srcdoc and on* event sinks.
 * @param {string} tag
 * @param {Record<string, unknown>} [config]
 */
export function createElementWithConfig(tag, config = {}) {
  const element = document.createElement(tag);
  Object.keys(config).forEach((key) => {
    assertSafeConfigKey(key);
    if (key === "classList") {
      const classes = [].concat(/** @type {unknown} */ (config[key]));
      classes.forEach((c) => element.classList.add(/** @type {string} */ (c)));
    } else if (key === "style") {
      const style = /** @type {Record<string, string>} */ (config.style);
      Object.keys(style).forEach((styleName) => {
        element.style[styleName] = style[styleName];
      });
    } else if (key === "attributes") {
      Object.entries(/** @type {Record<string, unknown>} */ (config.attributes)).forEach(
        ([attr, value]) => {
          assertSafeAttributeName(attr);
          if (attr === "href" || attr === "src") {
            const safe = normalizeExternalUrl(value);
            if (safe) element.setAttribute(attr, safe);
            return;
          }
          element.setAttribute(attr, String(value ?? ""));
        }
      );
    } else if (key === "var") {
      const vars = /** @type {Record<string, string>} */ (config.var);
      Object.keys(vars).forEach((styleName) => {
        element.style.setProperty(styleName, vars[styleName]);
      });
    } else if (URL_PROPERTY_KEYS.has(key)) {
      const safe = normalizeExternalUrl(config[key]);
      /** @type {Record<string, string>} */ (/** @type {unknown} */ (element))[key] =
        safe || "#";
    } else {
      /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (element))[key] =
        config[key];
    }
  });
  return element;
}

/**
 * @param {import("./HtmlSafety.js").TrustedMarkup} markup
 */
export function createDF(markup) {
  return createTrustedHtmlFragment(markup);
}

/**
 * @param {object} deps
 * @param {unknown} t
 * @param {unknown} m
 * @param {Function} c
 * @param {unknown} o
 * @param {unknown} i
 * @param {unknown} n
 * @param {unknown} s
 */
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
    if (isTrustedMarkup(m)) {
      setTrustedHtml(message, m);
    } else {
      // Default text mode — remote/localization strings never enter the HTML parser.
      message.textContent = m == null ? "" : String(m);
    }
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
    // Read-only probe of EA control placeholder text — not an HTML sink.
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
      if (isTrustedMarkup(s)) {
        mp.getView().__msg.appendChild(createDF(s));
      } else {
        appendText(mp.getView().__msg, s);
      }
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
