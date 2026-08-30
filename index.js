const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { plugins } = require('./lib/pluginLoader');

const PREFIX = process.env.PREFIX || '.';
const SESSION_DIR = process.env.SESSION_DIR || './session';

let sock = null;
let isStarting = false;

// Holds the most recently generated pairing code so the web UI can poll for it.
global.latestPairingCode = null;
global.pairingError = null;
global.connectionStatus = 'disconnected'; // disconnected | connecting | connected

async function startBot(phoneNumber) {
  if (isStarting) return sock;
  isStarting = true;

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // we use pairing code, not QR
    browser: Browsers.macOS('Chrome'),
    logger: pino({ level: 'silent' }),
    syncFullHistory: false,
  });

  global.connectionStatus = 'connecting';

  // Request a pairing code only if this device isn't registered yet.
  // Baileys needs the underlying websocket fully connected first, or the
  // request throws "Connection Closed" (428) — so we retry a few times
  // with a growing delay instead of a single fixed wait.
  if (!sock.authState.creds.registered && phoneNumber) {
    global.pairingError = null;
    (async () => {
      const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
      const delays = [2000, 3000, 4000, 5000, 6000]; // ~20s of retrying total
      for (const delay of delays) {
        await new Promise((r) => setTimeout(r, delay));
        try {
          const code = await sock.requestPairingCode(cleanNumber);
          global.latestPairingCode = code;
          console.log('📱 Pairing code:', code);
          return;
        } catch (err) {
          console.error(`Pairing attempt failed (retrying): ${err.message}`);
          // keep looping unless the socket itself died — connection.update
          // handler will restart everything in that case
          if (!sock || sock?.ws?.readyState === 3 /* CLOSED */) break;
        }
      }
      global.latestPairingCode = null;
      global.pairingError = 'Could not reach WhatsApp servers after several attempts. Check the number format and try again.';
      isStarting = false; // allow a fresh retry from the UI
    })();
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      global.connectionStatus = 'disconnected';
      isStarting = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('🔌 Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        setTimeout(() => startBot(), 2000);
      } else {
        console.log('❌ Logged out. Delete the session folder and pair again.');
      }
    } else if (connection === 'open') {
      global.connectionStatus = 'connected';
      global.latestPairingCode = null;
      isStarting = false;
      console.log('✅ Connected to WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      '';

    if (!body.startsWith(PREFIX)) return;

    const args = body.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();
    if (!cmd) return;

    const plugin = plugins.get(cmd);
    if (!plugin) return;

    try {
      await plugin.execute({
        sock,
        msg,
        args,
        from: msg.key.remoteJid,
        sender: msg.key.participant || msg.key.remoteJid,
        prefix: PREFIX,
      });
    } catch (err) {
      console.error(`Error in plugin "${cmd}":`, err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Something went wrong running that command.' });
    }
  });

  return sock;
}

function resetForRetry() {
  isStarting = false;
  sock = null;
  global.latestPairingCode = null;
  global.pairingError = null;
}

module.exports = { startBot, getSock: () => sock, resetForRetry };
