'use strict';

/**
 * Registers slash commands with Discord.
 * With GUILD_ID set → instant update in that guild; otherwise global
 * (propagates within ~1 hour).
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
    if (config.guildId) {
      console.log(`[deploy] refreshing ${commands.length} guild commands in ${config.guildId}…`);
      await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
        body: commands,
      });
      console.log('[deploy] done — commands should appear immediately.');
    } else {
      console.log(`[deploy] refreshing ${commands.length} global commands…`);
      await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
      console.log('[deploy] done — global commands can take up to an hour to appear.');
    }
  } catch (error) {
    console.error('[deploy] failed:', error);
    process.exitCode = 1;
  }
})();
