'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const api = require('../api');
const {
  rarityColor,
  rarityEmoji,
  trendEmoji,
  compactValue,
  withCommas,
  demandLabel,
  discordDateTime,
} = require('../format');

const data = new SlashCommandBuilder()
  .setName('value')
  .setDescription('Show the current trade value of a Blox Fruits item')
  .addStringOption((option) =>
    option
      .setName('item')
      .setDescription('Item name, e.g. Kitsune, Dragon, Fruit Notifier, Fiend Yeti')
      .setRequired(true)
      .setAutocomplete(true),
  );

async function execute(interaction, ctx) {
  await interaction.deferReply();
  const query = interaction.options.getString('item', true);

  const item = await api.findItem(query);
  if (!item) {
    return interaction.editReply(
      `❌ Couldn't find an item called **${query}**. Try \`/value item:\` and pick a suggestion from the list.`,
    );
  }

  const embed = new EmbedBuilder()
    .setTitle(`${rarityEmoji(item.rarity)} ${item.name}`)
    .setURL(item.valueUrl)
 .setColor(rarityColor(item.rarity) ?? ctx.config.embedColor)
    .setAuthor({ name: `Blox Fruits Values • ${item.category}`, url: item.valueUrl });

  if (item.image) embed.setThumbnail(item.image);

  embed.addFields(
    {
      name: 'Value',
      value: `\`${compactValue(item.value.regular)}\``,
      inline: true,
    },
    {
      name: 'Permanent',
      value:
        item.value.permanent
          ? `\`${compactValue(item.value.permanent)}\``
          : '*—*',
      inline: true,
    },
    {
      name: 'Rarity',
      value: `${rarityEmoji(item.rarity)} ${item.rarity}`,
      inline: true,
    },
    {
      name: 'Demand',
      value: demandLabel(item.demand.regular),
      inline: true,
    },
    {
      name: 'Perm demand',
      value: item.demand.permanent ? demandLabel(item.demand.permanent) : '*—*',
      inline: true,
    },
    {
      name: 'Trend',
      value:
        item.trend.regular && item.trend.regular !== 'N/A'
          ? `${trendEmoji(item.trend.regular)} ${item.trend.regular}`
          : '*—*',
      inline: true,
    },
  );

  const shopPrices = [];
  if (item.beliPrice) shopPrices.push(`💰 ${withCommas(item.beliPrice)} Beli`);
  if (item.robuxPrice) shopPrices.push(`💎 ${withCommas(item.robuxPrice)} Robux`);
  if (shopPrices.length) {
    embed.addFields({ name: 'Dealer price', value: shopPrices.join(' • '), inline: false });
  }

  if (item.bestUsedFor) {
    embed.addFields({ name: 'Best used for', value: item.bestUsedFor, inline: false });
  }
  if (item.type && item.type.toLowerCase() !== item.category.slice(0, -1)) {
    embed.addFields({ name: 'Type', value: item.type, inline: true });
  }
  if (item.tradeable !== null && item.tradeable !== undefined) {
    embed.addFields({
      name: 'Tradeable',
      value: item.tradeable ? '✅ Yes' : '❌ No',
      inline: true,
    });
  }

  const footer = ['bloxfruitsvalues.com'];
  if (item.updatedAt) footer.unshift(`updated ${discordDateTime(Date.parse(item.updatedAt))}`);
  embed.setFooter({ text: footer.join(' • ') });

  return interaction.editReply({ embeds: [embed] });
}

async function autocomplete(interaction) {
  const focused = interaction.options.getFocused();
  const items = await api.searchItems(focused, 25);
  return interaction.respond(
    items.map((item) => ({
      name: `${item.name} (${item.category.slice(0, -1)})`,
      value: item.name,
    })),
  );
}

module.exports = { data, execute, autocomplete };
