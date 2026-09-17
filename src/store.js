'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** Tiny JSON file store for guild settings and watcher state. */
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

/** guildId → channelId for per-server stock update channels. */
class GuildSettings {
  constructor(dataDir) {
    this.store = new JsonStore(path.join(dataDir, 'guild-settings.json'));
  }

  getStockChannel(guildId) {
    return this.store.get(`guild:${guildId}`);
  }

  setStockChannel(guildId, channelId) {
    this.store.set(`guild:${guildId}`, channelId);
  }

  clearStockChannel(guildId) {
    this.store.delete(`guild:${guildId}`);
  }

  allStockChannels() {
    const out = {};
    for (const [key, value] of Object.entries(this.store.data)) {
      if (key.startsWith('guild:')) out[key.slice(6)] = value;
    }
    return out;
  }
}

/** Last-posted stock signature, so restarts don't double-post a rotation. */
class WatcherState {
  constructor(dataDir) {
    this.store = new JsonStore(path.join(dataDir, 'watcher-state.json'));
  }

  getLastSignature() {
    return this.store.get('lastSignature');
  }

  setLastSignature(sig) {
    this.store.set('lastSignature', sig);
  }
}

module.exports = { JsonStore, GuildSettings, WatcherState };
