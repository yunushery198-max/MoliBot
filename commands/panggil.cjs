// moli-bot/commands/panggil.cjs
module.exports = {
  name: "panggil",
  description: "Mention semua member grup",
  async execute(sock, msg) {
    const from = msg.key.remoteJid;

    // cek apakah ini grup
    if (!from.endsWith("@g.us")) {
      return sock.sendMessage(from, {
        text: "❌ Perintah ini hanya bisa dipakai di dalam grup."
      });
    }

    const metadata = await sock.groupMetadata(from);
    const members = metadata.participants.map(m => m.id);

    if (members.length === 0) {
      return sock.sendMessage(from, { text: "❌ Tidak ada member di grup ini." });
    }

    // batch 50 member per pesan
    const batchSize = 50;
    for (let i = 0; i < members.length; i += batchSize) {
      const batch = members.slice(i, i + batchSize);
      await sock.sendMessage(from, {
        text: "📢 Panggilan untuk semua member!\n" + batch.map(id => `@${id.split('@')[0]}`).join(" "),
        mentions: batch
      });
    }
  }
};
