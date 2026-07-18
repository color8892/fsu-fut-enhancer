import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { Window as HappyDomWindow } from "happy-dom";

type EmbeddedWindow = HappyDomWindow & {
  GM_addStyle: (css: string) => HTMLStyleElement;
  GM_xmlhttpRequest: (details: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    onload: (response: { status: number; responseText: string }) => void;
    onerror: (response: unknown) => void;
  }) => void;
  __TAURI_INTERNALS__?: {
    invoke: (command: string, args: unknown) => Promise<unknown>;
  };
};

function loadHost(): EmbeddedWindow {
  const browser = new HappyDomWindow({
    url: "https://www.ea.com/ea-sports-fc/ultimate-team/web-app/"
  }) as EmbeddedWindow;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = fs.readFileSync(
    path.resolve(here, "../../resources/fsu/embedded-host.js"),
    "utf8"
  );
  browser.eval(source);
  return browser;
}

describe("embedded host runtime", () => {
  it("provides a working GM_addStyle", () => {
    const browser = loadHost();
    const style = browser.GM_addStyle(".fsu-test { color: red; }");

    assert.equal(style.tagName, "STYLE");
    assert.equal(style.textContent, ".fsu-test { color: red; }");
    assert.equal(style.dataset.fsuEmbeddedStyle, "1");
    assert.equal(style.parentElement?.tagName, "HEAD");
  });

  it("routes GM_xmlhttpRequest through the Tauri bridge", async () => {
    const browser = loadHost();
    const invocations: Array<{ command: string; args: unknown }> = [];
    browser.__TAURI_INTERNALS__ = {
      async invoke(command, args) {
        invocations.push({ command, args });
        return {
          finalUrl: "https://api.fut.to/26/updata.json",
          readyState: 4,
          status: 200,
          statusText: "OK",
          responseHeaders: "content-type: application/json",
          responseText: "{\"ok\":true}",
          response: "{\"ok\":true}"
        };
      }
    };

    const response = await new Promise<{ status: number; responseText: string }>(
      (resolve, reject) => {
        browser.GM_xmlhttpRequest({
          method: "GET",
          url: "https://api.fut.to/26/updata.json",
          headers: { "Content-Type": "application/json" },
          onload: resolve,
          onerror: reject
        });
      }
    );

    assert.equal(invocations[0]?.command, "embedded_http_request");
    const args = invocations[0]?.args as {
      request: {
        method: string;
        url: string;
        headers: Record<string, string>;
        timeout?: number;
      };
    };
    assert.equal(args.request.method, "GET");
    assert.equal(args.request.url, "https://api.fut.to/26/updata.json");
    assert.equal(args.request.headers["Content-Type"], "application/json");
    assert.equal(args.request.timeout, undefined);
    assert.equal(response.status, 200);
    assert.equal(response.responseText, "{\"ok\":true}");
  });
});
