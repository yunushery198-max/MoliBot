module.exports = {
  name: "teslog",
  description: "Cek apakah command jalan",
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    console.log("✅ Command teslog berhasil dipanggil, args:", args);
    await sock.sendMessage(from, { text: "✅ Bot jalan normal bro!" });
  }
};
