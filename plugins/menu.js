module.exports = {
  command: ['menu', 'help'],
  description: 'Show all available commands',
  async execute({ sock, msg, from, prefix }) {
    const { plugins } = require('../lib/pluginLoader');
    const seen = new Set();

    let text = '╭───「 *BOT MENU* 」\n│\n';
    for (const plugin of plugins.values()) {
      if (seen.has(plugin)) continue;
      seen.add(plugin);
      const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
      text += `│ ➤ ${prefix}${cmds[0]} — ${plugin.description || 'No description'}\n`;
    }
    text += '╰───────────────';

    await sock.sendMessage(from, { text }, { quoted: msg });
  },
};
