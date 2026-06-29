/**
 * Optional WASM bridge for fsu-core logic.
 * Falls back silently when WASM is unavailable.
 */

let initPromise = null;
let active = false;

function getGlobalScope() {
  return typeof unsafeWindow !== "undefined" ? unsafeWindow : globalThis;
}

function readExport(globalScope, name) {
  const value = globalScope[name];
  return typeof value === "function" ? value : null;
}

export function isWasmCoreReady() {
  return active;
}

export function getWasmCoreVersion() {
  const wasm = getGlobalScope().__fsuWasm?.version;
  if (!wasm) {
    return null;
  }

  try {
    return wasm();
  } catch (_error) {
    return null;
  }
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = false;
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Failed to load ${url}`));
    };
    (document.head || document.documentElement).appendChild(script);
  });
}

export function initWasmCore() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const globalScope = getGlobalScope();
    const assets = globalScope.__FSU_ASSETS__;
    if (!assets?.wasmModule) {
      return false;
    }

    let init = readExport(globalScope, "wasm_bindgen");
    if (!init && assets.wasmGlue) {
      await loadScript(assets.wasmGlue);
      init = readExport(globalScope, "wasm_bindgen");
    }

    if (!init) {
      return false;
    }

    await init(assets.wasmModule);

    const bridge = {
      version: readExport(globalScope, "fsuWasmVersion"),
      teamRatingCount: readExport(globalScope, "fsuTeamRatingCount"),
      priceLastDiff: readExport(globalScope, "fsuPriceLastDiff"),
      calculateChemistry: readExport(globalScope, "fsuCalculateChemistry"),
      needRatingsCount: readExport(globalScope, "fsuNeedRatingsCount"),
      generateCandidateOptions: readExport(globalScope, "fsuGenerateCandidateOptions")
    };

    if (!bridge.teamRatingCount) {
      return false;
    }

    globalScope.__fsuWasm = bridge;
    active = true;
    return true;
  })().catch(() => {
    active = false;
    return false;
  });

  return initPromise;
}

export function wasmTeamRatingCount(ratings, jsFallback) {
  const wasm = getGlobalScope().__fsuWasm?.teamRatingCount;
  if (!wasm) {
    return jsFallback(ratings);
  }

  try {
    return wasm(Int32Array.from(ratings));
  } catch (_error) {
    return jsFallback(ratings);
  }
}

export function wasmPriceLastDiff(purchasePrice, lastPrice, jsFallback) {
  const wasm = getGlobalScope().__fsuWasm?.priceLastDiff;
  if (!wasm) {
    return jsFallback(purchasePrice, lastPrice);
  }

  try {
    return wasm(purchasePrice, lastPrice);
  } catch (_error) {
    return jsFallback(purchasePrice, lastPrice);
  }
}

function normalizeChemistryArgs(basePlayers, index, candidate, includeMeta = false) {
  if (typeof index === "boolean") {
    includeMeta = index;
    index = undefined;
    candidate = undefined;
  } else if (typeof candidate === "boolean") {
    includeMeta = candidate;
    candidate = undefined;
  }

  return { basePlayers, index, candidate, includeMeta };
}

function playerToWasmDto(player) {
  if (!player) {
    return null;
  }

  return {
    nation_id: player.nationId ?? -1,
    league_id: player.leagueId ?? -1,
    team_id: player.teamId ?? -1
  };
}

function mapWasmChemistryResult(raw, includeMeta) {
  const result = {
    totalChemistry: raw.total_chemistry
  };

  if (raw.player_chemistry != null) {
    result.playerChemistry = raw.player_chemistry;
  }

  if (includeMeta) {
    result.meta = {
      nations: raw.nations ?? [],
      leagues: raw.leagues ?? [],
      clubs: raw.clubs ?? []
    };
  }

  return result;
}

function mapWasmNeedRatingsResults(raw) {
  return raw.map((entry) => ({
    ratings: entry.ratings,
    sum: entry.sum,
    squadRating: entry.squad_rating,
    existValue: entry.exist_value,
    existRatings: entry.exist_ratings,
    lackValue: entry.lack_value,
    lackRatings: entry.lack_ratings
  }));
}

function mapWasmCandidateResults(raw) {
  return raw.map((entry) => {
    const cleaned = {};
    if (entry.nation_id != null) cleaned.nationId = entry.nation_id;
    if (entry.league_id != null) cleaned.leagueId = entry.league_id;
    if (entry.team_id != null) cleaned.teamId = entry.team_id;
    return cleaned;
  });
}

export function wasmGenerateCandidateOptions(options, jsFallback) {
  const wasm = getGlobalScope().__fsuWasm?.generateCandidateOptions;
  if (!wasm) {
    return jsFallback();
  }

  try {
    const raw = JSON.parse(wasm(JSON.stringify(options)));
    return mapWasmCandidateResults(raw);
  } catch (_error) {
    return jsFallback();
  }
}

export function wasmNeedRatingsCount(options, jsFallback) {
  const wasm = getGlobalScope().__fsuWasm?.needRatingsCount;
  if (!wasm) {
    return jsFallback(options);
  }

  try {
    const raw = JSON.parse(wasm(JSON.stringify(options)));
    return mapWasmNeedRatingsResults(raw);
  } catch (_error) {
    return jsFallback(options);
  }
}

export function wasmCalculateChemistry(basePlayers, index, candidate, includeMeta, jsFallback) {
  const wasm = getGlobalScope().__fsuWasm?.calculateChemistry;
  if (!wasm) {
    return jsFallback(basePlayers, index, candidate, includeMeta);
  }

  const normalized = normalizeChemistryArgs(basePlayers, index, candidate, includeMeta);

  try {
    const payload = {
      players: normalized.basePlayers.map(playerToWasmDto),
      skip_index: normalized.index ?? null,
      candidate: normalized.candidate ? playerToWasmDto(normalized.candidate) : null,
      include_meta: normalized.includeMeta
    };
    const raw = JSON.parse(wasm(JSON.stringify(payload)));
    return mapWasmChemistryResult(raw, normalized.includeMeta);
  } catch (_error) {
    return jsFallback(basePlayers, index, candidate, includeMeta);
  }
}