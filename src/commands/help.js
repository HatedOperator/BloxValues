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
        name: 'Live stock channel',
        value:
          'The bot keeps one up-to-date stock message in its stock channel — refreshed automatically after every Normal (4h) and Mirage (2h) rotation.',
      },
    )
    .setFooter({ text: 'Data: bloxfruitsvalues.com • Not affiliated with Gamer Robot' });
  return interaction.reply({ embeds: [embed] });
}

module.exports = { data, execute };
