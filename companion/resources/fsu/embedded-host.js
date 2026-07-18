/**
 * FSU Embedded host bootstrap (runs inside the untrusted FUT webview).
 * Provides GM_* shims without Chrome extension APIs.
 * Storage: localStorage under fsu-embedded: prefix.
 * Network: fixed allowlisted Rust bridge, with page-fetch fallback outside Tauri.
 */
(function installFsuEmbeddedHost(global) {
  "use strict";

  var MARKER = "__FSU_EMBEDDED_RUNTIME_V1__";
  var STORAGE_PREFIX = "fsu-embedded:";

  if (global[MARKER] && global[MARKER].host) {
    return;
  }

  var marker = global[MARKER] || {
    version: 1,
    host: false,
    lodash: false,
    userscript: false
  };

  function readStore(key, fallback) {
    try {
      var raw = global.localStorage.getItem(STORAGE_PREFIX + String(key));
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (_e) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      if (value === undefined) {
        global.localStorage.removeItem(STORAGE_PREFIX + String(key));
      } else {
        global.localStorage.setItem(STORAGE_PREFIX + String(key), JSON.stringify(value));
      }
    } catch (_e) {
      // restricted storage
    }
  }

  function GM_getValue(key, defaultValue) {
    var v = readStore(key, undefined);
    return v === undefined ? defaultValue : v;
  }

  function GM_setValue(key, value) {
    writeStore(key, value);
    return value;
  }

  function headersToString(headers) {
    if (!headers) return "";
    try {
      var parts = [];
      headers.forEach(function (value, name) {
        parts.push(name + ": " + value);
      });
      return parts.join("\r\n");
    } catch (_e) {
      return "";
    }
  }

  function GM_xmlhttpRequest(details) {
    if (!details || typeof details.url !== "string") {
      return;
    }
    var method = String(details.method || "GET").toUpperCase();
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timeoutId = null;
    if (details.timeout && controller) {
      timeoutId = setTimeout(function () {
        controller.abort();
      }, Number(details.timeout) || 0);
    }

    var init = {
      method: method,
      credentials: "omit",
      redirect: "error",
      signal: controller ? controller.signal : undefined
    };

    if (details.headers && typeof details.headers === "object") {
      init.headers = {};
      Object.keys(details.headers).forEach(function (k) {
        if (k && details.headers[k] != null) {
          init.headers[k] = String(details.headers[k]);
        }
      });
    }
    if (details.data != null && method !== "GET" && method !== "HEAD") {
      init.body = details.data;
    }

    function deliver(response) {
      if (typeof details.onreadystatechange === "function") details.onreadystatechange(response);
      if (typeof details.onload === "function") details.onload(response);
      if (typeof details.onloadend === "function") details.onloadend(response);
    }

    function fail(err) {
      var isTimeout = err && (err.name === "AbortError" || /timed? ?out/i.test(String(err)));
      var response = {
        finalUrl: String(details.url),
        readyState: 4,
        status: 0,
        statusText: isTimeout ? "timeout" : "error",
        responseHeaders: "",
        responseText: "",
        response: "",
        error: { name: (err && err.name) || "Error", message: "Request failed", isTimeout: !!isTimeout }
      };
      if (isTimeout && typeof details.ontimeout === "function") details.ontimeout(response);
      else if (typeof details.onerror === "function") details.onerror(response);
      if (typeof details.onloadend === "function") details.onloadend(response);
    }

    var invoke = global.__TAURI_INTERNALS__ && global.__TAURI_INTERNALS__.invoke;
    if (typeof invoke === "function") {
      invoke("embedded_http_request", {
        request: {
          method: method,
          url: String(details.url),
          headers: details.headers && typeof details.headers === "object" ? details.headers : {},
          timeout: Number(details.timeout) || undefined
        }
      })
        .then(deliver)
        .catch(fail)
        .finally(function () {
          if (timeoutId) clearTimeout(timeoutId);
        });
      return;
    }

    // Page-context fetch: subject to CORS. No privileged proxy by design.
    fetch(String(details.url), init)
      .then(function (res) {
        return res.text().then(function (text) {
          var response = {
            finalUrl: res.url || String(details.url),
            readyState: 4,
            status: res.status,
            statusText: res.statusText || "",
            responseHeaders: headersToString(res.headers),
            responseText: text,
            response: text
          };
          deliver(response);
        });
      })
      .catch(fail)
      .finally(function () {
        if (timeoutId) clearTimeout(timeoutId);
      });
  }

  function GM_openInTab(url) {
    // Embedded: do not spawn arbitrary external browsers. Deny silently.
    console.warn("[FSU embedded] GM_openInTab blocked in Embedded Mode:", String(url || "").slice(0, 80));
    return null;
  }

  function GM_addStyle(css) {
    var style = document.createElement("style");
    style.setAttribute("data-fsu-embedded-style", "1");
    style.textContent = String(css || "");
    (document.head || document.documentElement).appendChild(style);
    return style;
  }

  var GM_info = {
    script: { version: "embedded", name: "FSU Embedded" },
    scriptHandler: "fsu-companion-embedded",
    version: "0.1.0"
  };

  global.unsafeWindow = global;
  global.GM_getValue = GM_getValue;
  global.GM_setValue = GM_setValue;
  global.GM_xmlhttpRequest = GM_xmlhttpRequest;
  global.GM_openInTab = GM_openInTab;
  global.GM_addStyle = GM_addStyle;
  global.GM_info = GM_info;

  marker.host = true;
  marker.installedAt = Date.now();
  global[MARKER] = marker;

  global.__FSU_EMBEDDED_ENSURE__ = function ensure() {
    global.unsafeWindow = global;
    global.GM_getValue = GM_getValue;
    global.GM_setValue = GM_setValue;
    global.GM_xmlhttpRequest = GM_xmlhttpRequest;
    global.GM_openInTab = GM_openInTab;
    global.GM_addStyle = GM_addStyle;
    global.GM_info = GM_info;
    return true;
  };

  try {
    document.documentElement.setAttribute("data-fsu-embedded", "1");
  } catch (_e) {}
})(typeof window !== "undefined" ? window : globalThis);
