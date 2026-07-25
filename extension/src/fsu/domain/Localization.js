/**
 * Create localization dictionary lookup helpers.
 * @param {() => any} getState
 * @returns {{ fy: (key: any) => string, eafy: (key: any) => string }}
 */
export function createLocalization(getState) {
  /**
   * @param {any} key
   * @returns {string}
   */
  const fy = function (key) {
    if (key == null) return "";
    if (typeof key !== "string" && !Array.isArray(key)) return String(key);

    const state = getState();
    const dictionary = state.localization || {};
    const language = state.language ?? 2;

    if (Array.isArray(key)) {
      const parts = [...key];
      const dictKey = parts.shift();
      if (!dictKey || !dictionary[dictKey]) return String(dictKey ?? "");
      let text = dictionary[dictKey][language] ?? "";
      const substitutions = parts.slice();

      for (const index in substitutions) {
        text = text.replace(`%${Number(index) + 1}`, `${substitutions[index]}`);
      }
      return text;
    }

    if (typeof key === "string" && key.indexOf("{") !== -1) {
      let text = key;
      const placeholders = key.match(/{(.*?)}/g) || [];

      for (const placeholder of placeholders) {
        const match = placeholder.match(/{(.*?)}/);
        const field = match ? match[1] : "";
        if (field && Object.prototype.hasOwnProperty.call(dictionary, field)) {
          text = text.replace(placeholder, dictionary[field][language]);
        }
      }
      return text;
    }

    return Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key][language] : key;
  };

  /**
   * @param {any} key
   * @returns {string}
   */
  const eafy = function (key) {
    if (key == null) return "";
    const state = getState();
    return state.base?.localization?.[key] ?? key;
  };

  return { fy, eafy };
}