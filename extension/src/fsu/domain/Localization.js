export function createLocalization(getState) {
  const fy = function (key) {
    if (key == null) return "";
    if (typeof key !== "string" && !Array.isArray(key)) return String(key);

    const state = getState();
    const dictionary = state.localization || {};
    const language = state.language ?? 2;
    let text;

    if (Array.isArray(key)) {
      const parts = _.cloneDeep(key);
      const dictKey = parts.shift();
      if (!dictKey || !dictionary[dictKey]) return String(dictKey ?? "");
      text = dictionary[dictKey][language] ?? "";
      const substitutions = parts.slice();

      for (const index in substitutions) {
        text = text.replace(`%${Number(index) + 1}`, `${substitutions[index]}`);
      }
    } else if (key.indexOf("{") !== -1) {
      text = key;
      const placeholders = key.match(/{(.*?)}/g);

      for (const placeholder of placeholders) {
        const field = placeholder.match(/{(.*?)}/)[1];
        if (dictionary.hasOwnProperty(field)) {
          text = text.replace(placeholder, dictionary[field][language]);
        }
      }
    } else {
      text = dictionary.hasOwnProperty(key) ? dictionary[key][language] : key;
    }

    return text;
  };

  const eafy = function (key) {
    if (key == null) return "";
    const state = getState();
    return state.base?.localization?.[key] ?? key;
  };

  return { fy, eafy };
}