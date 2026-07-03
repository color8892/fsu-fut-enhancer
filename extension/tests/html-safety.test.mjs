import assert from "assert";
import { createExternalLink, normalizeExternalUrl } from "../src/fsu/ui/HtmlSafety.js";

function createFakeDocument() {
  return {
    createElement(tag) {
      return {
        tag,
        className: "",
        href: "",
        target: "",
        rel: "",
        textContent: ""
      };
    }
  };
}

export function runHtmlSafetyTests() {
  assert.strictEqual(
    normalizeExternalUrl("https://example.com/path", "https://www.ea.com/"),
    "https://example.com/path"
  );
  assert.strictEqual(normalizeExternalUrl("javascript:alert(1)", "https://www.ea.com/"), "");
  assert.strictEqual(normalizeExternalUrl("not a url", "https://www.ea.com/base/"), "");

  const link = createExternalLink({
    href: "javascript:alert(1)",
    text: "<b>Upgrade</b>",
    className: "header_explain",
    documentRef: createFakeDocument(),
    baseUrl: "https://www.ea.com/"
  });

  assert.strictEqual(link.tag, "a");
  assert.strictEqual(link.className, "header_explain");
  assert.strictEqual(link.href, "#");
  assert.strictEqual(link.target, "_blank");
  assert.strictEqual(link.rel, "noopener noreferrer");
  assert.strictEqual(link.textContent, "<b>Upgrade</b>");
}
