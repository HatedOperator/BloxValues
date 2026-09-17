# BloxValues 🍈

A Discord bot for **Roblox Blox Fruits** that shows live item trade values and automatically posts **Normal & Mirage dealer stock** rotations into your channel.

Data comes from the public community site [bloxfruitsvalues.com](https://bloxfruitsvalues.com) — no API keys needed.

## Features

- **`/value item`** — value, permanent value, demand, trend, dealer prices and best-use info for any fruit, gamepass or limited item (with autocomplete).
- **`/values category`** — paginated value list for Fruits, Gamepasses, Limiteds or everything.
- **`/stock`** — current Normal & Mirage dealer stock with reset countdowns.
- **`/stocksettings`** — configure automatic stock updates per server (channel, mention role, check interval, startup post). Needs **Manage Server**.
- **`/help`** — quick overview.

Stock rotations (Normal every 4h, Mirage every 2h) are detected automatically and posted into each server's configured channel — with fruit values, demand, trends and images in rich embeds. Commands are registered globally, so the bot works in any server that invites it.

## Setup

### 1. Create the Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Under **Bot**: click **Reset Token** and copy the token.
3. Under **General Information**: copy the **Application ID**.
4. Invite the bot with the URL printed in the bot console when it starts (it requests only View Channel, Send Messages, Embed Links, Read Message History).

### 2. Configure

```bash
git clone https://github.com/HatedOperator/BloxValues.git
cd BloxValues
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | ✅ | Bot token |
| `CLIENT_ID` | ✅ | Application ID |
| `EMBED_COLOR` | ➖ | Fallback embed accent color |
| `DATA_DIR` | ➖ | Data directory override (defaults to `<repo>/data`) |

All stock-update settings (channel, mention role, check interval, post-on-startup) are configured **per server in Discord** with `/stocksettings` — no environment variables needed.

### 3. Register commands & run

```bash
npm run deploy   # register slash commands globally (once, and after adding new ones)
npm start        # start the bot
```

Each server then configures its own updates with `/stocksettings set channel:#your-channel [mention_role:@role] [poll_seconds:60] [post_on_startup:true]`, checks them with `/stocksettings view`, and disables them with `/stocksettings reset`.

## Deploying to Railway

The repo is Railway-ready (`railway.json` sets the start command, and slash commands are re-registered automatically on every deploy — no manual `npm run deploy` needed).

1. Push the repo to GitHub, then in [Railway](https://railway.app) → **New Project** → **Deploy from GitHub repo** → pick `HatedOperator/BloxValues`.
2. In the service → **Variables**, add:
   - `DISCORD_TOKEN` (required)
   - `CLIENT_ID` (required)
   - `EMBED_COLOR` / `DATA_DIR` if you want to customize (see the table above)
3. *(Recommended)* Attach a **Volume** to the service and mount it at `/data`, then set `DATA_DIR=/data`. This persists per-server `/stocksettings` configurations and the watcher state across deploys. Without a volume the bot still works — servers just get a fresh stock post after every redeploy.
4. Railway auto-detects Node (Nixpacks), runs `npm install`, and starts the bot with `npm run deploy; npm start`. If the process crashes, Railway restarts it automatically.

## Running with Docker

```bash
docker build -t bloxvalues .
docker run -d --env-file .env -v bloxvalues-data:/app/data --name bloxvalues bloxvalues
```

## Project layout

```
src/
├── index.js             # client, interaction routing, watcher startup
├── deploy-commands.js   # global slash-command registration script
├── config.js            # .env loading & validation
├── api.js               # Blox Fruits data client (values + stock, cached)
├── embeds.js            # stock embed builders
├── format.js            # value/demand/trend/rarity formatting
├── store.js             # JSON persistence (per-guild settings, watcher state)
├── watcher.js           # multi-guild rotation detection + delivery
└── commands/            # one file per slash command
```

## How the data works

- **Values** — `GET https://bloxfruitsvalues.com/api/v1/values` (public JSON, cached ~10 min).
- **Stock** — the site's `/stock` page embeds the live dealer snapshot server-side; the bot extracts that snapshot each poll, compares it with the last posted rotation, and posts only when the stock actually changes (restart-safe via a persisted signature).

Not affiliated with Gamer Robot or bloxfruitsvalues.com. Values are community estimates.

## License

[MIT](LICENSE)
