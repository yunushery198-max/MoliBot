module.exports = {
  name: "test",
  async execute(sock, m, args) {
    await sock.sendMessage(m.key.remoteJid, { text: "✅ Command test jalan!" });
  }
};
