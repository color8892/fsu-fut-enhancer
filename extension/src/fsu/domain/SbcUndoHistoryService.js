/**
 * @typedef {{
 *   snapshots?: ReadonlyArray<ReadonlyArray<unknown>>,
 *   index?: number
 * }} UndoHistoryState
 */

/** @param {unknown} item */
function itemFingerprint(item) {
  if (!item || typeof item !== "object") return "empty";
  const record = /** @type {Record<string, unknown>} */ (item);
  return [
    record.id ?? "",
    record.definitionId ?? "",
    record.concept === true ? "concept" : "owned"
  ].join(":");
}

/** @param {ReadonlyArray<unknown>} snapshot */
function snapshotFingerprint(snapshot) {
  return snapshot.map(itemFingerprint).join("|");
}

export class SbcUndoHistoryService {
  /**
   * @param {UndoHistoryState | null | undefined} state
   * @param {unknown} players
   */
  capture(state, players) {
    if (!Array.isArray(players)) return state;
    const snapshots = Array.isArray(state?.snapshots)
      ? [...state.snapshots]
      : [];
    const index =
      state && Number.isInteger(state.index) ? Number(state.index) : -1;
    const snapshot = Object.freeze([...players]);
    const current = snapshots[index];
    if (
      Array.isArray(current) &&
      snapshotFingerprint(current) === snapshotFingerprint(snapshot)
    ) {
      return { snapshots, index, changed: false };
    }
    snapshots.splice(index + 1);
    snapshots.push(snapshot);
    return {
      snapshots,
      index: snapshots.length - 1,
      changed: true
    };
  }

  /**
   * @param {UndoHistoryState | null | undefined} state
   * @param {number} slotIndex
   * @param {unknown} item
   */
  replaceCurrentItem(state, slotIndex, item) {
    const snapshots = Array.isArray(state?.snapshots)
      ? [...state.snapshots]
      : [];
    const index =
      state && Number.isInteger(state.index) ? Number(state.index) : -1;
    const current = snapshots[index];
    if (
      !Array.isArray(current) ||
      !Number.isInteger(slotIndex) ||
      slotIndex < 0 ||
      slotIndex >= current.length
    ) {
      return { snapshots, index, changed: false };
    }
    const replacement = [...current];
    replacement[slotIndex] = item;
    snapshots[index] = Object.freeze(replacement);
    return { snapshots, index, changed: true };
  }
}
