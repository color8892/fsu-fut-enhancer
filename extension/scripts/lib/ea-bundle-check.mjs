import crypto from "crypto";
import fs from "fs";
import path from "path";

const BUNDLE_GLOB = /^compiled_\d+\.js$|^ocompiled\.js$/;
const PROTOTYPE_HOOK_RE = /(UT[A-Z][a-zA-Z0-9]+)\.prototype\.([a-zA-Z0-9_]+)/g;
const INSTANCEOF_RE = /instanceof\s+(UT[A-Z][a-zA-Z0-9]+)/g;
const CLASSNAME_RE = /className\s*==\s*["'](UT[A-Z][a-zA-Z0-9]+)["']/g;

export function listBundleFiles(bundleDir) {
  if (!fs.existsSync(bundleDir)) {
    return [];
  }
  return fs
    .readdirSync(bundleDir)
    .filter((name) => BUNDLE_GLOB.test(name))
    .sort()
    .map((name) => path.join(bundleDir, name));
}

export function loadBundles(bundleDir) {
  const files = listBundleFiles(bundleDir);
  const bundles = {};
  for (const filePath of files) {
    const name = path.basename(filePath);
    const content = fs.readFileSync(filePath, "utf8");
    bundles[name] = {
      path: filePath,
      content,
      size: content.length,
      sha256: crypto.createHash("sha256").update(content).digest("hex"),
    };
  }
  return bundles;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function patchRequiresEaMethod(patchContent, className, methodName) {
  const escapedClass = escapeRegExp(className);
  const escapedMethod = escapeRegExp(methodName);
  const savesOriginal = new RegExp(
    `(?:const|let|var)\\s+\\w+\\s*=\\s*${escapedClass}\\.prototype\\.${escapedMethod}\\b`,
  );
  const readsOriginal = new RegExp(`${escapedClass}\\.prototype\\.${escapedMethod}\\s*;`);
  return savesOriginal.test(patchContent) || readsOriginal.test(patchContent);
}

export function extractFsuHooks(patchesDir) {
  const patchFiles = fs
    .readdirSync(patchesDir)
    .filter((name) => name.endsWith(".js"))
    .sort();

  const hookMap = new Map();
  const patchContents = new Map();

  const addHook = (patchFile, className, methodName, line, kind) => {
    const key = methodName ? `${className}.${methodName}` : className;
    if (!hookMap.has(key)) {
      hookMap.set(key, {
        patchFile,
        className,
        methodName: methodName || null,
        line,
        kind,
        requiresEaMethod: false,
      });
      return;
    }
    const existing = hookMap.get(key);
    if (existing.patchFile !== patchFile) {
      existing.patchFile = `${existing.patchFile}, ${patchFile}`;
    }
  };

  for (const patchFile of patchFiles) {
    const content = fs.readFileSync(path.join(patchesDir, patchFile), "utf8");
    patchContents.set(patchFile, content);
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(PROTOTYPE_HOOK_RE)) {
        addHook(patchFile, match[1], match[2], index + 1, "prototype");
      }
      for (const match of line.matchAll(INSTANCEOF_RE)) {
        addHook(patchFile, match[1], null, index + 1, "instanceof");
      }
      for (const match of line.matchAll(CLASSNAME_RE)) {
        addHook(patchFile, match[1], null, index + 1, "className");
      }
    });
  }

  for (const hook of hookMap.values()) {
    if (!hook.methodName) continue;
    const patchNames = hook.patchFile.split(", ");
    hook.requiresEaMethod = patchNames.some((patchFile) =>
      patchRequiresEaMethod(patchContents.get(patchFile), hook.className, hook.methodName),
    );
    if (!hook.requiresEaMethod) {
      hook.kind = "fsu-defined";
    }
  }

  return [...hookMap.values()].sort((a, b) => {
    const patchCmp = a.patchFile.localeCompare(b.patchFile);
    if (patchCmp !== 0) return patchCmp;
    const classCmp = a.className.localeCompare(b.className);
    if (classCmp !== 0) return classCmp;
    return (a.methodName || "").localeCompare(b.methodName || "");
  });
}

