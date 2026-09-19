'use strict';

/**
 * Stock watcher: polls the stock page and maintains a single live stock
 * message in the configured channel. Whenever the bot starts up or the
 * stock rotates, it deletes the previous stock message and posts the
 * current one — so the channel always shows exactly one up-to-date stock.
 */

const { PermissionFlagsBits } = require('discord.js');
const api = require('./api');
const { buildStockEmbeds } = require('./embeds');

const SWEEP_MS = 30_000; // how often we check for new rotations
const RETRY_BACKOFF_MS = 2 * 60_000; // min wait between failed attempts
const NEEDED_PERMS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.ReadMessageHistory;
const STOCK_TITLES = ['Normal Dealer Stock', 'Mirage Dealer Stock'];

/** Rotation identity: side reset windows + which fruits are up. */
function stockSignature(stock) {
  return JSON.stringify([
    stock.normal.resetsAt,
    stock.normal.fruits.map((f) => f.name),
    stock.mirage.resetsAt,
    stock.mirage.fruits.map((f) => f.name),
  ]);
}

/** A message counts as "the stock post" if the bot sent it with our embeds. */
function isStockMessage(message, botId) {
  return (
    message.author?.id === botId &&
    (message.embeds ?? []).some((e) => STOCK_TITLES.some((t) => e.title?.includes(t)))
  );
}

/** Remove the tracked stock message plus any stock posts found in history. */
async function deletePreviousStock(channel, lastMessageId, botId) {
  const toDelete = new Set();
  if (lastMessageId) toDelete.add(lastMessageId);
  try {
    const recent = await channel.messages.fetch({ limit: 50 });
    for (const message of recent.values()) {
      if (isStockMessage(message, botId)) toDelete.add(message.id);
    }
  } catch (error) {
    console.warn(`[watcher] could not scan channel history: ${error.message}`);
  }
  let removed = 0;
  for (const id of toDelete) {
    try {
      await channel.messages.delete(id);
      removed++;
    } catch {
      /* already deleted */
    }
  }
  return removed;
}

async function sweep(client, ctx) {
  const state = ctx.watcherState.get();
  const now = Date.now();
  if (state.lastAttempt && now - state.lastAttempt < RETRY_BACKOFF_MS) return; // backing off

  let stock;
  try {
    stock = await api.fetchStock({ force: true });
  } catch (error) {
    console.error(`[watcher] stock fetch failed: ${error.message}`);
    return;
  }
  if (stock.stale) return; // upstream not confident yet — try next sweep

  const signature = stockSignature(stock);
  if (signature === state.signature) return; // stock post is already current

  const channel = client.channels.cache.get(ctx.config.stockChannelId);
  if (!channel) {
    console.warn(`[watcher] stock channel ${ctx.config.stockChannelId} not found`);
    ctx.watcherState.set({ lastAttempt: now });
    return;
  }
  if (!channel.permissionsFor(channel.guild?.members?.me)?.has(NEEDED_PERMS)) {
    console.warn(
      `[watcher] missing permissions in #${channel.name} — need View Channel, Send Messages, Embed Links, Read Message History`,
    );
    ctx.watcherState.set({ lastAttempt: now });
    return;
  }

  try {
    const removed = await deletePreviousStock(channel, state.lastMessageId, client.user.id);
    const message = await channel.send({
      embeds: buildStockEmbeds(stock, { footerExtra: 'Live — refreshes automatically' }),
      allowedMentions: { parse: [] },
    });
    ctx.watcherState.set({ signature, lastMessageId: message.id, lastAttempt: 0 });
    console.log(
      `[watcher] stock refreshed in #${channel.name} (removed ${removed} old post(s), new message ${message.id})`,
    );
  } catch (error) {
    console.error(`[watcher] failed to refresh stock message: ${error.message}`);
    ctx.watcherState.set({ lastAttempt: now });
  }
}

function startStockWatcher(client, ctx) {
  const run = () => sweep(client, ctx).catch((e) => console.error('[watcher]', e));
  console.log(
    `[watcher] started — maintaining live stock in channel ${ctx.config.stockChannelId}, checking every ${SWEEP_MS / 1000}s`,
  );
  run();
  const timer = setInterval(run, SWEEP_MS);
  timer.unref?.();
  return timer;
}

module.exports = { startStockWatcher, stockSignature };
