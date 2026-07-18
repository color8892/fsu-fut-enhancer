(function initBackground(globalScope) {
  "use strict";

  const CONTENT_SOURCE = "fsu-extension-content";
  const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

  function createSecurityError(message) {
    const error = new Error(message);
    error.name = "SecurityError";
    return error;
  }

  const REQUEST_RULES = [
    {
      origin: "https://api.fut.to",
      path: /^\/26\/(?:updata|meta|fast|pack|sbc|ggrating|evolutions|inpacks|other|fgconfig|playermeta|lowprice)\.json$/,
      credentials: "omit"
    },
    {
      origin: "https://www.fut.gg",
      path: /^\/api\/(?:fut\/player-prices\/26\/|squads\/\d+)$/,
      credentials: "omit"
    },
    {
      origin: "https://www.futbin.org",
      path: /^\/futbin\/api\/\d+\/(?:getChallengeTopSquads|getSquadByID|getChallengesBySetId|fetchPriceInformation|getFilteredPlayers|fetchPlayerInformationMinimal)$/,
      credentials: "omit"
    },
    {
      origin: "https://enhancer-api.futnext.com",
      path: /^\/players\/prices$/,
      credentials: "omit"
    },
    {
      origin: "https://utas.mob.v5.prd.futc-ext.gcp.ea.com",
      path: /^\/ut\/game\/fc26\/transfermarket$/,
      credentials: "omit",
      headers: new Set(["accept", "content-type", "x-ut-sid"])
    }
  ];

  class RequestPolicy {
    constructor(rules = REQUEST_RULES) {
      this.rules = rules;
    }

    authorize(details) {
      if (!details || typeof details.url !== "string") {
        throw new TypeError("GM_xmlhttpRequest requires a URL.");
      }

      let url;
      try {
        url = new URL(details.url);
      } catch {
        throw new TypeError("GM_xmlhttpRequest received an invalid URL.");
      }

      const method = String(details.method || "GET").toUpperCase();
      const rule = this.rules.find(
        (candidate) => candidate.origin === url.origin && candidate.path.test(url.pathname)
      );

      if (!rule || method !== "GET") {
        throw createSecurityError("The requested endpoint is not allowed.");
      }

      return {
        ...details,
        url: url.href,
        method,
        credentials: rule.credentials,
        allowedHeaders: rule.headers || new Set(["accept", "content-type", "cache-control", "pragma", "x-requested-with"])
      };
    }
  }

  const FORBIDDEN_REQUEST_HEADERS = new Set([
    "accept-charset",
    "accept-encoding",
    "access-control-request-headers",
    "access-control-request-method",
    "connection",
    "content-length",
    "cookie",
    "cookie2",
    "date",
    "dnt",
    "expect",
    "host",
    "keep-alive",
    "origin",
    "permissions-policy",
    "referer",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "user-agent",
    "via"
  ]);

  class SenderPolicy {
    isAllowed(senderUrl) {
      if (!senderUrl) return false;

      let url;
      try {
        url = new URL(senderUrl);
      } catch {
        return false;
      }

      if (url.protocol !== "https:") return false;

      const host = url.hostname.toLowerCase();
      const path = url.pathname;

      if (host === "www.ea.com") {
        return /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?ea-sports-fc\/ultimate-team\/web-app\//i.test(path);
      }

      if (host === "www.easports.com") {
        return /^\/[a-z]{2}(?:-[a-z]{2})?\/ea-sports-fc\/ultimate-team\/web-app\//i.test(path);
      }

      return false;
    }
  }

  class RequestNormalizer {
    constructor(forbiddenHeaders = FORBIDDEN_REQUEST_HEADERS) {
      this.forbiddenHeaders = forbiddenHeaders;
    }

    normalizeHeaders(headers, allowedHeaders) {
      const normalized = {};

      if (!headers || typeof headers !== "object") {
        return normalized;
      }

      for (const [rawName, rawValue] of Object.entries(headers)) {
        if (rawValue === undefined || rawValue === null) continue;

        const name = String(rawName);
        const lowerName = name.toLowerCase();

        if (
          this.forbiddenHeaders.has(lowerName) ||
          (allowedHeaders && !allowedHeaders.has(lowerName)) ||
          lowerName.startsWith("proxy-") ||
          lowerName.startsWith("sec-")
        ) {
          continue;
        }

        normalized[name] = String(rawValue);
      }

      return normalized;
    }

    normalizeBody(data) {
      if (data === undefined || data === null) return undefined;
      if (typeof data === "string") return data;
      if (typeof Blob !== "undefined" && data instanceof Blob) return data;
      if (typeof FormData !== "undefined" && data instanceof FormData) return data;
      if (typeof URLSearchParams !== "undefined" && data instanceof URLSearchParams) return data;
      if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) return data;
      if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView && ArrayBuffer.isView(data)) {
        return data;
      }

      return JSON.stringify(data);
    }

    buildFetchOptions(details, signal) {
      const method = String(details.method || "GET").toUpperCase();
      const options = {
        method,
        headers: this.normalizeHeaders(details.headers, details.allowedHeaders),
        credentials: details.credentials || "omit",
        redirect: "error",
        signal
      };

      if (method !== "GET" && method !== "HEAD") {
        const body = this.normalizeBody(details.data);
        if (body !== undefined) {
          options.body = body;
        }
      }

      return options;
    }
  }

  class GmRequestService {
    constructor(fetchImpl, normalizer = new RequestNormalizer(), policy = new RequestPolicy()) {
      this.fetchImpl = fetchImpl;
      this.normalizer = normalizer;
      this.policy = policy;
    }

    async perform(details) {
      const authorizedDetails = this.policy.authorize(details);

      const controller = new AbortController();
      let timeoutId = null;
      let timedOut = false;
      const timeoutMs = Math.min(Math.max(Number(authorizedDetails.timeout) || 0, 0), 30000);

      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);
      }

      try {
        const response = await this.fetchImpl(
          authorizedDetails.url,
          this.normalizer.buildFetchOptions(authorizedDetails, controller.signal)
        );
        const responseText = await response.text();
        if (new TextEncoder().encode(responseText).byteLength > MAX_RESPONSE_BYTES) {
          throw new RangeError("The response exceeds the extension size limit.");
        }
        const responseHeaders = Array.from(response.headers.entries())
          .map(([key, value]) => `${key}: ${value}`)
          .join("\r\n");

        return {
          finalUrl: response.url,
          readyState: 4,
          status: response.status,
          statusText: response.statusText,
          responseHeaders,
          responseText,
          response: responseText
        };
      } catch (error) {
        if (timedOut) {
          error.isTimeout = true;
        }
        throw error;
      } finally {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      }
    }
  }

  class TabService {
    constructor(tabsApi) {
      this.tabsApi = tabsApi;
    }

    open(url, options) {
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch {
        throw new TypeError("GM_openInTab received an invalid URL.");
      }

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new TypeError("GM_openInTab only supports http and https URLs.");
      }

      return this.tabsApi.create({
        url: parsedUrl.href,
        active: !options || options.active !== false
      });
    }
  }

  class ErrorSerializer {
    serialize(error) {
      return {
        name: error && error.name ? String(error.name) : "Error",
        message: error && error.message ? String(error.message) : String(error),
        isTimeout: Boolean(error && error.isTimeout)
      };
    }
  }

  class BackgroundMessageRouter {
    constructor({ runtimeApi, senderPolicy, requestService, tabService, errorSerializer }) {
      this.runtimeApi = runtimeApi;
      this.senderPolicy = senderPolicy;
      this.requestService = requestService;
      this.tabService = tabService;
      this.errorSerializer = errorSerializer;
    }

    register() {
      if (!this.runtimeApi || !this.runtimeApi.onMessage) {
        return;
      }

      this.runtimeApi.onMessage.addListener((message, sender, sendResponse) =>
        this.handleMessage(message, sender, sendResponse)
      );
    }

    handleMessage(message, sender, sendResponse) {
      if (!message || message.source !== CONTENT_SOURCE) {
        return false;
      }

      const senderUrl = sender && (sender.url || (sender.tab && sender.tab.url));
      if (!this.senderPolicy.isAllowed(senderUrl)) {
        sendResponse({
          ok: false,
          error: { name: "SecurityError", message: "Sender URL is not allowed." }
        });
        return false;
      }

      if (message.type === "GM_XMLHTTP_REQUEST") {
        this.requestService
          .perform(message.details)
          .then((response) => sendResponse({ ok: true, response }))
          .catch((error) => sendResponse({ ok: false, error: this.errorSerializer.serialize(error) }));
        return true;
      }

      if (message.type === "GM_OPEN_IN_TAB") {
        this.tabService
          .open(message.url, message.options)
          .then((tab) => sendResponse({ ok: true, tabId: tab.id }))
          .catch((error) => sendResponse({ ok: false, error: this.errorSerializer.serialize(error) }));
        return true;
      }

      sendResponse({
        ok: false,
        error: { name: "TypeError", message: `Unsupported message type: ${message.type}` }
      });
      return false;
    }
  }

  const senderPolicy = new SenderPolicy();
  const requestNormalizer = new RequestNormalizer();
  const requestPolicy = new RequestPolicy();
  const errorSerializer = new ErrorSerializer();

  function isAllowedSender(senderUrl) {
    return senderPolicy.isAllowed(senderUrl);
  }

  function normalizeHeaders(headers) {
    return requestNormalizer.normalizeHeaders(headers);
  }

  function normalizeBody(data) {
    return requestNormalizer.normalizeBody(data);
  }

  function buildFetchOptions(details, signal) {
    return requestNormalizer.buildFetchOptions(details, signal);
  }

  function serializeError(error) {
    return errorSerializer.serialize(error);
  }

  if (globalScope.chrome && chrome.runtime && chrome.tabs && typeof fetch === "function") {
    new BackgroundMessageRouter({
      runtimeApi: chrome.runtime,
      senderPolicy,
      requestService: new GmRequestService(fetch.bind(globalScope), requestNormalizer, requestPolicy),
      tabService: new TabService(chrome.tabs),
      errorSerializer
    }).register();
  }

  if (typeof module !== "undefined") {
    module.exports = {
      BackgroundMessageRouter,
      ErrorSerializer,
      GmRequestService,
      RequestNormalizer,
      RequestPolicy,
      SenderPolicy,
      TabService,
      buildFetchOptions,
      isAllowedSender,
      normalizeBody,
      normalizeHeaders,
      serializeError
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
