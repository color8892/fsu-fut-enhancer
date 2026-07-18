const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);
const HTML_ESCAPE_PATTERN = /[&<>'"]/g;
/** @type {Record<string, string>} */
const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
};

/** Brand for extension-owned markup. Not exposed on window. */
const TRUSTED_MARKUP_BRAND = Symbol("fsu.trustedMarkup");

/**
 * @typedef {{ readonly [TRUSTED_MARKUP_BRAND]: true, readonly html: string }} TrustedMarkup
 */

/** @param {unknown} value */
export function escapeHtml(value) {
  return String(value ?? "").replace(
    HTML_ESCAPE_PATTERN,
    (character) => HTML_ESCAPES[character] ?? character
  );
}

/**
 * Create branded markup from extension-owned constants (and escaped dynamics).
 * The brand constructor is not attached to window / unsafeWindow.
 * @param {unknown} html
 * @returns {TrustedMarkup}
 */
export function createTrustedMarkup(html) {
  /** @type {TrustedMarkup} */
  const markup = Object.freeze({
    [TRUSTED_MARKUP_BRAND]: /** @type {const} */ (true),
    html: String(html ?? "")
  });
  return markup;
}

/**
 * @param {unknown} value
 * @returns {value is TrustedMarkup}
 */
export function isTrustedMarkup(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    /** @type {{ [key: symbol]: unknown }} */ (value)[TRUSTED_MARKUP_BRAND] === true &&
    typeof /** @type {{ html?: unknown }} */ (value).html === "string"
  );
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function requireTrustedHtml(value) {
  if (isTrustedMarkup(value)) {
    return value.html;
  }
  throw new TypeError(
    "Trusted HTML APIs only accept createTrustedMarkup() values, not plain strings"
  );
}

/**
 * @param {unknown} url
 * @param {string} [baseUrl]
 */
export function normalizeExternalUrl(url, baseUrl) {
  const rawUrl = String(url ?? "").trim();
  if (!/^https?:\/\//i.test(rawUrl)) {
    return "";
  }

  try {
    const parsed = new URL(rawUrl, baseUrl || document.location.href);
    return SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

/**
 * @param {{ href?: unknown, text?: unknown, className?: string, documentRef?: Document, baseUrl?: string }} [options]
 */
export function createExternalLink({ href, text, className, documentRef = document, baseUrl } = {}) {
  const link = documentRef.createElement("a");
  const safeHref = normalizeExternalUrl(href, baseUrl);

  if (className) {
    link.className = className;
  }
  link.href = safeHref || "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = text == null ? "" : String(text);

  return link;
}

/**
 * @param {Element} element
 * @param {unknown} text
 * @param {Document} [documentRef]
 */
export function appendText(element, text, documentRef = document) {
  element.appendChild(documentRef.createTextNode(String(text ?? "")));
}

/**
 * @param {string} tagName
 * @param {unknown} text
 * @param {{ className?: string, documentRef?: Document }} [options]
 */
export function createTextElement(tagName, text, { className, documentRef = document } = {}) {
  const element = documentRef.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = String(text ?? "");
  return element;
}

/**
 * Only use with markup assembled entirely from extension-owned constants
 * via {@link createTrustedMarkup}.
 * @param {TrustedMarkup} markup
 * @param {Document} [documentRef]
 */
export function createTrustedHtmlFragment(markup, documentRef = document) {
  return documentRef.createRange().createContextualFragment(requireTrustedHtml(markup));
}

/**
 * @param {Element} element
 * @param {TrustedMarkup} markup
 * @param {Document} [documentRef]
 */
export function setTrustedHtml(element, markup, documentRef = document) {
  element.replaceChildren(createTrustedHtmlFragment(markup, documentRef));
}

export const HTML_CONFIG_FORBIDDEN_KEYS = Object.freeze([
  "innerHTML",
  "outerHTML",
  "srcdoc"
]);