export function findClassBundle(bundles, className) {
  const patterns = [
    `${className}=`,
    `${className}.prototype`,
    `function ${className}(`,
    `,${className}=`,
  ];
  for (const [name, bundle] of Object.entries(bundles)) {
    if (patterns.some((pattern) => bundle.content.includes(pattern))) {
      return name;
    }
  }
  return null;
}

export function hasPrototypeMethod(bundleContent, className, methodName) {
  const re = new RegExp(
    `${escapeRegExp(className)}\\.prototype\\.${escapeRegExp(methodName)}\\s*=\\s*function`,
  );
  return re.test(bundleContent);
}

export function methodSnippet(bundleContent, className, methodName, maxLen = 120) {
  const needle = `${className}.prototype.${methodName}`;
  const index = bundleContent.indexOf(needle);
  if (index < 0) return null;
  return bundleContent.slice(index, index + maxLen);
}

export function analyzeHooks(hooks, bundles) {
  return hooks.map((hook) => {
    const bundleName = findClassBundle(bundles, hook.className);
    const bundle = bundleName ? bundles[bundleName] : null;
    const classFound = Boolean(bundleName);
    let methodFound = true;
    let snippet = null;

    if (hook.methodName && hook.requiresEaMethod) {
      methodFound = bundle ? hasPrototypeMethod(bundle.content, hook.className, hook.methodName) : false;
      snippet = bundle ? methodSnippet(bundle.content, hook.className, hook.methodName) : null;
    }

    let status = "ok";
    if (!classFound) {
      status = "missing-class";
    } else if (hook.methodName && hook.requiresEaMethod && !methodFound) {
      status = "missing-method";
    } else if (hook.methodName && !hook.requiresEaMethod) {
      status = "fsu-defined";
    }

    return {
      ...hook,
      bundle: bundleName,
      status,
      snippet,
    };
  });
}

export function buildBaseline(bundleDir, patchesDir) {
  const bundles = loadBundles(bundleDir);
  const hooks = extractFsuHooks(patchesDir);
  const analyzed = analyzeHooks(hooks, bundles);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    bundleDir,
    bundles: Object.fromEntries(
      Object.entries(bundles).map(([name, bundle]) => [name, { size: bundle.size, sha256: bundle.sha256 }]),
    ),
    hooks: analyzed.map((hook) => ({
      patchFile: hook.patchFile,
      className: hook.className,
      methodName: hook.methodName,
      kind: hook.kind,
      requiresEaMethod: hook.requiresEaMethod,
      bundle: hook.bundle,
      status: hook.status,
      snippet: hook.snippet,
    })),
  };
}

export function compareToBaseline(current, baseline) {
  const baselineByKey = new Map(
    baseline.hooks.map((hook) => [
      hook.methodName ? `${hook.className}.${hook.methodName}` : hook.className,
      hook,
    ]),
  );

  return current.hooks.map((hook) => {
    const key = hook.methodName ? `${hook.className}.${hook.methodName}` : hook.className;
    const previous = baselineByKey.get(key);
    const changes = [];

    if (!previous) {
      changes.push("new-hook");
    } else {
      if (previous.bundle !== hook.bundle) {
        changes.push(`moved:${previous.bundle}->${hook.bundle}`);
      }
      if (previous.snippet && hook.snippet && previous.snippet !== hook.snippet) {
        changes.push("method-changed");
      }
      if (previous.status === "ok" && hook.status !== "ok") {
        changes.push(`broken:${hook.status}`);
      }
    }

    return { ...hook, changes };
  });
}

export function bundleHashChanges(current, baseline) {
  const changes = [];
  const names = new Set([...Object.keys(current.bundles), ...Object.keys(baseline.bundles)]);

  for (const name of [...names].sort()) {
    const now = current.bundles[name];
    const before = baseline.bundles[name];
    if (!now) {
      changes.push({ name, type: "removed" });
      continue;
    }
    if (!before) {
      changes.push({ name, type: "added", size: now.size });
      continue;
    }
    if (now.sha256 !== before.sha256) {
      changes.push({
        name,
        type: "changed",
        sizeBefore: before.size,
        sizeAfter: now.size,
        sizeDelta: now.size - before.size,
      });
    }
  }
  return changes;
}

