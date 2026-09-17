'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

const data = new SlashCommandBuilder()
  .setName('stocksettings')
  .setDescription('Configure automatic stock updates for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set or update stock update settings')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('Channel where stock rotations are posted')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
      )
      .addRoleOption((option) =>
        option
          .setName('mention_role')
          .setDescription('Role to ping when a new stock rotation is posted'),
      )
      .addIntegerOption((option) =>
        option
          .setName('poll_seconds')
          .setDescription('How often to check/deliver stock updates (seconds, 15–3600)')
          .setMinValue(15)
          .setMaxValue(3600),
      )
      .addBooleanOption((option) =>
        option
          .setName('post_on_startup')
          .setDescription('Post the current stock when the channel is first set up (default: true)'),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('view').setDescription('Show the current stock update settings'),
  )
  .addSubcommand((sub) =>
    sub.setName('reset').setDescription('Disable automatic stock updates in this server'),
  );

async function execute(interaction, ctx) {
  if (!interaction.guildId) {
    return interaction.reply({ content: '❌ This command only works inside a server.', ephemeral: true });
  }
  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();

  if (sub === 'view') {
    const s = ctx.guildSettings.get(guildId);
    if (!s.channelId) {
      return interaction.reply({
        content:
          '📍 Automatic stock updates are **not configured** here yet. Use `/stocksettings set channel:#your-channel` to enable them.',
        ephemeral: true,
      });
    }
    return interaction.reply({
      content:
        `📍 **Stock update settings**\n` +
        `• Channel: <#${s.channelId}>\n` +
        `• Mention role: ${s.mentionRoleId ? `<@&${s.mentionRoleId}>` : '*none*'}\n` +
        `• Check interval: every ${s.pollSeconds}s\n` +
        `• Post current stock on setup: ${s.postOnStartup ? 'yes' : 'no'}`,
      ephemeral: true,
    });
  }

  if (sub === 'reset') {
    ctx.guildSettings.reset(guildId);
    ctx.watcherState.resetGuild(guildId);
    return interaction.reply({
      content: '🧹 Automatic stock updates are now **disabled** for this server.',
      ephemeral: true,
    });
  }

  // sub === 'set'
  const channel = interaction.options.getChannel('channel');
  const mentionRole = interaction.options.getRole('mention_role');
  const pollSeconds = interaction.options.getInteger('poll_seconds');
  const postOnStartup = interaction.options.getBoolean('post_on_startup');

  if (!channel && !mentionRole && pollSeconds === null && postOnStartup === null) {
    return interaction.reply({
      content: '❌ Provide at least one option — e.g. `/stocksettings set channel:#stock`.',
      ephemeral: true,
    });
  }

  if (channel) {
    const me = interaction.guild.members.me;
    const perms = channel.permissionsFor(me);
    if (!perms?.has(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.EmbedLinks)) {
      return interaction.reply({
        content: `❌ I need **View Channel**, **Send Messages** and **Embed Links** in ${channel}. Fix the permissions and try again.`,
        ephemeral: true,
      });
    }
  }

  const patch = {};
  if (channel) patch.channelId = channel.id;
  if (mentionRole) patch.mentionRoleId = mentionRole.id;
  if (pollSeconds !== null) patch.pollSeconds = pollSeconds;
  if (postOnStartup !== null) patch.postOnStartup = postOnStartup;
  ctx.guildSettings.update(guildId, patch);

  // New channel (or re-configured): deliver the current stock there fresh.
  if (channel) ctx.watcherState.resetGuild(guildId);

  const s = ctx.guildSettings.get(guildId);
  return interaction.reply({
    content:
      `✅ Stock updates configured:\n` +
      `• Channel: <#${s.channelId}>\n` +
      `• Mention role: ${s.mentionRoleId ? `<@&${s.mentionRoleId}>` : '*none*'}\n` +
      `• Check interval: every ${s.pollSeconds}s\n` +
      `• Post current stock on setup: ${s.postOnStartup ? 'yes' : 'no'}\n\n` +
      (s.postOnStartup
        ? 'The current stock will be posted shortly.'
        : 'The next rotation will be posted automatically.'),
    ephemeral: true,
  });
}

module.exports = { data, execute };
