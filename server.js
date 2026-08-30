const express = require('express');
const path = require('path');
const { startBot } = require('./index');
const { loadPlugins } = require('./lib/pluginLoader');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
let botLaunched = false;

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

  try {
    if (!botLaunched) {
      botLaunched = true;
      global.latestPairingCode = null;
      startBot(number).catch((e) => console.error('startBot error:', e));
    }

    // Wait up to ~15s for the pairing code to be generated
    let attempts = 0;
    while (!global.latestPairingCode && attempts < 30) {
      await new Promise((r) => setTimeout(r, 500));
      attempts++;
    }

    if (global.latestPairingCode) {
      const code = global.latestPairingCode;
      return res.json({ code });
    }
    return res.status(504).json({ error: 'Timed out generating pairing code. Try again.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
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
