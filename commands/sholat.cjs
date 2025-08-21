// Auto jadwal adzan (default ON) + admin toggle
// Ketergantungan: axios, file VN: assets/adzan/adzan.mp3 & assets/adzan/adzan_subuh.mp3

const path = require("path");
const fs = require("fs");
const axios = require("axios");

const ASSETS_DIR = path.join(__dirname, "..", "assets", "adzan");
const ADZAN_COMMON = path.join(ASSETS_DIR, "adzan.mp3");
const ADZAN_SUBUH = path.join(ASSETS_DIR, "adzan_subuh.mp3");

// Cek file VN tersedia
function ensureAssets() {
  if (!fs.existsSync(ADZAN_COMMON) || !fs.existsSync(ADZAN_SUBUH)) {
    console.warn("⚠️ File adzan tidak lengkap:", { ADZAN_COMMON, ADZAN_SUBUH });
  }
}

// Peta nama sholat standar
const PRAYERS = ["Subuh", "Dzuhur", "Ashar", "Maghrib", "Isya"];

// Cache id kota utk WIB/WITA
let CITY_IDS = {
  WIB: null,   // Jakarta
  WITA: null,  // Makassar
};

// Grup aktif (default ON)
const sholatEnabled = new Set(); // berisi groupJid
// Penanda supaya tidak mengirim dobel di hari yang sama
let firedToday = { WIB: new Set(), WITA: new Set() };
// Jadwal hari ini per zona
let todayTimes = { WIB: null, WITA: null };
// Tanggal cache (reset tengah malam)
let currentDateKey = "";

// Util tanggal
function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function ymddForMyQuran(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return { y, m, d: day };
}

// Ambil ID kota dari MyQuran (pakai pencarian)
async function getCityIdByName(name) {
  const url = `https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(name)}`;
  const { data } = await axios.get(url, { timeout: 15000 });
  if (data && data.data && data.data.length) {
    // pilih match terbaik (paling mirip)
    const q = name.toLowerCase();
    let best = data.data[0];
    for (const item of data.data) {
      if (item.lokasi?.toLowerCase() === q || item.lokasi?.toLowerCase().includes(q)) {
        best = item;
        break;
      }
    }
    return best.id;
  }
  return null;
}

