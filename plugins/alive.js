module.exports = {
  command: 'alive',
  description: 'Check if the bot is online',
  async execute({ sock, msg, from }) {
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);

    await sock.sendMessage(
      from,
      {
        text:
          `✅ *Bot is Alive!*\n\n` +
          `⏱️ Uptime: ${h}h ${m}m ${s}s\n` +
          `🚀 Status: Running 24/7 on Railway`,
      },
      { quoted: msg }
    );
  },
};
