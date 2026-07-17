import { EaObservableAdapter } from "../ea/EaObservableAdapter.js";
import {
  SBC_SUBMIT_ERROR_CODES,
  parseSbcSubmitResponse,
  sbcSubmitFailure
} from "./SbcSubmitResults.js";

/**
 * Minimal observable-compatible rejection used when submit preconditions fail.
 */
class RejectedSubmitObservable {
  /** @param {Record<string, unknown>} response */
  constructor(response) {
    this.response = response;
  }

  /**
   * @param {object} context
   * @param {(sender: unknown, response: unknown) => void} callback
   */
  observe(context, callback) {
    queueMicrotask(() => callback(this, this.response));
    return this;
  }

  unobserve() {}
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object";
}

export class SbcSubmitTransactionService {
  /**
   * @param {{ observableAdapter?: EaObservableAdapter }} [options]
   */
  constructor({ observableAdapter = new EaObservableAdapter() } = {}) {
    this.observableAdapter = observableAdapter;
    /** @type {Map<string, Record<string, unknown>>} */
    this.inFlight = new Map();
  }

  /**
   * @param {{
   *   args: unknown[],
   *   observerContext: object,
   *   invoke: () => unknown,
   *   onSuccess: (response: Record<string, unknown>) => void,
   *   onDiagnostic?: (result: unknown) => void
   * }} options
   */
  intercept({
    args,
    observerContext,
    invoke,
    onSuccess,
    onDiagnostic = () => {}
  }) {
    const challenge = args[0];
    const setEntity = args[1];
    const challengeId = Number(
      isRecord(challenge) ? challenge.id : undefined
    );
    let canSubmit;
    try {
      canSubmit =
        isRecord(challenge) &&
        typeof challenge.canSubmit === "function" &&
        challenge.canSubmit() === true;
    } catch {
      canSubmit = false;
    }
    if (
      !Number.isInteger(challengeId) ||
      challengeId <= 0 ||
      !isRecord(setEntity) ||
      !canSubmit
    ) {
      const result = sbcSubmitFailure(
        SBC_SUBMIT_ERROR_CODES.PRECONDITION,
        ["challenge.id", "challenge.canSubmit", "set"]
      );
      onDiagnostic(result);
      return new RejectedSubmitObservable({
        success: false,
        status: 400,
        error: result.error
      });
    }

    const key = String(challengeId);
    const existing = this.inFlight.get(key);
    if (existing) {
      const result = sbcSubmitFailure(
        SBC_SUBMIT_ERROR_CODES.IN_FLIGHT,
        ["challenge.submit-in-flight"]
      );
      onDiagnostic(result);
      return new RejectedSubmitObservable({
        success: false,
        status: 409,
        error: result.error
      });
    }

    let observable;
    try {
      observable = invoke();
    } catch {
      const result = sbcSubmitFailure(
        SBC_SUBMIT_ERROR_CODES.INVALID_RESPONSE,
        ["submit.invoke-threw"]
      );
      onDiagnostic(result);
      return new RejectedSubmitObservable({
        success: false,
        status: 500,
        error: result.error
      });
    }
    if (!isRecord(observable) || typeof observable.observe !== "function") {
      const result = sbcSubmitFailure(
        SBC_SUBMIT_ERROR_CODES.INVALID_RESPONSE,
        ["submit.observable"]
      );
      onDiagnostic(result);
      return new RejectedSubmitObservable({
        success: false,
        status: 500,
        error: result.error
      });
    }

    this.inFlight.set(key, observable);
    let responseObserved = false;
    this.observableAdapter
      .observeOnce(observable, observerContext, "sbc.submit-challenge")
      .then((observed) => {
        if (!observed.success) {
          onDiagnostic(observed);
          return;
        }
        responseObserved = true;
        const result = parseSbcSubmitResponse(observed.data);
        if (!result.success) {
          onDiagnostic(result);
          return;
        }
        onSuccess(result.data);
      })
      .catch(() => {
        onDiagnostic(
          sbcSubmitFailure(SBC_SUBMIT_ERROR_CODES.INVALID_RESPONSE, [
            "submit.monitor-threw"
          ])
        );
      })
      .finally(() => {
        if (
          responseObserved &&
          this.inFlight.get(key) === observable
        ) {
          this.inFlight.delete(key);
        }
      });
    return observable;
  }
}
