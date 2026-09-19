# BloxValues 🍈

A Discord bot for **Roblox Blox Fruits** that shows live item trade values and automatically posts **Normal & Mirage dealer stock** rotations into your channel.

Data comes from the public community site [bloxfruitsvalues.com](https://bloxfruitsvalues.com) — no API keys needed.

## Features

- **`/value item`** — value, permanent value, demand, trend, dealer prices and best-use info for any fruit, gamepass or limited item (with autocomplete).
- **`/values category`** — paginated value list for Fruits, Gamepasses, Limiteds or everything.
- **`/stock`** — current Normal & Mirage dealer stock with reset countdowns.
- **Live stock channel** — the bot keeps **two separate live messages** (Normal and Mirage) in its stock channel; each is deleted and resent only when that side rotates.
- **Rare-fruit alerts** — when a rotation contains rare/good fruit (Legendary/Mythical or ≥1M value), the stock message gets a 🔔 alert line (and an optional role ping via `STOCK_PING_ROLE_ID`). Mythical-tier finds also fire a third 🚨 **ultra-rare alert** message.
- **`/help`** — quick overview.

Stock rotations (Normal every 4h, Mirage every 2h) are detected automatically (≈ every 30s) — the stock channel's message is deleted and replaced with the new rotation, so there's always exactly one current stock post. Commands are registered globally, so the bot works in any server that invites it.

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
| `STOCK_CHANNEL_ID` | ➖ | Channel for the live stock messages (has a built-in default) |
| `STOCK_PING_ROLE_ID` | ➖ | Role pinged only when a rotation has rare/good fruit |
| `EMBED_COLOR` | ➖ | Fallback embed accent color |
| `DATA_DIR` | ➖ | Data directory override (defaults to `<repo>/data`) |

### 3. Register commands & run

```bash
npm run deploy   # register slash commands globally (once, and after adding new ones)
npm start        # start the bot
```

The bot keeps the live stock message updated in the channel set by `STOCK_CHANNEL_ID` (defaults to `1549345099543093258`) — no in-Discord setup needed.

## Deploying to Railway

The repo is Railway-ready (`railway.json` sets the start command, and slash commands are re-registered automatically on every deploy — no manual `npm run deploy` needed).

1. Push the repo to GitHub, then in [Railway](https://railway.app) → **New Project** → **Deploy from GitHub repo** → pick `HatedOperator/BloxValues`.
2. In the service → **Variables**, add:
   - `DISCORD_TOKEN` (required)
   - `CLIENT_ID` (required)
   - `EMBED_COLOR` / `DATA_DIR` if you want to customize (see the table above)
3. *(Recommended)* Attach a **Volume** to the service and mount it at `/data`, then set `DATA_DIR=/data`. This persists the watcher state across deploys. Without a volume the bot still works — it just does a full delete-and-resend of the stock message after every redeploy (which it would do anyway on startup).
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