export function formatReport(current, { compared = null, bundleChanges = [] } = {}) {
  const lines = [];
  const hooks = compared || current.hooks;
  const missing = hooks.filter((hook) => hook.status === "missing-class" || hook.status === "missing-method");
  const fsuDefined = hooks.filter((hook) => hook.status === "fsu-defined");
  const changedBundles = bundleChanges.filter((item) => item.type === "changed");

  lines.push("=== FSU EA Bundle Check ===");
  lines.push(`Bundles dir: ${current.bundleDir}`);
  lines.push(`Generated: ${current.generatedAt}`);
  lines.push(
    `Hooks: ${hooks.length} | EA-dependent: ${hooks.length - fsuDefined.length} | FSU-defined: ${fsuDefined.length} | Broken: ${missing.length} | Bundle files changed: ${changedBundles.length}`,
  );
  lines.push("");

  if (changedBundles.length) {
    lines.push("## EA bundle file changes (vs baseline)");
    for (const item of changedBundles) {
      const delta = item.sizeDelta >= 0 ? `+${item.sizeDelta}` : `${item.sizeDelta}`;
      lines.push(`  ~ ${item.name}  ${item.sizeBefore} -> ${item.sizeAfter} bytes (${delta})`);
    }
    lines.push("");
  }

  if (missing.length) {
    lines.push("## BROKEN — fix these first");
    for (const hook of missing) {
      const target = hook.methodName ? `${hook.className}.${hook.methodName}` : hook.className;
      lines.push(`  ✗ ${target}`);
      lines.push(`      patch: ${hook.patchFile}  expected bundle: ${hook.bundle || "?"}  status: ${hook.status}`);
    }
    lines.push("");
  }

  const methodChanges = (compared || []).filter((hook) => hook.changes?.includes("method-changed"));
  if (methodChanges.length) {
    lines.push("## Method body changed (class/method still exists — retest patch)");
    for (const hook of methodChanges) {
      const target = hook.methodName ? `${hook.className}.${hook.methodName}` : hook.className;
      lines.push(`  ! ${target}  (${hook.patchFile}, ${hook.bundle})`);
    }
    lines.push("");
  }

  if (fsuDefined.length) {
    lines.push("## FSU-defined methods (EA does not need to provide these)");
    for (const hook of fsuDefined) {
      lines.push(`  + ${hook.className}.${hook.methodName}  (${hook.patchFile})`);
    }
    lines.push("");
  }

  const byBundle = new Map();
  for (const hook of hooks.filter((item) => item.status === "ok" || item.status === "fsu-defined")) {
    if (!byBundle.has(hook.bundle)) byBundle.set(hook.bundle, []);
    byBundle.get(hook.bundle).push(hook);
  }

  lines.push("## FSU dependencies by EA bundle (what breaks if EA edits this file)");
  for (const [bundleName, bundleHooks] of [...byBundle.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`  ${bundleName} (${bundleHooks.length} hooks)`);
    const byPatch = new Map();
    for (const hook of bundleHooks) {
      for (const patch of hook.patchFile.split(", ")) {
        if (!byPatch.has(patch)) byPatch.set(patch, []);
        byPatch.get(patch).push(hook.methodName ? `${hook.className}.${hook.methodName}` : hook.className);
      }
    }
    for (const [patchFile, targets] of [...byPatch.entries()].sort()) {
      lines.push(`    ${patchFile}: ${targets.join(", ")}`);
    }
  }
  lines.push("");

  lines.push("## All hooks by patch file");
  const byPatchFile = new Map();
  for (const hook of hooks) {
    for (const patch of hook.patchFile.split(", ")) {
      if (!byPatchFile.has(patch)) byPatchFile.set(patch, []);
      byPatchFile.get(patch).push(hook);
    }
  }
  for (const [patchFile, patchHooks] of [...byPatchFile.entries()].sort()) {
    lines.push(`  ${patchFile}`);
    for (const hook of patchHooks) {
      const target = hook.methodName ? `${hook.className}.${hook.methodName}` : hook.className;
      const mark = hook.status === "ok" ? "✓" : hook.status === "fsu-defined" ? "+" : "✗";
      const changeNote = hook.changes?.length ? `  [${hook.changes.join(", ")}]` : "";
      lines.push(`    ${mark} ${target} -> ${hook.bundle || "?"}${changeNote}`);
    }
  }

  return lines.join("\n");
}