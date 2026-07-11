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

/** @param {unknown} value */
export function escapeHtml(value) {
  return String(value ?? "").replace(
    HTML_ESCAPE_PATTERN,
    (character) => HTML_ESCAPES[character] ?? character
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
 * Only use with markup assembled entirely from extension-owned constants.
 * @param {unknown} html
 * @param {Document} [documentRef]
 */
export function createTrustedHtmlFragment(html, documentRef = document) {
  return documentRef.createRange().createContextualFragment(String(html ?? ""));
}

/**
 * @param {Element} element
 * @param {unknown} html
 * @param {Document} [documentRef]
 */
export function setTrustedHtml(element, html, documentRef = document) {
  element.replaceChildren(createTrustedHtmlFragment(html, documentRef));
}
