// Template: copy this file to add a new command.
module.exports = {
  command: 'ping', // string or array of aliases e.g. ['ping', 'p']
  description: 'Check bot response speed',
  async execute({ sock, msg, from, args }) {
    const start = Date.now();
    const sent = await sock.sendMessage(from, { text: '🏓 Pinging...' }, { quoted: msg });
    const ms = Date.now() - start;
    await sock.sendMessage(from, { text: `🏓 Pong! ${ms}ms` });
  },
};
