module.exports = {
  name: "ping",
  async execute(sock, m, args, commands, loadCommands) {
    const from = m.key.remoteJid;
    await sock.sendMessage(from, { text: "🏓 Pong!" });
  }
};
