'use strict';

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const api = require('../api');
const {
  rarityEmoji,
  trendEmoji,
  compactValue,
  demandLabel,
} = require('../format');

const PAGE_SIZE = 10;
const CATEGORIES = ['Fruits', 'Gamepasses', 'Limiteds', 'All'];

const data = new SlashCommandBuilder()
  .setName('values')
  .setDescription('Browse the Blox Fruits value list')
  .addStringOption((option) =>
    option
      .setName('category')
      .setDescription('Which category to list')
      .addChoices(
        { name: '🍈 Fruits', value: 'Fruits' },
        { name: '🎫 Gamepasses', value: 'Gamepasses' },
        { name: '🟡 Limiteds', value: 'Limiteds' },
        { name: '📦 Everything', value: 'All' },
      ),
  );

function sortItems(items) {
  return [...items].sort((a, b) => (b.value.regular ?? -1) - (a.value.regular ?? -1));
}

function buildPageEmbed(category, items, page, accentColor) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const slice = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const lines = slice.map((item, i) => {
    const rank = page * PAGE_SIZE + i + 1;
    const parts = [
      `${rarityEmoji(item.rarity)} **${item.name}** — \`${compactValue(item.value.regular)}\``,
    ];
    if (item.value.permanent) parts.push(`perm \`${compactValue(item.value.permanent)}\``);
    const demand = demandLabel(item.demand.regular);
    if (demand !== 'N/A') parts.push(`demand ${demand}`);
    if (item.trend.regular && item.trend.regular !== 'N/A') {
      parts.push(trendEmoji(item.trend.regular));
    }
    return `\`${String(rank).padStart(2, ' ')}\` ${parts.join(' • ')}`;
  });

  return new EmbedBuilder()
    .setTitle(`📊 Blox Fruits Values — ${category}`)
    .setURL('https://bloxfruitsvalues.com/values')
    .setColor(accentColor)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Page ${page + 1}/${totalPages} • ${items.length} items • bloxfruitsvalues.com` })
    .setTimestamp();
}

function buildRow(category, page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`values:${category}:${page - 1}`)
      .setLabel('Previous')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`values:${category}:${page + 1}`)
      .setLabel('Next')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

async function execute(interaction, ctx) {
  await interaction.deferReply();
  const category = interaction.options.getString('category') ?? 'Fruits';

  const all = await api.fetchValues();
  const items = sortItems(
    category === 'All' ? all : all.filter((i) => i.category === category),
  );

  if (!items.length) {
    return interaction.editReply(`❌ No items found in **${category}**.`);
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  return interaction.editReply({
    embeds: [buildPageEmbed(category, items, 0, ctx.config.embedColor)],
    components: [buildRow(category, 0, totalPages)],
  });
}

/** Button handler wired from index.js for customId "values:<category>:<page>". */
async function handleButton(interaction, ctx) {
  const [, category, pageRaw] = interaction.customId.split(':');
  const page = Math.max(0, Number.parseInt(pageRaw, 10) || 0);

  const all = await api.fetchValues();
  const items = sortItems(
    category === 'All' ? all : all.filter((i) => i.category === category),
  );
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  return interaction.update({
    embeds: [buildPageEmbed(category, items, safePage, ctx.config.embedColor)],
    components: [buildRow(category, safePage, totalPages)],
  });
}

module.exports = { data, execute, handleButton, CATEGORIES };
