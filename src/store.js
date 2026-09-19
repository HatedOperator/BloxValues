'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** Tiny JSON file store. */
class JsonStore {
  constructor(file) {
    this.file = file;
    this.data = {};
    this.#load();
  }

  #load() {
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      this.data = {};
    }
  }

  #save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  get(key, fallback = undefined) {
    return key in this.data ? this.data[key] : fallback;
  }

  set(key, value) {
    this.data[key] = value;
    this.#save();
  }

  delete(key) {
    delete this.data[key];
    this.#save();
  }
}

const WATCHER_DEFAULTS = Object.freeze({
  normalSignature: null, // signature of the posted Normal stock
  mirageSignature: null, // signature of the posted Mirage stock
  normalMessageId: null, // live Normal stock message
  mirageMessageId: null, // live Mirage stock message
  lastAttempt: 0, // epoch ms of last failed refresh (backoff)
});

/** Persists the live stock message state across restarts. */
class WatcherState {
  constructor(dataDir) {
    this.store = new JsonStore(path.join(dataDir, 'watcher-state.json'));
  }

  get() {
    return { ...WATCHER_DEFAULTS, ...this.store.get('stock') };
  }

  set(patch) {
    this.store.set('stock', { ...this.get(), ...patch });
  }
}

module.exports = { JsonStore, WatcherState };
