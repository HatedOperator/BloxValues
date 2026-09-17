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

const GUILD_DEFAULTS = Object.freeze({
  channelId: null,
  mentionRoleId: null,
  pollSeconds: 60,
  postOnStartup: true,
});

/**
 * Per-guild stock update configuration, managed in Discord via /stocksettings.
 * Migrates the old `{ "guild:<id>": "<channelId>" }` shape automatically.
 */
class GuildSettings {
  constructor(dataDir) {
    this.store = new JsonStore(path.join(dataDir, 'guild-settings.json'));
    this.#migrate();
  }

  #migrate() {
    for (const [key, value] of Object.entries({ ...this.store.data })) {
      if (key.startsWith('guild:') && typeof value === 'string') {
        this.store.delete(key);
        this.store.set(key.slice(6), { ...GUILD_DEFAULTS, channelId: value });
      }
    }
  }

  /** Effective settings for a guild (defaults merged in). */
  get(guildId) {
    const saved = this.store.get(guildId, {});
    return { ...GUILD_DEFAULTS, ...saved };
  }

  /** Merge a partial update (only provided fields change). */
  update(guildId, patch) {
    this.store.set(guildId, { ...this.get(guildId), ...patch });
  }

  reset(guildId) {
    this.store.delete(guildId);
  }

  /** All configured guilds: { guildId: settings }. */
  all() {
    const out = {};
    for (const [guildId, saved] of Object.entries(this.store.data)) {
      if (saved && typeof saved === 'object' && saved.channelId) {
        out[guildId] = { ...GUILD_DEFAULTS, ...saved };
      }
    }
    return out;
  }
}

const WATCHER_DEFAULTS = Object.freeze({
  signature: null, // last stock rotation delivered to this guild
  at: 0, // epoch ms of that delivery
  lastAttempt: 0, // epoch ms of last failed attempt (backoff)
});

/** Per-guild watcher progress, so restarts don't double-post rotations. */
class WatcherState {
  constructor(dataDir) {
    this.store = new JsonStore(path.join(dataDir, 'watcher-state.json'));
  }

  getGuild(guildId) {
    return { ...WATCHER_DEFAULTS, ...this.store.get(guildId, {}) };
  }

  setGuild(guildId, patch) {
    this.store.set(guildId, { ...this.getGuild(guildId), ...patch });
  }

  resetGuild(guildId) {
    this.store.delete(guildId);
  }
}

module.exports = { JsonStore, GuildSettings, WatcherState, GUILD_DEFAULTS };
