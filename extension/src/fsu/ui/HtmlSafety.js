const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);

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

export function createTrustedHtmlFragment(html) {
  return document.createRange().createContextualFragment(String(html ?? ""));
}

export function setTrustedHtml(element, html) {
  element.replaceChildren(createTrustedHtmlFragment(html));
}
