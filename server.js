const express = require('express');
const path = require('path');
const { startBot, resetForRetry } = require('./index');
const { loadPlugins } = require('./lib/pluginLoader');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
let botLaunched = false;
let pairingInProgress = false;

loadPlugins();

// If a session already exists (e.g. after a Railway restart), auto-reconnect
// without needing a phone number / new pairing code.
const fs = require('fs');
if (fs.existsSync('./session') && fs.readdirSync('./session').length > 0) {
  botLaunched = true;
  startBot().catch((e) => console.error('Auto-reconnect failed:', e));
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Frontend polls this after submitting a phone number
app.post('/api/pair', async (req, res) => {
  const { number } = req.body;
  if (!number || number.replace(/[^0-9]/g, '').length < 8) {
    return res.status(400).json({ error: 'Enter a valid phone number with country code.' });
  }

  if (pairingInProgress) {
    return res.status(429).json({ error: 'A pairing request is already in progress. Wait a moment and try again.' });
  }

  try {
    pairingInProgress = true;

    // If a previous attempt failed (or bot is connected already but user wants a fresh code),
    // reset state so we can actually retry instead of silently doing nothing.
    if (!global.connectionStatus || global.connectionStatus === 'disconnected') {
      resetForRetry();
      botLaunched = true;
      startBot(number).catch((e) => {
        console.error('startBot error:', e);
        global.pairingError = e.message;
      });
    }

    // Wait up to ~20s for either a pairing code or an error
    let attempts = 0;
    while (!global.latestPairingCode && !global.pairingError && attempts < 40) {
      await new Promise((r) => setTimeout(r, 500));
      attempts++;
    }

    if (global.latestPairingCode) {
      const code = global.latestPairingCode;
      return res.json({ code });
    }

    if (global.pairingError) {
      const msg = global.pairingError;
      global.pairingError = null;
      return res.status(500).json({ error: `WhatsApp rejected the request: ${msg}` });
    }

    return res.status(504).json({ error: 'Timed out generating pairing code. Check server logs and try again.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    pairingInProgress = false;
  }
});

app.get('/api/status', (req, res) => {
  res.json({ status: global.connectionStatus || 'disconnected' });
});

// Simple endpoint for uptime-monitor pings (UptimeRobot etc.) to keep Railway awake
app.get('/ping', (req, res) => res.send('pong'));

app.listen(PORT, () => {
  console.log(`🌐 Pairing server running at http://localhost:${PORT}`);
});
