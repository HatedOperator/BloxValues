'use strict';

require('dotenv').config();

const path = require('node:path');

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  // Channel that always shows the live stock message (delete + resend on updates).
  stockChannelId: process.env.STOCK_CHANNEL_ID || '1549345099543093258',
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
  return missing;
}

module.exports = { config, validate };
