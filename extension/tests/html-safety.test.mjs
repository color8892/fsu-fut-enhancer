import assert from "assert";
import {
  appendText,
  createExternalLink,
  createTextElement,
  createTrustedMarkup,
  escapeHtml,
  isTrustedMarkup,
  normalizeExternalUrl,
  setTrustedHtml
} from "../src/fsu/ui/HtmlSafety.js";
import { createElementWithConfig } from "../src/fsu/ui/UiFactory.js";

function createFakeDocument() {
  return {
    createElement(tag) {
      return {
        tag,
        className: "",
        href: "",
        target: "",
        rel: "",
        textContent: "",
        children: [],
        appendChild(child) {
          this.children.push(child);
        },
        replaceChildren(...children) {
          this.children = children;
        }
      };
    },
    createTextNode(text) {
      return { nodeType: 3, textContent: text };
    },
    createRange() {
      return {
        createContextualFragment(html) {
          return { nodeType: 11, html };
        }
      };
    }
  };
}

export function runHtmlSafetyTests() {
  assert.strictEqual(
    escapeHtml(`<img src=x onerror="alert('x')"> & safe`),
    "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; safe"
  );
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

  const documentRef = createFakeDocument();
  const badge = createTextElement("span", "<b>3</b>", {
    className: "fsu-fcount",
    documentRef
  });
  assert.strictEqual(badge.tag, "span");
  assert.strictEqual(badge.className, "fsu-fcount");
  assert.strictEqual(badge.textContent, "<b>3</b>");

  appendText(badge, "<script>alert(1)</script>", documentRef);
  assert.deepStrictEqual(badge.children, [
    { nodeType: 3, textContent: "<script>alert(1)</script>" }
  ]);

  const trusted = createTrustedMarkup("<span>trusted</span>");
  assert.equal(isTrustedMarkup(trusted), true);
  assert.equal(isTrustedMarkup("<span>trusted</span>"), false);
  assert.equal(isTrustedMarkup({ html: "<span>nope</span>" }), false);

  setTrustedHtml(badge, trusted, documentRef);
  assert.deepStrictEqual(badge.children, [
    { nodeType: 11, html: "<span>trusted</span>" }
  ]);

  assert.throws(
    () => setTrustedHtml(badge, "<img onerror=1>", documentRef),
    /Trusted HTML APIs only accept/
  );

  // createElementWithConfig rejects HTML sinks and event handlers.
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        classList: { add() {} },
        style: { setProperty() {} },
        setAttribute() {},
        children: []
      };
    },
    location: { href: "https://www.ea.com/" }
  };
  try {
    assert.throws(
      () => createElementWithConfig("div", { innerHTML: "<img onerror=1>" }),
      /forbids HTML\/event sinks/
    );
    assert.throws(
      () => createElementWithConfig("div", { outerHTML: "<x>" }),
      /forbids HTML\/event sinks/
    );
    assert.throws(
      () => createElementWithConfig("div", { srcdoc: "<x>" }),
      /forbids HTML\/event sinks/
    );
    assert.throws(
      () => createElementWithConfig("div", { onclick: () => {} }),
      /forbids HTML\/event sinks/
    );
    assert.throws(
      () =>
        createElementWithConfig("div", {
          attributes: { onerror: "alert(1)" }
        }),
      /forbids event attributes/
    );

    const textOnly = createElementWithConfig("div", {
      textContent: "<img onerror=1>",
      classList: ["safe"]
    });
    assert.strictEqual(textOnly.textContent, "<img onerror=1>");
  } finally {
    if (originalDocument) {
      globalThis.document = originalDocument;
    } else {
      delete globalThis.document;
    }
  }

  // Localization-like strings stay text.
  const loc = createTextElement("div", "Price < 1000 & safe", {
    documentRef: createFakeDocument()
  });
  assert.strictEqual(loc.textContent, "Price < 1000 & safe");
}
