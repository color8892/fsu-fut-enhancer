/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object";
}

/**
 * @param {{
 *   isPhone: boolean,
 *   currentController: unknown,
 *   rightController: unknown
 * }} options
 * @returns {{ controller: Record<string, unknown>, panelView: unknown } | null}
 */
export function resolvePlayerDetailsTarget(options) {
  const candidate = options.isPhone
    ? options.currentController
    : options.rightController;
  if (!isRecord(candidate)) return null;
  const controller =
    "rootController" in candidate &&
    isRecord(candidate.rootController)
      ? candidate.rootController
      : candidate;
  const panelView = controller.panelView ?? controller.panel;
  return panelView ? { controller, panelView } : null;
}

/**
 * @param {unknown} value
 * @returns {{ item: Record<string, unknown>, definitionId: number } | null}
 */
export function resolvePlayerDetailsItem(value) {
  if (
    !isRecord(value) ||
    typeof value.isPlayer !== "function" ||
    !Number.isInteger(value.definitionId) ||
    Number(value.definitionId) < 0
  ) {
    return null;
  }
  try {
    if (value.isPlayer.call(value) !== true) return null;
  } catch {
    return null;
  }
  return { item: value, definitionId: Number(value.definitionId) };
}
