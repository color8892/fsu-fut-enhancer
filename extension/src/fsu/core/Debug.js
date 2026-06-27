export const FSU_DEBUG = false;

export function createDebug(enabled = FSU_DEBUG) {
  return {
    log(...args) {
      if (enabled) {
        console.log(...args);
      }
    },
    warn(...args) {
      if (enabled) {
        console.warn(...args);
      }
    }
  };
}