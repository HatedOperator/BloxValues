'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show what BloxValues can do');

async function execute(interaction, ctx) {
  const embed = new EmbedBuilder()
    .setTitle('🍈 BloxValues — Blox Fruits values & live stock')
    .setColor(ctx.config.embedColor)
    .setThumbnail('https://i.postimg.cc/CLxbycr9/Kitsune.png')
    .setDescription(
      'Item values and dealer stock, straight from [bloxfruitsvalues.com](https://bloxfruitsvalues.com).',
    )
    .addFields(
      {
        name: '/value item',
        value: 'Trade value, demand, trend and prices for one item (with autocomplete).',
      },
      {
        name: '/values category',
        value: 'Browse the full value list — Fruits, Gamepasses, Limiteds or everything.',
      },
      { name: '/stock', value: 'Current Normal & Mirage dealer stock with reset countdown.' },
      {
        name: '/setstockchannel',
        value: 'Have new stock rotations posted automatically in a channel (Manage Server).',
      },
      {
        name: 'Automatic updates',
        value:
          'Every rotation the bot posts both stocks into the configured channel — set one globally with `STOCK_CHANNEL_ID` or per server with `/setstockchannel`.',
      },
    )
    .setFooter({ text: 'Data: bloxfruitsvalues.com • Not affiliated with Gamer Robot' });
  return interaction.reply({ embeds: [embed] });
}

module.exports = { data, execute };
