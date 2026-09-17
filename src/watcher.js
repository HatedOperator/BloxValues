'use strict';

/**
 * Stock watcher (multi-guild): polls the stock page, detects rotations, and
 * delivers each rotation exactly once to every guild configured with
 * /stocksettings — respecting each guild's own poll interval and mention role.
 */

const { PermissionFlagsBits } = require('discord.js');
const api = require('./api');
const { buildStockEmbeds } = require('./embeds');

const SWEEP_MS = 30_000; // how often we check for new rotations
const RETRY_BACKOFF_MS = 2 * 60_000; // min wait between failed delivery attempts

/** Rotation identity: side reset windows + which fruits are up. */
function stockSignature(stock) {
  return JSON.stringify([
    stock.normal.resetsAt,
    stock.normal.fruits.map((f) => f.name),
    stock.mirage.resetsAt,
    stock.mirage.fruits.map((f) => f.name),
  ]);
}

async function deliver(client, settings, stock) {
  const channel = client.channels.cache.get(settings.channelId);
  if (!channel) {
    console.warn(`[watcher] channel ${settings.channelId} not found — remove it with /stocksettings reset`);
    return false;
  }
  if (
    !channel
      .permissionsFor(channel.guild?.members?.me)
      ?.has(PermissionFlagsBits.SendMessages | PermissionFlagsBits.EmbedLinks | PermissionFlagsBits.ViewChannel)
  ) {
    console.warn(`[watcher] missing Send Messages/Embed Links in #${channel.name} (${channel.guildId})`);
    return false;
  }

  const content = settings.mentionRoleId ? `<@&${settings.mentionRoleId}>` : undefined;
  await channel.send({
    content,
    embeds: buildStockEmbeds(stock, { footerExtra: 'New rotation' }),
    allowedMentions: { parse: settings.mentionRoleId ? ['roles'] : [] },
  });
  return true;
}

async function sweep(client, ctx) {
  let stock;
  try {
    stock = await api.fetchStock({ force: true });
  } catch (error) {
    console.error(`[watcher] stock fetch failed: ${error.message}`);
    return;
  }
  if (stock.stale) return; // upstream not confident yet — try next sweep

  const signature = stockSignature(stock);
  const now = Date.now();
  const configs = ctx.guildSettings.all();

  for (const [guildId, settings] of Object.entries(configs)) {
    const state = ctx.watcherState.getGuild(guildId);
    const known = state.signature !== null;

    if (known && state.signature === signature) continue; // already delivered

    // First time we see this guild: either post now or silently catch up
    if (!known && !settings.postOnStartup) {
      ctx.watcherState.setGuild(guildId, { signature, at: now });
      continue;
    }

    if (now - (state.at ?? 0) < settings.pollSeconds * 1000) continue; // not due yet
    if (state.lastAttempt && now - state.lastAttempt < RETRY_BACKOFF_MS) continue; // backing off

    try {
      const sent = await deliver(client, settings, stock);
      if (sent) {
        ctx.watcherState.setGuild(guildId, { signature, at: Date.now(), lastAttempt: 0 });
        console.log(`[watcher] rotation delivered to guild ${guildId} (#${settings.channelId})`);
      } else {
        ctx.watcherState.setGuild(guildId, { lastAttempt: now });
      }
    } catch (error) {
      console.error(`[watcher] delivery to guild ${guildId} failed: ${error.message}`);
      ctx.watcherState.setGuild(guildId, { lastAttempt: now });
    }
  }
}

function startStockWatcher(client, ctx) {
  const run = () => sweep(client, ctx).catch((e) => console.error('[watcher]', e));
  console.log(`[watcher] started — checking for rotations every ${SWEEP_MS / 1000}s`);
  run();
  const timer = setInterval(run, SWEEP_MS);
  timer.unref?.();
  return timer;
}

module.exports = { startStockWatcher, stockSignature };
