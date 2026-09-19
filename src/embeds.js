'use strict';

const { EmbedBuilder } = require('discord.js');
const {
  rarityColor,
  rarityEmoji,
  rarityRank,
  fruitEmoji,
  trendEmoji,
  bestFruit,
  notableFruits,
  ultimateFruits,
  compactValue,
  withCommas,
  priceChip,
  demandLabel,
  discordRelative,
} = require('./format');

const SIDE_META = {
  normal: {
    title: 'Normal Dealer Stock',
    emoji: '🍈',
    color: 0xf1c40f,
    period: 'every 4h',
  },
  mirage: {
    title: 'Mirage Dealer Stock',
    emoji: '🌊',
    color: 0x3498db,
    period: 'every 2h',
  },
};

const ARTICLE = { a: 'A', an: 'An' };

/** "A 🔴 Mythical restock!" style headline for the best fruit in stock. */
function restockLine(fruits) {
  const best = bestFruit(fruits);
  if (!best) return '*Nothing in stock right now.*';
  const rank = rarityRank(best.rarity);
  const label = rank >= 3 ? 'restock' : 'rotation';
  const article = /^[aeiou]/i.test(best.rarity) ? ARTICLE.an : ARTICLE.a;
  return `*${article} ${rarityEmoji(best.rarity)} **${best.rarity}** ${label}!*`;
}

function fruitRow(f) {
  const parts = [`${fruitEmoji(f.name)} **${f.name}**`];
  const price = priceChip(f.beliPrice);
  if (price) parts.push(price);
  if (f.value?.regular !== null && f.value?.regular !== undefined) {
    parts.push(`\`${compactValue(f.value.regular)}\``);
  }
  if (f.value?.permanent) parts.push(`perm \`${compactValue(f.value.permanent)}\``);
  const demand = demandLabel(f.demand?.regular);
  if (demand !== 'N/A') parts.push(`🔥 ${demand}`);
  if (f.trend?.regular) parts.push(trendEmoji(f.trend.regular));
  return parts.join(' • ');
}

/** One side's live stock embed (kept updated in the stock channel). */
function buildSideEmbed(side, kind, { footerExtra } = {}) {
  const meta = SIDE_META[kind];
  const fruits = side.fruits ?? [];
  const best = bestFruit(fruits);
  const totalValue = fruits.reduce((sum, f) => sum + (f.value?.regular ?? 0), 0);

  const embed = new EmbedBuilder()
    .setTitle(`${meta.emoji} ${meta.title}`)
    .setColor(rarityColor(best?.rarity) ?? meta.color)
    .setDescription(
      [restockLine(fruits), '', ...(fruits.length ? fruits.map(fruitRow) : ['*No fruits in stock.*'])].join('\n'),
    )
    .setAuthor({ name: 'Blox Fruits Values', url: 'https://bloxfruitsvalues.com/stock' });

  if (best?.image) embed.setThumbnail(best.image);

  embed.addFields(
    { name: 'Rotation', value: meta.period, inline: true },
    { name: 'Total value', value: compactValue(totalValue), inline: true },
    {
      name: 'Next update',
      value: discordRelative(side.resetsAt) ?? 'unknown',
      inline: true,
    },
  );

  const footer = ['bloxfruitsvalues.com'];
  if (footerExtra) footer.unshift(footerExtra);
  embed.setFooter({ text: footer.join(' • ') });
  embed.setTimestamp();
  return embed;
}

/** Both stock embeds (used by /stock). */
function buildStockEmbeds(stock, { footerExtra } = {}) {
  return [
    buildSideEmbed(stock.normal, 'normal', { footerExtra }),
    buildSideEmbed(stock.mirage, 'mirage', { footerExtra }),
  ];
}

/** Alert line for the stock message content, only when rare fruit is up. */
function buildAlertContent(kind, fruits, pingRoleId) {
  const notable = notableFruits(fruits);
  if (!notable.length) return undefined;
  const names = notable.map((f) => f.name).join(' & ');
  const verb = notable.length > 1 ? 'are' : 'is';
  const prefix = pingRoleId ? `<@&${pingRoleId}> ` : '';
  return `${prefix}🔔 **[${kind.toUpperCase()}] ${names} ${verb} in stock!**`;
}

/** The extra "ultra rare" alert message (3rd message, Mythical-tier finds). */
function buildUltimateAlert(kind, side) {
  const ultimates = ultimateFruits(side.fruits);
  if (!ultimates.length) return null;

  const names = ultimates.map((f) => f.name).join(' & ');
  const prefixParts = [];
  if (ultimates.length === 1) {
    const f = ultimates[0];
    prefixParts.push(`${fruitEmoji(f.name)} **${f.name.toUpperCase()}**`);
  } else {
    prefixParts.push(`**${names.toUpperCase()}**`);
  }
  const verb = ultimates.length > 1 ? 'are' : 'is';
  const content = `🚨 ${prefixParts[0]} ${verb} in the **${kind}** stock right now!`;

  const lines = ultimates.map((f) => {
    const parts = [`${fruitEmoji(f.name)} **${f.name}** ${rarityEmoji(f.rarity)}`];
    if (f.value?.regular != null) parts.push(`\`${compactValue(f.value.regular)}\``);
    if (f.value?.permanent) parts.push(`perm \`${compactValue(f.value.permanent)}\``);
    const demand = demandLabel(f.demand?.regular);
    if (demand !== 'N/A') parts.push(`🔥 ${demand}`);
    return parts.join(' • ');
  });

  const embed = new EmbedBuilder()
    // Careful: the title must NOT contain "Normal/Mirage Dealer Stock", or the
    // watcher's history scan would treat this alert as a live stock message.
    .setTitle(`🚨 Ultra-Rare Stock Alert — ${kind === 'normal' ? 'Normal' : 'Mirage'}`)
    .setColor(rarityColor('mythical'))
    .setDescription(
      [...lines, '', `Gone ${discordRelative(side.resetsAt) ?? 'soon'} — don't sleep on it.`].join('\n'),
    )
    .setFooter({ text: 'bloxfruitsvalues.com • blox fruits values bot' })
    .setTimestamp();
  if (ultimates[0]?.image) embed.setThumbnail(ultimates[0].image);

  return { content, embeds: [embed] };
}

module.exports = { buildStockEmbeds, buildSideEmbed, buildAlertContent, buildUltimateAlert };
