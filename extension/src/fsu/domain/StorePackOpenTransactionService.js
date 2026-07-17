import {
  STORE_PACK_OPEN_ERROR_CODES,
  storePackOpenFailure
} from "./StorePackOpenResults.js";

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object";
}

export class StorePackOpenTransactionService {
  /**
   * @param {{
   *   adapter: {
   *     prepare: (controller: unknown, args: unknown[]) => unknown,
   *     readCompletion: (packId: number) => unknown
   *   },
   *   timeoutMs?: number,
   *   settleMs?: number,
   *   pollMs?: number,
   *   now?: () => number,
   *   setTimer?: (callback: () => void, delay: number) => unknown
   * }} options
   */
  constructor({
    adapter,
    timeoutMs = 15_000,
    settleMs = 250,
    pollMs = 50,
    now = () => Date.now(),
    setTimer = (callback, delay) => setTimeout(callback, delay)
  }) {
    this.adapter = adapter;
    this.timeoutMs = timeoutMs;
    this.settleMs = settleMs;
    this.pollMs = pollMs;
    this.now = now;
    this.setTimer = setTimer;
    /** @type {Map<string, unknown>} */
    this.inFlight = new Map();
  }

  /**
   * @param {{
   *   controller: Record<string, unknown>,
   *   args: unknown[],
   *   invoke: () => unknown,
   *   onSuccess: (result: {
   *     packId: number,
   *     remainingCount: number,
   *     availablePackIds: number[]
   *   }) => void,
   *   onDiagnostic?: (result: unknown) => void
   * }} options
   */
  intercept({
    controller,
    args,
    invoke,
    onSuccess,
    onDiagnostic = () => {}
  }) {
    let prepared;
    try {
      prepared = this.adapter.prepare(controller, args);
    } catch {
      prepared = storePackOpenFailure(
        STORE_PACK_OPEN_ERROR_CODES.PRECONDITION,
        ["pack.adapter.prepare"]
      );
    }
    if (
      !isRecord(prepared) ||
      prepared.success !== true ||
      !isRecord(prepared.data)
    ) {
      onDiagnostic(prepared);
      return invoke();
    }
    const selection = prepared.data;
    if (selection.tracked !== true) return invoke();
    if (
      typeof selection.key !== "string" ||
      !Number.isInteger(selection.packId) ||
      !Number.isInteger(selection.initialCount)
    ) {
      onDiagnostic(
        storePackOpenFailure(STORE_PACK_OPEN_ERROR_CODES.PRECONDITION, [
          "pack.selection"
        ])
      );
      return invoke();
    }
    const key = selection.key;
    const packId = Number(selection.packId);
    const initialCount = Number(selection.initialCount);

    if (
      this.inFlight.size > 0 ||
      controller.isOpeningPack === true
    ) {
      onDiagnostic(
        storePackOpenFailure(STORE_PACK_OPEN_ERROR_CODES.DUPLICATE, [
          "pack.open-in-flight"
        ])
      );
      return undefined;
    }

    /** @type {{
     *   startedAt: number,
     *   sawOpening: boolean,
     *   completedAt: number | undefined
     * }} */
    const transaction = {
      startedAt: this.now(),
      sawOpening: false,
      completedAt: undefined
    };
    this.inFlight.set(key, transaction);

    let returnValue;
    try {
      returnValue = invoke();
    } catch (error) {
      this.inFlight.delete(key);
      throw error;
    }
    transaction.sawOpening = controller.isOpeningPack === true;

    const poll = () => {
      if (this.inFlight.get(key) !== transaction) return;
      let completion;
      try {
        completion = this.adapter.readCompletion(packId);
      } catch {
        completion = storePackOpenFailure(
          STORE_PACK_OPEN_ERROR_CODES.INVENTORY,
          ["pack.adapter.readCompletion"]
        );
      }
      if (
        !isRecord(completion) ||
        completion.success !== true ||
        !isRecord(completion.data) ||
        !Number.isInteger(completion.data.remainingCount) ||
        !Array.isArray(completion.data.availablePackIds) ||
        !completion.data.availablePackIds.every(Number.isInteger)
      ) {
        onDiagnostic(completion);
        return;
      }
      const remainingCount = Number(completion.data.remainingCount);
      const availablePackIds = completion.data.availablePackIds.map(Number);
      if (remainingCount < initialCount) {
        this.inFlight.delete(key);
        onSuccess({
          packId,
          remainingCount,
          availablePackIds
        });
        return;
      }

      const currentTime = this.now();
      if (controller.isOpeningPack === true) {
        transaction.sawOpening = true;
        transaction.completedAt = undefined;
      } else if (transaction.sawOpening) {
        transaction.completedAt ??= currentTime;
        if (currentTime - transaction.completedAt >= this.settleMs) {
          this.inFlight.delete(key);
          onDiagnostic(
            storePackOpenFailure(STORE_PACK_OPEN_ERROR_CODES.REJECTED, [
              "pack.inventory-unchanged"
            ])
          );
          return;
        }
      }

      if (currentTime - transaction.startedAt >= this.timeoutMs) {
        onDiagnostic(
          storePackOpenFailure(STORE_PACK_OPEN_ERROR_CODES.TIMEOUT, [
            "pack.open-timeout"
          ])
        );
        return;
      }
      this.setTimer(poll, this.pollMs);
    };
    this.setTimer(poll, this.pollMs);
    return returnValue;
  }
}
