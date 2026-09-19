'use strict';

/**
 * Stock watcher: maintains TWO live messages in the stock channel — one for
 * Normal dealer stock, one for Mirage. Each is deleted and resent only when
 * its own side rotates. Rare finds add an alert line (and an optional role
 * ping); Mythical-tier finds also trigger a third "ultra-rare" alert message.
 */

const { PermissionFlagsBits } = require('discord.js');
const api = require('./api');
const { buildSideEmbed, buildAlertContent, buildUltimateAlert } = require('./embeds');

const SWEEP_MS = 30_000; // how often we check for new rotations
const RETRY_BACKOFF_MS = 2 * 60_000; // min wait between failed attempts
const NEEDED_PERMS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.ReadMessageHistory;
const SIDE_MARKER = { normal: 'Normal Dealer Stock', mirage: 'Mirage Dealer Stock' };

/** Rotation identity for one side: reset window + which fruits are up. */
function sideSignature(side) {
  return JSON.stringify([side.resetsAt, side.fruits.map((f) => f.name)]);
}

/** A message counts as this side's live post if the bot sent it with that embed. */
function isSideStockMessage(message, botId, kind) {
  return (
    message.author?.id === botId &&
    (message.embeds ?? []).some((e) => e.title?.includes(SIDE_MARKER[kind]))
  );
}

/** Remove the tracked message for this side plus any strays found in history. */
async function deletePreviousStock(channel, lastMessageId, botId, kind) {
  const toDelete = new Set();
  if (lastMessageId) toDelete.add(lastMessageId);
  try {
    const recent = await channel.messages.fetch({ limit: 50 });
    for (const message of recent.values()) {
      if (isSideStockMessage(message, botId, kind)) toDelete.add(message.id);
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

async function refreshSide(channel, ctx, side, kind, state) {
  const sigKey = `${kind}Signature`;
  const msgKey = `${kind}MessageId`;
  const signature = sideSignature(side);
  if (state[sigKey] === signature) return false; // this side is already current

  const removed = await deletePreviousStock(channel, state[msgKey], channel.client.user.id, kind);
  const content = buildAlertContent(kind, side.fruits, ctx.config.stockPingRoleId);
  const message = await channel.send({
    content,
    embeds: [buildSideEmbed(side, kind, { footerExtra: 'Live — refreshes automatically' })],
    allowedMentions: ctx.config.stockPingRoleId ? { parse: ['roles'] } : { parse: [] },
  });
  ctx.watcherState.set({ [sigKey]: signature, [msgKey]: message.id });

  const ultimate = buildUltimateAlert(kind, side);
  if (ultimate) {
    const ping = ctx.config.stockPingRoleId ? `<@&${ctx.config.stockPingRoleId}> ` : '';
    await channel.send({
      content: ping + ultimate.content,
      embeds: ultimate.embeds,
      allowedMentions: ctx.config.stockPingRoleId ? { parse: ['roles'] } : { parse: [] },
    });
  }

  console.log(
    `[watcher] ${kind} refreshed in #${channel.name} (removed ${removed} old post(s), new message ${message.id}${ultimate ? ', ultra-rare alert sent' : ''})`,
  );
  return true;
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

  // Nothing to do if both sides already match what's posted
  if (state.normalSignature === sideSignature(stock.normal) && state.mirageSignature === sideSignature(stock.mirage)) {
    return;
  }

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
    await refreshSide(channel, ctx, stock.normal, 'normal', state);
    await refreshSide(channel, ctx, stock.mirage, 'mirage', state);
    ctx.watcherState.set({ lastAttempt: 0 });
  } catch (error) {
    console.error(`[watcher] failed to refresh stock messages: ${error.message}`);
    ctx.watcherState.set({ lastAttempt: now });
  }
}

function startStockWatcher(client, ctx) {
  const run = () => sweep(client, ctx).catch((e) => console.error('[watcher]', e));
  console.log(
    `[watcher] started — live Normal & Mirage stock in channel ${ctx.config.stockChannelId}, checking every ${SWEEP_MS / 1000}s`,
  );
  run();
  const timer = setInterval(run, SWEEP_MS);
  timer.unref?.();
  return timer;
}

module.exports = { startStockWatcher, sideSignature };
