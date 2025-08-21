const wisdoms = [
  "⛑️ Utamakan keselamatan daripada kecepatan.",
  "👷 Jangan lupa gunakan APD lengkap saat kerja.",
  "⚠️ Kewaspadaan adalah kunci menghindari kecelakaan.",
  "🛑 Istirahat cukup agar tetap fokus.",
  "💡 Patuhi SOP untuk keamanan bersama."
];

function randomWisdom() {
  return wisdoms[Math.floor(Math.random() * wisdoms.length)];
}

module.exports = { randomWisdom };
