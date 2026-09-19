'use strict';

const { SlashCommandBuilder } = require('discord.js');
const api = require('../api');
const { buildStockEmbeds } = require('../embeds');

const data = new SlashCommandBuilder()
  .setName('stock')
  .setDescription('Show the current Normal and Mirage dealer stock');

async function execute(interaction, ctx) {
  await interaction.deferReply();
  const stock = await api.fetchStock();
  const embeds = buildStockEmbeds(stock, {
    footerExtra: 'A live version of this is kept updated in the stock channel',
  });
  return interaction.editReply({ embeds });
}

module.exports = { data, execute };
