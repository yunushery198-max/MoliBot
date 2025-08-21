// moli-bot/commands/halo.cjs
module.exports = {
  name: "halo",
  async execute(sock, m) {
    const from = m.key.remoteJid; 
    await sock.sendMessage(from, { text: "Hai juga 👋" });
  }
};