// Ambil jadwal harian utk id kota
async function getPrayerTimesForCityId(cityId, d = new Date()) {
  const { y, m, d: dd } = ymddForMyQuran(d);
  const url = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${y}/${m}/${dd}`;
  const { data } = await axios.get(url, { timeout: 15000 });
  const jadwal = data?.data?.jadwal;
  if (!jadwal) return null;
  return {
    Subuh: jadwal.subuh,
    Dzuhur: jadwal.dzuhur,
    Ashar: jadwal.ashar,
    Maghrib: jadwal.maghrib,
    Isya: jadwal.isya,
  };
}

// Parse HH:MM lokal ke Date object (dengan tanggal yg sama)
function timeToDate(baseDate, hhmm, tzOffsetMinutes) {
  const [hh, mm] = hhmm.split(":").map(Number);
  const d = new Date(baseDate);
  // set ke 00:00 dulu
  d.setHours(0, 0, 0, 0);
  d.setMinutes(d.getMinutes() + tzOffsetMinutes); // shift ke zona lokal
  d.setHours(hh, mm, 0, 0);
  return d;
}

// Zona WIB = UTC+7 (420 menit), WITA = UTC+8 (480 menit)
const ZONES = {
  WIB: { label: "WIB", offset: 7 * 60, cityName: "jakarta" },
  WITA: { label: "WITA", offset: 8 * 60, cityName: "makassar" },
};

// Compose pesan + VN
async function sendAzan(sock, groupId, zoneLabel, prayer) {
  const isSubuh = prayer === "Subuh";
  const vnPath = isSubuh ? ADZAN_SUBUH : ADZAN_COMMON;
  const islamicBar = "﴾ ••• ﷽ ••• ﴿";
  const footer =
`───────────────
🕌 Ingin cek jadwal kotamu?
☾ Ketik: .adzan ${prayer.toLowerCase()} <kota>
───────────────`;

  const text =
`🕌 *Waktu Adzan ${prayer} telah tiba* (${zoneLabel})
"${prayer === "Subuh" ? "Sholat lebih baik daripada tidur." : "Ingatlah, sholat itu tiang agama."}"

${footer}`;

  // kirim teks dulu biar cepat tampil
  await sock.sendMessage(groupId, { text });

  // lalu kirim VN kalau file ada
  if (fs.existsSync(vnPath)) {
    await sock.sendMessage(groupId, {
      audio: { url: vnPath },
      mimetype: "audio/mp4",
      ptt: true,
    });
  } else {
    console.warn("⚠️ File VN adzan tidak ditemukan:", vnPath);
  }
}

// Cek semua jadwal dan kirim jika pas waktunya
async function tickAndSend(sock) {
  try {
    const nowUtc = new Date();
    const todayKey = dateKey(nowUtc);

    // reset harian
    if (todayKey !== currentDateKey) {
      currentDateKey = todayKey;
      firedToday = { WIB: new Set(), WITA: new Set() };
      todayTimes = { WIB: null, WITA: null };
      // refresh jadwal harian
      await refreshTodayTimes();
    }

    // pastikan jadwal sudah ada
    if (!todayTimes.WIB || !todayTimes.WITA) return;

    // Ambil grup aktif; kalau belum ada, isi semua grup (default ON)
    if (sholatEnabled.size === 0) {
      const all = await sock.groupFetchAllParticipating().catch(() => ({}));
      Object.keys(all).forEach((jid) => sholatEnabled.add(jid));
    }

    // Cek masing-masing zona
    for (const zoneKey of ["WIB", "WITA"]) {
      const zone = ZONES[zoneKey];
      const tz = zone.offset;
      const nowLocal = new Date(nowUtc.getTime() + tz * 60 * 1000);
      const todayLocalKey = dateKey(nowLocal);

      // Untuk masing-masing prayer
      for (const p of PRAYERS) {
        const hhmm = todayTimes[zoneKey][p];
        if (!hhmm) continue;

        const tLocal = timeToDate(nowLocal, hhmm, 0); // nowLocal sudah di zona lokal
        const diff = Math.abs(nowLocal - tLocal);

        // anggap "tepat waktu" jika selisih <= 30 detik
        if (nowLocal >= tLocal && diff <= 30 * 1000) {
          const firedKey = `${todayLocalKey}-${p}`;
          if (!firedToday[zoneKey].has(firedKey)) {
            firedToday[zoneKey].add(firedKey);

            // kirim ke semua grup yang aktif
            for (const g of sholatEnabled) {
              await sendAzan(sock, g, zone.label, p).catch(() => {});
            }
          }
        }
      }
    }
  } catch (e) {
    // jangan spam log
  }
}

// Refresh jadwal hari ini utk WIB (Jakarta) & WITA (Makassar)
async function refreshTodayTimes() {
  try {
    if (!CITY_IDS.WIB) CITY_IDS.WIB = await getCityIdByName(ZONES.WIB.cityName);
    if (!CITY_IDS.WITA) CITY_IDS.WITA = await getCityIdByName(ZONES.WITA.cityName);

    // fallback id kota jika pencarian gagal
    // (angka di bawah hanya contoh; API biasanya mengembalikan id valid via pencarian)
    if (!CITY_IDS.WIB) CITY_IDS.WIB = 1301;   // Jakarta (fallback kasar)
    if (!CITY_IDS.WITA) CITY_IDS.WITA = 726;  // Makassar (fallback kasar)

    const [wib, wita] = await Promise.all([
      getPrayerTimesForCityId(CITY_IDS.WIB),
      getPrayerTimesForCityId(CITY_IDS.WITA),
    ]);

    todayTimes.WIB = wib;
    todayTimes.WITA = wita;
  } catch (e) {
    // diamkan; tick berikutnya akan coba lagi
  }
}

module.exports = {
  name: "sholat",
  description: "Auto post jadwal sholat ke grup (default ON) + admin toggle",
  // init() akan dipanggil oleh loader kamu (bot.cjs) saat startup jika tersedia
  async init(sock) {
    ensureAssets();
    currentDateKey = dateKey(new Date());

    // Default: aktifkan semua grup yang bot ikuti
    try {
      const all = await sock.groupFetchAllParticipating().catch(() => ({}));
      Object.keys(all).forEach((jid) => sholatEnabled.add(jid));
    } catch {}

    // Ambil jadwal pertama kali
    await refreshTodayTimes();

    // Jalanin ticker tiap 15 detik
    setInterval(() => tickAndSend(sock), 15 * 1000);

    console.log("⚡ Sholat auto-scheduler aktif (default ON untuk semua grup).");
  },

  // Admin toggle: .sholat on / .sholat off  (di grup saat ini)
  // Atau: .sholat <groupJid> on|off
  async execute(sock, m, args) {
    const from = m.key.remoteJid;

    // Biar aman, hanya respon di grup
    if (!from.endsWith("@g.us")) {
      return sock.sendMessage(from, { text: "Perintah ini hanya untuk grup." });
    }

    let target = from;
    let mode = args[0]?.toLowerCase();

    // dukung format: .sholat <groupId> <on|off>
    if (args.length >= 2 && args[1]) {
      if (args[1].toLowerCase() === "on" || args[1].toLowerCase() === "off") {
        target = args[0];
        mode = args[1].toLowerCase();
      }
    }

    if (mode !== "on" && mode !== "off") {
      return sock.sendMessage(from, {
        text: "⚠️ Gunakan:\n.sholat on | .sholat off\natau\n.sholat <idgrup> <on|off>",
      });
    }

    if (mode === "on") {
      sholatEnabled.add(target);
      return sock.sendMessage(from, { text: `✅ Sholat auto-post *ON* untuk grup: ${target}` });
    } else {
      sholatEnabled.delete(target);
      return sock.sendMessage(from, { text: `🛑 Sholat auto-post *OFF* untuk grup: ${target}` });
    }
  },
};
