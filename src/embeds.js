'use strict';

const { EmbedBuilder } = require('discord.js');
const {
  rarityColor,
  rarityEmoji,
  stockFruitLine,
  compactValue,
  discordRelative,
  discordDateTime,
} = require('./format');

const SIDE_META = {
  normal: {
    title: 'Normal Dealer Stock',
    emoji: '🍈',
    color: 0xf1c40f,
    period: 'every 4 hours',
  },
  mirage: {
    title: 'Mirage Dealer Stock',
    emoji: '🌊',
    color: 0x3498db,
    period: 'every 2 hours',
  },
};

function topFruitByValue(side) {
  const fruits = side.fruits ?? [];
  if (!fruits.length) return null;
  return fruits.reduce((best, f) =>
    (f.value.regular ?? -1) > (best.value.regular ?? -1) ? f : best,
  );
}

function buildSideEmbed(side, kind, { footerExtra } = {}) {
  const meta = SIDE_META[kind];
  const fruits = side.fruits ?? [];
  const top = topFruitByValue(side);

  const lines = fruits.map((f) => stockFruitLine(f));
  const totalValue = fruits.reduce((sum, f) => sum + (f.value.regular ?? 0), 0);

  const embed = new EmbedBuilder()
    .setTitle(`${meta.emoji} ${meta.title}`)
    .setColor(rarityColor(top?.rarity) ?? meta.color)
    .setDescription(lines.length ? lines.join('\n') : '*No fruits in stock right now.*')
    .setAuthor({ name: 'Blox Fruits Values', url: 'https://bloxfruitsvalues.com/stock' });

  if (top?.image) embed.setThumbnail(top.image);

  const reset = discordRelative(side.resetsAt);
  const resetExact = discordDateTime(side.resetsAt);
  const resetText = reset ? `${reset} (${resetExact})` : 'unknown';

  embed.addFields(
    {
      name: 'Resets',
      value: `${resetText}`,
      inline: true,
    },
    {
      name: 'Rotation',
      value: meta.period,
      inline: true,
    },
    {
      name: 'Total value',
      value: compactValue(totalValue),
      inline: true,
    },
  );

  if (top) {
    embed.addFields({
      name: 'Top of this stock',
      value: `${rarityEmoji(top.rarity)} **${top.name}** — \`${compactValue(
        top.value.regular,
      )}\`${top.value.permanent ? ` (perm \`${compactValue(top.value.permanent)}\`)` : ''}`,
      inline: false,
    });
  }

  const footerParts = ['bloxfruitsvalues.com'];
  if (footerExtra) footerParts.unshift(footerExtra);
  embed.setFooter({ text: footerParts.join(' • ') });
  embed.setTimestamp();

  return embed;
}

/** Both stock embeds (normal + mirage) as used by /stock and the auto-watcher. */
function buildStockEmbeds(stock, { footerExtra } = {}) {
  return [
    buildSideEmbed(stock.normal, 'normal', { footerExtra }),
    buildSideEmbed(stock.mirage, 'mirage', { footerExtra }),
  ];
}

module.exports = { buildStockEmbeds, buildSideEmbed };
