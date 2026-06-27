(function initContentBridge(globalScope) {
  "use strict";

  const PAGE_SOURCE = "fsu-extension-page";
  const CONTENT_SOURCE = "fsu-extension-content";
  const INJECTED_SCRIPTS = [
    "vendor/lodash.min.js",
    "src/page-runtime.js",
    "src/userscript.js"
  ];

  class ScriptInjector {
    constructor({ documentRef, runtimeApi }) {
      this.documentRef = documentRef;
      this.runtimeApi = runtimeApi;
    }

    appendScript(script) {
      const parent = this.documentRef.head || this.documentRef.documentElement;
      parent.appendChild(script);
    }

    injectInit(storage) {
      const script = this.documentRef.createElement("script");
      script.textContent = `window.__FSU_EXTENSION_INIT__ = ${JSON.stringify({ storage })};`;
      this.appendScript(script);
      script.remove();
    }

    injectFile(path) {
      return new Promise((resolve, reject) => {
        const script = this.documentRef.createElement("script");
        script.src = this.runtimeApi.getURL(path);
        script.async = false;
        script.onload = () => {
          script.remove();
          resolve();
        };
        script.onerror = () => {
          script.remove();
          reject(new Error(`Failed to inject ${path}`));
        };
        this.appendScript(script);
      });
    }

    async injectAll(paths, storage) {
      this.injectInit(storage);

      for (const path of paths) {
        await this.injectFile(path);
      }
    }
  }

  class ExtensionStorage {
    constructor(storageArea, runtimeApi) {
      this.storageArea = storageArea;
      this.runtimeApi = runtimeApi;
    }

    getAll() {
      return new Promise((resolve) => {
        this.storageArea.get(null, (items) => {
          if (this.runtimeApi.lastError) {
            console.warn("[FSU extension] Failed to read storage:", this.runtimeApi.lastError.message);
            resolve({});
            return;
          }
          resolve(items || {});
        });
      });
    }

    setValue(key, value) {
      if (value === undefined) {
        this.storageArea.remove(key);
        return;
      }

      this.storageArea.set({ [key]: value });
    }
  }

  class RuntimeMessenger {
    constructor(runtimeApi) {
      this.runtimeApi = runtimeApi;
    }

    send(payload) {
      return new Promise((resolve) => {
        this.runtimeApi.sendMessage(payload, (response) => {
          if (this.runtimeApi.lastError) {
            resolve({
              ok: false,
              error: {
                name: "RuntimeError",
                message: this.runtimeApi.lastError.message
              }
            });
            return;
          }

          resolve(response || { ok: false, error: { name: "RuntimeError", message: "No response." } });
        });
      });
    }
  }

  class PageBridge {
    constructor({ windowRef, storage, messenger }) {
      this.windowRef = windowRef;
      this.storage = storage;
      this.messenger = messenger;
      this.handlePageMessage = this.handlePageMessage.bind(this);
    }

    start() {
      this.windowRef.addEventListener("message", this.handlePageMessage);
    }

    postToPage(message) {
      this.windowRef.postMessage(
        {
          source: CONTENT_SOURCE,
          ...message
        },
        "*"
      );
    }

    handlePageMessage(event) {
      if (event.source !== this.windowRef) return;

      const message = event.data;
      if (!message || message.source !== PAGE_SOURCE) return;

      if (message.type === "GM_SET_VALUE") {
        this.handleSetValue(message);
        return;
      }

      if (message.type === "GM_XMLHTTP_REQUEST") {
        this.forwardXmlHttpRequest(message);
        return;
      }

      if (message.type === "GM_OPEN_IN_TAB") {
        this.forwardOpenInTab(message);
      }
    }

    handleSetValue(message) {
      if (typeof message.key !== "string") return;
      this.storage.setValue(message.key, message.value);
    }

    forwardXmlHttpRequest(message) {
      this.messenger
        .send({
          source: CONTENT_SOURCE,
          type: "GM_XMLHTTP_REQUEST",
          requestId: message.requestId,
          details: message.details
        })
        .then((response) => {
          this.postToPage({
            type: "GM_XMLHTTP_RESPONSE",
            requestId: message.requestId,
            ...response
          });
        });
    }

    forwardOpenInTab(message) {
      this.messenger
        .send({
          source: CONTENT_SOURCE,
          type: "GM_OPEN_IN_TAB",
          url: message.url,
          options: message.options
        })
        .then((response) => {
          if (!response || !response.ok) {
            console.warn("[FSU extension] GM_openInTab failed:", response && response.error);
          }
        });
    }
  }

  class ContentBridgeApp {
    constructor({ windowRef, documentRef, chromeApi, scripts }) {
      this.storage = new ExtensionStorage(chromeApi.storage.local, chromeApi.runtime);
      this.injector = new ScriptInjector({ documentRef, runtimeApi: chromeApi.runtime });
      this.pageBridge = new PageBridge({
        windowRef,
        storage: this.storage,
        messenger: new RuntimeMessenger(chromeApi.runtime)
      });
      this.scripts = scripts;
    }

    async boot() {
      this.pageBridge.start();
      const storage = await this.storage.getAll();
      await this.injector.injectAll(this.scripts, storage);
    }
  }

  new ContentBridgeApp({
    windowRef: globalScope,
    documentRef: globalScope.document,
    chromeApi: globalScope.chrome,
    scripts: INJECTED_SCRIPTS
  })
    .boot()
    .catch((error) => {
      console.error("[FSU extension] Failed to bootstrap userscript:", error);
    });
})(window);
