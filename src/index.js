'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const { config, validate } = require('./config');
const { WatcherState } = require('./store');
const { startStockWatcher } = require('./watcher');

try {
  validate(true);
} catch (error) {
  console.error(`[bot] ${error.message}`);
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Shared context handed to every command.
const ctx = {
  config,
  watcherState: new WatcherState(config.dataDir),
};

// Load command modules from src/commands.
client.commands = new Collection();
const commandsDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsDir, file));
  if (command?.data && command?.execute) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[commands] ${file} is missing data/execute — skipped`);
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`[bot] logged in as ${c.user.tag} (${c.user.id})`);
  const count = client.commands.size;
  console.log(`[bot] ${count} slash commands available — run \`npm run deploy\` if they don't show up`);
  const invite = c.generateInvite({
    scopes: ['bot', 'applications.commands'],
    permissions: ['ViewChannel', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory'],
  });
  console.log(`[bot] invite: ${invite}`);
  startStockWatcher(c, ctx);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, ctx);
    } else if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command?.autocomplete) return;
      await command.autocomplete(interaction, ctx);
    } else if (interaction.isButton() && interaction.customId.startsWith('values:')) {
      const valuesCommand = client.commands.get('values');
      await valuesCommand.handleButton(interaction, ctx);
    }
  } catch (error) {
    console.error(`[interaction] ${interaction.id} failed:`, error);
    // Data/network issues are safe to surface (helps debugging bad hosts/IP blocks);
    // anything else stays generic on a public bot.
    const api = require('./api');
    const detail = error instanceof api.ApiError ? ` (${error.message})` : '';
    const reply = {
      content: `❌ Something went wrong while handling that — try again in a moment.${detail}`,
      ephemeral: true,
    };
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) await interaction.followUp(reply).catch(() => {});
      else await interaction.reply(reply).catch(() => {});
    }
  }
});

client.login(config.token);
