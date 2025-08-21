// commands/promo.cjs
const promoDB = {};       // { groupId: [ { text, user } ] }
const promoTimers = {};   // { groupId: interval/schedule handler }

function getPromos(groupId) {
  if (!promoDB[groupId]) promoDB[groupId] = [];
  return promoDB[groupId];
}

function listPromos(groupId) {
  const promos = getPromos(groupId);
  if (promos.length === 0) return "❌ Belum ada promo di grup ini.";
  return promos
    .map((p, i) => `*${i + 1}.* ${p.text} _(oleh @${p.user})_`)
    .join("\n");
}

function sendRandomPromo(sock, groupId) {
  const promos = getPromos(groupId);
  if (promos.length === 0) return;
  const p = promos[Math.floor(Math.random() * promos.length)];
  sock.sendMessage(groupId, { text: `📢 *Promo Grup:*\n${p.text}` });
}

module.exports = {
  name: "promo",
  description: "Atur promo otomatis per grup",
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const sender = (msg.key.participant || msg.key.remoteJid).split("@")[0];

    const sub = args[0];
    if (!sub) {
      return sock.sendMessage(from, {
        text: "⚠️ Gunakan: .promo <add|list|del|clear|on|schedule|off>",
      });
    }

    // ➕ Tambah promo
    if (sub === "add") {
      const text = args.slice(1).join(" ");
      if (!text) return sock.sendMessage(from, { text: "⚠️ Gunakan: .promo add <teks promo>" });
      getPromos(from).push({ text, user: sender });
      return sock.sendMessage(from, { text: `✅ Promo ditambahkan!\n\n${listPromos(from)}`, mentions: [msg.key.participant] });
    }

    // 📋 List promo
    if (sub === "list") {
      return sock.sendMessage(from, { text: listPromos(from), mentions: getPromos(from).map(p => p.user + "@s.whatsapp.net") });
    }

    // ❌ Hapus promo berdasarkan nomor
    if (sub === "del") {
      const ids = args.slice(1).map(n => parseInt(n) - 1).filter(n => !isNaN(n));
      if (ids.length === 0) return sock.sendMessage(from, { text: "⚠️ Gunakan: .promo del <id...>" });

      let promos = getPromos(from);
      ids.sort((a, b) => b - a).forEach(i => {
        if (promos[i]) promos.splice(i, 1);
      });

      return sock.sendMessage(from, { text: `🗑️ Promo terhapus!\n\n${listPromos(from)}` });
    }

    // 🧹 Clear semua promo
    if (sub === "clear") {
      promoDB[from] = [];
      return sock.sendMessage(from, { text: "🧹 Semua promo dihapus!" });
    }

    // ▶️ Auto-post tiap X menit
    if (sub === "on") {
      const minutes = parseInt(args[1]);
      if (isNaN(minutes) || minutes < 1) return sock.sendMessage(from, { text: "⚠️ Gunakan: .promo on <menit>" });

      if (promoTimers[from]) clearInterval(promoTimers[from]);
      promoTimers[from] = setInterval(() => sendRandomPromo(sock, from), minutes * 60 * 1000);

      return sock.sendMessage(from, { text: `✅ Auto-post promo aktif tiap ${minutes} menit.` });
    }

    // ⏰ Jadwal fix jam tertentu (HH:MM)
    if (sub === "schedule") {
      const times = args.slice(1);
      if (times.length === 0) return sock.sendMessage(from, { text: "⚠️ Gunakan: .promo schedule <HH:MM> <HH:MM> ..." });

      if (promoTimers[from]) clearInterval(promoTimers[from]);

      // cek tiap menit
      promoTimers[from] = setInterval(() => {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const current = `${hh}:${mm}`;
        if (times.includes(current)) sendRandomPromo(sock, from);
      }, 60 * 1000);

      return sock.sendMessage(from, { text: `✅ Auto-post promo aktif di jam: ${times.join(", ")}` });
    }

    // ⏹️ Matikan auto
    if (sub === "off") {
      if (promoTimers[from]) {
        clearInterval(promoTimers[from]);
        delete promoTimers[from];
      }
      return sock.sendMessage(from, { text: "🛑 Auto-post promo dimatikan." });
    }
  },
};
