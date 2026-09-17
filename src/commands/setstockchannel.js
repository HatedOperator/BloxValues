'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const data = new SlashCommandBuilder()
  .setName('setstockchannel')
  .setDescription('Choose where automatic stock updates are posted in this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('Channel to post stock updates into (leave empty to view the current one)')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
  )
  .addBooleanOption((option) =>
    option
      .setName('clear')
      .setDescription('Stop posting automatic stock updates in this server'),
  );

async function execute(interaction, ctx) {
  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.reply({ content: '❌ This command only works inside a server.', ephemeral: true });
  }

  const clear = interaction.options.getBoolean('clear') ?? false;
  const channel = interaction.options.getChannel('channel');

  if (clear) {
    ctx.guildSettings.clearStockChannel(guildId);
    return interaction.reply({
      content: '🧹 Automatic stock updates are now **disabled** for this server.',
      ephemeral: true,
    });
  }

  if (channel) {
    ctx.guildSettings.setStockChannel(guildId, channel.id);
    return interaction.reply({
      content: `✅ Stock updates will now be posted in ${channel}.`,
      ephemeral: true,
    });
  }

  const currentId = ctx.guildSettings.getStockChannel(guildId);
  if (currentId) {
    return interaction.reply({
      content: `📍 Stock updates for this server currently go to <#${currentId}>. Use \`/setstockchannel channel:#other\` to change it, or \`/setstockchannel clear:true\` to disable.`,
      ephemeral: true,
    });
  }
  return interaction.reply({
    content:
      '📍 No stock channel is set for this server yet. Use `/setstockchannel channel:#your-channel` to enable automatic updates.',
    ephemeral: true,
  });
}

module.exports = { data, execute };
