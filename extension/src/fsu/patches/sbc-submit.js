export function installSbcSubmitPatch({ sbcCountService, onCountChanged }) {
  const originalSubmitChallenge = UTSBCService.prototype.submitChallenge;

  UTSBCService.prototype.submitChallenge = function (...args) {
    const result = originalSubmitChallenge.apply(this, args);
    const service = this;

    result.observe(this, function (observer, response) {
      observer.unobserve(service);

      if (response.success) {
        sbcCountService.recordCompletion();
        onCountChanged();
      }
    });

    return result;
  };
}