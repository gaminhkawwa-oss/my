# WhatsApp Pair-Code Bot

A multi-device WhatsApp bot built on [Baileys](https://github.com/WhiskeySockets/Baileys), with:

- **Prefix:** `.` (change via `PREFIX` env var)
- **Login:** pairing code only — no QR scan, no pasted session-ID string
- **Multi-device support** (Baileys is multi-device by default)
- **Plugin system** — drop a file in `/plugins`, it auto-loads
- **`menu` / `help`** — lists all commands
- **`alive`** — uptime check
- **HTML pairing page** — served at `/`
- Built for **Railway** hosting (24/7)

## How pairing works

Instead of scanning a QR code or pasting a session string, you:
1. Open the web page the bot serves
2. Type your WhatsApp number (with country code, digits only)
3. Get an 8-digit code
4. Enter that code in WhatsApp → **Settings → Linked Devices → Link a Device → Link with phone number instead**

Once linked, WhatsApp's own multi-device auth keeps the bot connected — the code is only needed once.

## Local setup

```bash
npm install
npm start
```

Then open `http://localhost:3000`, enter your number, and pair.

## Adding commands (plugins)

Create a new file in `/plugins`, e.g. `plugins/hello.js`:

```js
module.exports = {
  command: 'hello',        // or ['hello', 'hi'] for aliases
  description: 'Say hello',
  async execute({ sock, msg, from, args }) {
    await sock.sendMessage(from, { text: 'Hello there!' }, { quoted: msg });
  },
};
```

Restart the bot (or redeploy) and it's automatically picked up — no need to edit any other file.

Each plugin's `execute()` receives:
- `sock` — the Baileys socket (for sending messages, etc.)
- `msg` — the raw incoming message object
- `from` — the chat JID to reply to
- `sender` — the actual sender's JID (useful in groups)
- `args` — the command's arguments, already split by space
- `prefix` — the active prefix

## Deploying to Railway

1. Push this folder to a GitHub repo.
2. On [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
3. Railway auto-detects Node and uses `railway.json` / `Procfile` to run `node server.js`.
4. Once deployed, open your Railway-provided URL — that's your pairing page.
5. Pair once from there. The bot then stays connected.

### ⚠️ Important: session persistence

Baileys saves login credentials to the `./session` folder. Railway's filesystem is **ephemeral** by default — on redeploy/restart, `./session` can be wiped, and you'd need to pair again.

To avoid re-pairing every restart, attach a **Railway Volume**:
1. In your Railway project → your service → **Settings → Volumes**
2. Add a volume, mount path: `/app/session`
3. Redeploy

With a volume mounted, the bot reconnects automatically on restart using the saved session — no new pairing code needed.

### Keeping it awake 24/7

Railway apps on a paid/always-on plan stay up on their own. If you're on a plan that sleeps idle services, ping the `/ping` route every few minutes with a free uptime monitor (e.g. UptimeRobot, cron-job.org) pointed at `https://your-app.up.railway.app/ping`.

## Project structure

```
wa-bot/
├── index.js           # Baileys connection + message handling
├── server.js           # Express server: pairing page + API + keep-alive
├── lib/
│   └── pluginLoader.js # Auto-loads plugins/*.js
├── plugins/
│   ├── menu.js
│   ├── alive.js
│   └── ping.js          # template for new commands
├── public/
│   └── index.html       # Pairing web UI
├── railway.json
├── Procfile
└── package.json
```

## ⚠️ Disclaimer

This uses an unofficial, reverse-engineered protocol library, not WhatsApp's official Business API. WhatsApp can and does ban numbers it detects running automated/unofficial clients, especially with heavy message volume. Use a non-critical number, keep usage reasonable, and understand the risk before connecting a number you rely on.
