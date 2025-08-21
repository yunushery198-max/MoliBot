// commands/group.cjs
module.exports = {
  name: "group",
  description: "Atur & lihat daftar group",
  async execute(sock, m, args) {
    const from = m.key.remoteJid;
    const sub = args[0];

    // 📌 ambil semua grup yg bot sudah join
    const allGroups = await sock.groupFetchAllParticipating();

    if (sub === "list") {
      const groupList = Object.values(allGroups);

      if (groupList.length === 0) {
        return sock.sendMessage(from, { text: "❌ Bot belum ada di grup manapun." });
      }

      let list = "📋 *Daftar Group yg terdaftar:*\n\n";
      for (const g of groupList) {
        list += `- ${g.subject} (${g.id})\n`;
      }
      return sock.sendMessage(from, { text: list });
    }

    return sock.sendMessage(from, {
      text: "⚠️ Gunakan:\n.group list\n(group add/del bisa kita buat menyusul)"
    });
  }
};
