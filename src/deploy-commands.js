'use strict';

/**
 * Registers slash commands globally with Discord (public bot — no guild
 * scoping). Global commands propagate within ~1 hour; re-running is safe.
 */

const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const { config, validate } = require('./config');

try {
  validate(true);
} catch (error) {
  console.error(`[deploy] ${error.message}`);
  process.exit(1);
}

const commands = [];
const commandsDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsDir, file));
  if (command?.data) commands.push(command.data.toJSON());
}

const rest = new REST().setToken(config.token);

(async () => {
  try {
    console.log(`[deploy] refreshing ${commands.length} global commands…`);
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    console.log('[deploy] done — global commands can take up to an hour to appear everywhere.');
  } catch (error) {
    console.error('[deploy] failed:', error);
    process.exitCode = 1;
  }
})();
