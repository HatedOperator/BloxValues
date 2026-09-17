'use strict';

require('dotenv').config();

const path = require('node:path');

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function boolEnv(name, fallback) {
  const raw = (process.env[name] ?? '').toLowerCase();
  if (raw === '') return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || undefined,
  stockChannelId: process.env.STOCK_CHANNEL_ID || undefined,
  stockMentionRoleId: process.env.STOCK_MENTION_ROLE_ID || undefined,
  pollSeconds: Math.max(15, intEnv('STOCK_POLL_SECONDS', 60)),
  postOnStartup: boolEnv('POST_ON_STARTUP', true),
  embedColor: intEnv('EMBED_COLOR', 0x2b2d31) || 0x2b2d31,
  // PaaS-friendly override (e.g. a Railway volume mount); defaults to <repo>/data
  dataDir: process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, '..', 'data'),
};

function validate(required = true) {
  const missing = [];
  if (!config.token) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('CLIENT_ID');
  if (missing.length && required) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill them in.',
    );
  }
  if (config.postOnStartup && !config.stockChannelId) {
    // Not fatal: per-guild channels set with /setstockchannel still work.
    console.warn(
      '[config] STOCK_CHANNEL_ID is not set — stock updates will only go to ' +
        'channels configured per server with /setstockchannel.',
    );
  }
  return missing;
}

module.exports = { config, validate };
