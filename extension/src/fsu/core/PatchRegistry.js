export class PatchRegistry {
  constructor() {
    this.backups = {};
  }

  backup(key, original) {
    this.backups[key] = original;
    return original;
  }

  call(key, thisArg, ...args) {
    const original = this.backups[key];
    if (typeof original !== "function") {
      throw new Error(`Patch backup not found: ${key}`);
    }
    return original.call(thisArg, ...args);
  }

  createViewMap(entries) {
    const view = {};
    for (const [key, original] of Object.entries(entries)) {
      view[key] = this.backup(key, original);
    }
    return view;
  }
}