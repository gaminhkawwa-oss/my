const fs = require('fs');
const path = require('path');

const plugins = new Map();

function loadPlugins() {
  plugins.clear();
  const dir = path.join(__dirname, '..', 'plugins');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const fullPath = path.join(dir, file);
    delete require.cache[require.resolve(fullPath)];
    const plugin = require(fullPath);

    if (!plugin.command || !plugin.execute) {
      console.log(`⚠️  Skipped ${file} (missing "command" or "execute")`);
      continue;
    }

    const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
    for (const c of cmds) plugins.set(c.toLowerCase(), plugin);
  }

  console.log(`🔌 Loaded ${plugins.size} command(s) from ${files.length} plugin file(s)`);
  return plugins;
}

module.exports = { loadPlugins, plugins };
