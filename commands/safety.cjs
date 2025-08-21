const badWords = ["mesum", "kontol", "anjing", "bangsat", "memek", "jancok"]; // bisa tambah sendiri
const safetyMessages = []; // simpan pesan user
const safetySchedules = {}; // per grup

// random icon buat variasi tampilan ajakan
const icons = ["👷", "📝", "✍️", "⚒️", "⛑️", "🛠️", "📌", "💡", "⚠️"];

function getRandomIcon() {
  return icons[Math.floor(Math.random() * icons.length)];
}

function getRandomSafetyMessage() {
  if (safetyMessages.length === 0) {
    return "⚠️ Ingat, keselamatan adalah prioritas utama di tambang batubara.";
  }
  const msg = safetyMessages[Math.floor(Math.random() * safetyMessages.length)];
  return `✅ *Pesan Safety:*\n${msg.text}\n\n📌 Sumber: @${msg.user}`;
}

module.exports = {
  name: "safety",
  description: "Atur atau tambahkan pesan keselamatan kerja",

  // 🔥 Default aktif otomatis tiap 60 menit
  init(sock) {
    const defaultInterval = 60 * 60 * 1000; // 60 menit

    sock.ev.on("chats.set", async ({ chats }) => {
      for (const chat of chats) {
        if (chat.id.endsWith("@g.us")) {
          const groupId = chat.id;

          if (safetySchedules[groupId]) clearInterval(safetySchedules[groupId]);

          safetySchedules[groupId] = setInterval(async () => {
            const msgText = getRandomSafetyMessage();
            const icon = getRandomIcon();
            const footer = `───────────────\n📢 Ingin berbagi pesan safety?\n${icon} Ketik: .s <pesan>\n───────────────`;

            await sock.sendMessage(groupId, { text: `${msgText}\n\n${footer}` });
          }, defaultInterval);

          console.log(`⚡ Safety auto-post aktif default di grup ${groupId} setiap 60 menit`);
        }
      }
    });
  },

  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const cmd = msg.message.conversation?.split(" ")[0].substring(1);

    // USER: tambah pesan baru
    if (cmd === "s") {
      const text = args.join(" ");
      if (!text) {
        return sock.sendMessage(from, { text: "⚠️ Gunakan: .s <pesan keselamatan>" });
      }

      // filter kata jorok
      const lower = text.toLowerCase();
      if (badWords.some(b => lower.includes(b))) {
        return sock.sendMessage(from, { text: "❌ Pesan mengandung kata yang tidak pantas." });
      }

      // simpan pesan
      safetyMessages.push({ text, user: sender.split("@")[0] });

      return sock.sendMessage(from, {
        text: `✅ Pesan safety berhasil ditambahkan!\nAkan dipost otomatis sesuai jadwal grup.`
      });
    }

    // ADMIN: override jadwal auto post
    if (cmd === "safety") {
      if (args.length < 3) {
        return sock.sendMessage(from, { text: "⚠️ Gunakan: .safety <idgrup> <menit> <on|off>" });
      }

      const [groupId, minutes, status] = args;
      const interval = parseInt(minutes) * 60 * 1000;

      if (status === "on") {
        if (safetySchedules[groupId]) {
          clearInterval(safetySchedules[groupId]);
        }
        safetySchedules[groupId] = setInterval(async () => {
          const msgText = getRandomSafetyMessage();
          const icon = getRandomIcon();
          const footer = `───────────────\n📢 Ingin berbagi pesan safety?\n${icon} Ketik: .s <pesan>\n───────────────`;

          await sock.sendMessage(groupId, { text: `${msgText}\n\n${footer}` });
        }, interval);

        return sock.sendMessage(from, { text: `✅ Safety auto-post aktif di grup ${groupId} setiap ${minutes} menit.` });
      }

      if (status === "off") {
        if (safetySchedules[groupId]) {
          clearInterval(safetySchedules[groupId]);
          delete safetySchedules[groupId];
        }
        return sock.sendMessage(from, { text: `🛑 Safety auto-post dimatikan di grup ${groupId}.` });
      }
    }
  }
};
