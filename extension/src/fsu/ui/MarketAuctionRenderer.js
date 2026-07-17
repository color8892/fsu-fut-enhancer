/**
 * EA controls remain at the UI boundary. The domain service only supplies
 * normalized price rows.
 *
 * @param {unknown} anchor
 * @param {{ price: number, count: number }[]} rows
 * @param {{
 *   createControl: () => unknown,
 *   createButton: (control: unknown, label: string, onClick: () => void, style: string) => unknown,
 *   localize: (key: string) => string
 * }} deps
 * @returns {boolean}
 */
export function renderAuctionPriceBreakdown(anchor, rows, deps) {
  if (
    !anchor ||
    typeof anchor.getRootElement !== "function" ||
    typeof deps.createControl !== "function"
  ) {
    return false;
  }

  const parent = anchor.getRootElement()?.parentNode;
  if (!parent) return false;

  for (const [index, row] of rows.entries()) {
    const control = deps.createControl();
    if (!control) return false;
    const displayElement = deps.createButton(
      control,
      `${deps.localize("quicklist.getpricelt")} ${index + 1}`,
      () => {},
      "accordian"
    );
    if (
      !displayElement ||
      typeof displayElement.setInteractionState !== "function" ||
      typeof displayElement.getRootElement !== "function" ||
      typeof displayElement.setSubtext !== "function" ||
      typeof displayElement.displayCurrencyIcon !== "function"
    ) {
      return false;
    }

    const root = displayElement.getRootElement();
    if (!root?.style) return false;
    displayElement.setInteractionState(0);
    root.style.fontSize = "87.5%";
    displayElement.setSubtext(`${row.price.toLocaleString()} ×${row.count}`);
    displayElement.displayCurrencyIcon(true);
    parent.appendChild(root);
  }

  return true;
}
