// Cek jadwal sholat manual oleh user: .adzan <sholat> <kota>
// Contoh: .adzan subuh makassar
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const ASSETS_DIR = path.join(__dirname, "..", "assets", "adzan");
const ADZAN_COMMON = path.join(ASSETS_DIR, "adzan.mp3");
const ADZAN_SUBUH = path.join(ASSETS_DIR, "adzan_subuh.mp3");

// normalisasi input sholat
function normalizePrayer(s) {
  const x = (s || "").toLowerCase();
  if (["subuh", "shubuh"].includes(x)) return "Subuh";
  if (["dzuhur", "zuhur", "dhuhur", "duhur"].includes(x)) return "Dzuhur";
  if (["ashar", "asar"].includes(x)) return "Ashar";
  if (["maghrib", "magrib"].includes(x)) return "Maghrib";
  if (["isya", "isyak", "isya’", "isyah"].includes(x)) return "Isya";
  return null;
}

function dateParts(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return { y, m, d: day };
}

async function findCityId(q) {
  const url = `https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(q)}`;
  const { data } = await axios.get(url, { timeout: 15000 });
  if (data?.data?.length) {
    // pilih match terbaik
    const lc = q.toLowerCase();
    let best = data.data[0];
    for (const it of data.data) {
      if (it.lokasi?.toLowerCase() === lc || it.lokasi?.toLowerCase().includes(lc)) {
        best = it; break;
      }
    }
    return best.id;
  }
  return null;
}

async function getTimes(cityId, d = new Date()) {
  const { y, m, d: dd } = dateParts(d);
  const url = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${y}/${m}/${dd}`;
  const { data } = await axios.get(url, { timeout: 15000 });
  const j = data?.data?.jadwal;
  if (!j) return null;
  return {
    Subuh: j.subuh,
    Dzuhur: j.dzuhur,
    Ashar: j.ashar,
    Maghrib: j.maghrib,
    Isya: j.isya,
    lokasi: data?.data?.lokasi || "",
    daerah: data?.data?.daerah || "",
    tanggal: j.tanggal,
  };
}

module.exports = {
  name: "adzan",
  description: "Cek waktu adzan untuk kota tertentu",
  async execute(sock, m, args) {
    const from = m.key.remoteJid;

    if (args.length < 2) {
      return sock.sendMessage(from, {
        text: "⚠️ Gunakan: .adzan <sholat> <kota>\nContoh: .adzan subuh makassar",
      });
    }

    const prayer = normalizePrayer(args[0]);
    const cityQuery = args.slice(1).join(" ");
    if (!prayer) {
      return sock.sendMessage(from, { text: "❌ Jenis sholat tidak dikenal. Gunakan: subuh/dzuhur/ashar/maghrib/isya" });
    }

    try {
      const cityId = await findCityId(cityQuery);
      if (!cityId) {
        return sock.sendMessage(from, { text: `❌ Kota "${cityQuery}" tidak ditemukan.` });
      }

      const t = await getTimes(cityId);
      if (!t) {
        return sock.sendMessage(from, { text: "❌ Gagal mengambil jadwal sholat." });
      }

      const time = t[prayer];
      const islamicBar = "﴾ ••• ﷽ ••• ﴿";
      const msg =
`🕌 *Jadwal Adzan ${prayer}*
📍 ${t.lokasi}${t.daerah ? `, ${t.daerah}` : ""}
🗓️ ${t.tanggal}
🕰️ Jam: *${time}*

───────────────
🕌 Ingin cek jadwal lain?
☾ Ketik: .adzan <sholat> <kota>
───────────────`;

      await sock.sendMessage(from, { text: msg });

      // Kirim VN adzan opsional (biar konsisten dengan auto mode)
      const vnPath = (prayer === "Subuh") ? ADZAN_SUBUH : ADZAN_COMMON;
      if (fs.existsSync(vnPath)) {
        await sock.sendMessage(from, {
          audio: { url: vnPath },
          mimetype: "audio/mp4",
          ptt: true,
        });
      }
    } catch (e) {
      await sock.sendMessage(from, { text: "❌ Gagal ambil jadwal sholat." });
    }
  },
};
