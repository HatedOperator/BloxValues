# BloxValues 🍈

A Discord bot for **Roblox Blox Fruits** that shows live item trade values and automatically posts **Normal & Mirage dealer stock** rotations into your channel.

Data comes from the public community site [bloxfruitsvalues.com](https://bloxfruitsvalues.com) — no API keys needed.

## Features

- **`/value item`** — value, permanent value, demand, trend, dealer prices and best-use info for any fruit, gamepass or limited item (with autocomplete).
- **`/values category`** — paginated value list for Fruits, Gamepasses, Limiteds or everything.
- **`/stock`** — current Normal & Mirage dealer stock with reset countdowns.
- **`/setstockchannel`** — post every stock rotation automatically into a channel (per server).
- **`/help`** — quick overview.

Stock rotations (Normal every 4h, Mirage every 2h) are detected by polling and posted automatically — with fruit values, demand, trends and images in rich embeds.

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
| `STOCK_CHANNEL_ID` | ➖ | Channel ID for automatic stock updates |
| `STOCK_MENTION_ROLE_ID` | ➖ | Role to ping when stock rotates |
| `GUILD_ID` | ➖ | Register commands instantly to one server instead of globally |
| `STOCK_POLL_SECONDS` | ➖ | Stock poll interval (default `60`, min `15`) |
| `POST_ON_STARTUP` | ➖ | Post current stock when the bot boots (default `true`) |
| `EMBED_COLOR` | ➖ | Fallback embed accent color |

> Tip: to get a channel/role ID, enable **Developer Mode** in Discord (Settings → Advanced), then right-click the channel/role → **Copy ID**.

### 3. Register commands & run

```bash
npm run deploy   # register slash commands (once, and after adding new ones)
npm start        # start the bot
```

Per-server stock channels can also be managed in Discord with `/setstockchannel` (needs **Manage Server**).

## Deploying to Railway

The repo is Railway-ready (`railway.json` sets the start command, and slash commands are re-registered automatically on every deploy — no manual `npm run deploy` needed).

1. Push the repo to GitHub, then in [Railway](https://railway.app) → **New Project** → **Deploy from GitHub repo** → pick `HatedOperator/BloxValues`.
2. In the service → **Variables**, add:
   - `DISCORD_TOKEN` (required)
   - `CLIENT_ID` (required)
   - `STOCK_CHANNEL_ID`, `STOCK_MENTION_ROLE_ID`, `GUILD_ID`, `STOCK_POLL_SECONDS`, `POST_ON_STARTUP` as needed (see the table above)
3. *(Recommended)* Attach a **Volume** to the service and mount it at `/data`, then set `DATA_DIR=/data`. This persists per-server `/setstockchannel` settings and the watcher state across deploys. Without a volume the bot still works — it just re-posts the current stock once after every redeploy.
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
├── deploy-commands.js   # slash-command registration script
├── config.js            # .env loading & validation
├── api.js               # Blox Fruits data client (values + stock, cached)
├── embeds.js            # stock embed builders
├── format.js            # value/demand/trend/rarity formatting
├── store.js             # JSON persistence (guild settings, watcher state)
├── watcher.js           # rotation detection + auto-posting
└── commands/            # one file per slash command
```

## How the data works

- **Values** — `GET https://bloxfruitsvalues.com/api/v1/values` (public JSON, cached ~10 min).
- **Stock** — the site's `/stock` page embeds the live dealer snapshot server-side; the bot extracts that snapshot each poll, compares it with the last posted rotation, and posts only when the stock actually changes (restart-safe via a persisted signature).

Not affiliated with Gamer Robot or bloxfruitsvalues.com. Values are community estimates.

## License

[MIT](LICENSE)
