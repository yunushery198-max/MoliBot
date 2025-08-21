module.exports = {
  name: "testadd",
  async execute(sock, m) {
    await sock.sendMessage(m.key.remoteJid, { text: "✅ Command testadd berhasil ditambahkan & aktif!" });
  }
}