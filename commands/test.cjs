module.exports = {
  name: "test",
  async execute(sock, m) {
    await sock.sendMessage(m.key.remoteJid, { text: "✅ Test auto aktif!" });
  }
}