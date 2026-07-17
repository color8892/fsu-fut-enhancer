/**
 * @param {HTMLElement | null | undefined} element
 * @param {number} total
 * @returns {boolean}
 */
export function renderSquadPrice(element, total) {
  if (!element || !Number.isFinite(total)) return false;
  element.innerText = Math.max(0, total).toLocaleString();
  return true;
}
