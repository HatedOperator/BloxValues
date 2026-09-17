'use strict';

/**
 * Stock watcher: polls the stock page, detects rotations, and posts the new
 * Normal/Mirage stock into every configured channel exactly once per rotation.
 */

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const api = require('./api');
const { buildStockEmbeds } = require('./embeds');

/** Rotation identity: side reset windows + which fruits are up. */
function stockSignature(stock) {
  return JSON.stringify([
    stock.normal.resetsAt,
    stock.normal.fruits.map((f) => f.name),
    stock.mirage.resetsAt,
    stock.mirage.fruits.map((f) => f.name),
  ]);
}

function collectChannels(client, config, guildSettings) {
  const targets = new Map(); // channelId -> reason
  if (config.stockChannelId) targets.set(config.stockChannelId, 'STOCK_CHANNEL_ID');
  for (const [guildId, channelId] of Object.entries(guildSettings.allStockChannels())) {
    targets.set(channelId, `guild ${guildId} (/setstockchannel)`);
  }

  const channels = [];
  for (const [channelId, reason] of targets) {
    const channel = client.channels.cache.get(channelId);
    if (!channel) {
      console.warn(`[watcher] channel ${channelId} (${reason}) not found — skipped`);
      continue;
    }
    if (
      !channel
        .permissionsFor(channel.guild.members.me)
        ?.has(PermissionFlagsBits.SendMessages | PermissionFlagsBits.EmbedLinks | PermissionFlagsBits.ViewChannel)
    ) {
      console.warn(`[watcher] missing Send Messages/Embed Links in #${channel.name} — skipped`);
      continue;
    }
    channels.push({ channel, reason });
  }
  return channels;
}

async function postStock(client, ctx, stock, { isStartup }) {
  const channels = collectChannels(client, ctx.config, ctx.guildSettings);
  if (!channels.length) {
    console.warn('[watcher] stock rotated but no valid target channels are configured');
    return;
  }

  const embeds = buildStockEmbeds(stock, {
    footerExtra: isStartup ? 'Live — new rotations post automatically' : 'New rotation',
  });
  const content = ctx.config.stockMentionRoleId ? `<@&${ctx.config.stockMentionRoleId}>` : undefined;

  let posted = 0;
  for (const { channel } of channels) {
    try {
      await channel.send({ content, embeds, allowedMentions: { parse: ctx.config.stockMentionRoleId ? ['roles'] : [] } });
      posted++;
    } catch (error) {
      console.error(`[watcher] failed to post in #${channel.name} (${channel.id}): ${error.message}`);
    }
  }
  console.log(
    `[watcher] ${isStartup ? 'startup snapshot' : 'rotation'} posted to ${posted}/${channels.length} channel(s)`,
  );
}

async function tick(client, ctx, { firstRun = false } = {}) {
  let stock;
  try {
    stock = await api.fetchStock({ force: true });
  } catch (error) {
    console.error(`[watcher] stock fetch failed: ${error.message}`);
    return;
  }

  if (stock.stale) {
    console.warn('[watcher] upstream reports stale data — waiting for next poll');
    return;
  }

  const signature = stockSignature(stock);
  if (signature === ctx.watcherState.getLastSignature()) return; // nothing new

  const isStartup = firstRun && !ctx.watcherState.getLastSignature();
  ctx.watcherState.setLastSignature(signature);

  if (firstRun && !isStartup && !ctx.config.postOnStartup) {
    console.log('[watcher] caught up silently (POST_ON_STARTUP=false)');
    return;
  }
  if (!firstRun || isStartup || ctx.config.postOnStartup) {
    await postStock(client, ctx, stock, { isStartup: firstRun });
  }
}

function startStockWatcher(client, ctx) {
  const run = (opts) => tick(client, ctx, opts).catch((e) => console.error('[watcher]', e));
  console.log(`[watcher] started — polling every ${ctx.config.pollSeconds}s`);
  run({ firstRun: true });
  const timer = setInterval(() => run({}), ctx.config.pollSeconds * 1000);
  timer.unref?.();
  return timer;
}

module.exports = { startStockWatcher, stockSignature };
