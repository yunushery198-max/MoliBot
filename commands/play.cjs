const yts = require("yt-search");
const ytdl = require("@distube/ytdl-core");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");

let isBusy = false; // lock biar anti-spam
let fileQueue = []; // antrian file untuk auto delete

// fungsi auto hapus file lama
function autoDelete(file) {
  fileQueue.push(file);
  setTimeout(() => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        console.log("🗑️ File dihapus:", file);
      } catch (e) {
        console.error("❌ Gagal hapus file:", e);
      }
    }
    fileQueue = fileQueue.filter(f => f !== file);
  }, 15 * 60 * 1000); // 15 menit
}

module.exports = {
  name: "play",
  description: "Putar lagu dari YouTube",
  async execute(sock, m, args) {
    const from = m.key.remoteJid;
    const query = args.join(" ");

    // jika tidak ada query
    if (!query) {
      return sock.sendMessage(from, { text: "⚠️ Masukkan judul lagu!" }, { quoted: m });
    }

    // jika ada kata terlarang
    const bannedWords = ["album", "mesum", "kontol", "memek", "anjing"];
    if (bannedWords.some(w => query.toLowerCase().includes(w))) {
      return sock.sendMessage(from, { text: "❌ Kata terlarang terdeteksi!" }, { quoted: m });
    }

    // jika bot masih sibuk download
    if (isBusy) {
      const responses = [
        "⏳ Lagi proses, tunggu bentar ya...",
        "😅 Sabar, lagu sebelumnya belum selesai.",
        "🎶 Tunggu dulu, musik sedang diputar."
      ];
      const random = responses[Math.floor(Math.random() * responses.length)];
      return sock.sendMessage(from, { text: random }, { quoted: m });
    }

    isBusy = true;
    await sock.sendMessage(from, { text: `🔎 Mencari lagu *${query}*...` }, { quoted: m });

    try {
      // cari lagu di youtube
      const search = await yts(query);
      if (!search.videos.length) {
        isBusy = false;
        return sock.sendMessage(from, { text: "❌ Lagu tidak ditemukan." }, { quoted: m });
      }

      const song = search.videos[0];
      const url = song.url;
      console.log("🎶 Ambil dari:", url);

      const output = `./tmp/${Date.now()}.mp3`;
      if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp");

      await new Promise((resolve, reject) => {
        const stream = ytdl(url, { filter: "audioonly", quality: "highestaudio" });

        ffmpeg(stream)
          .audioBitrate(128)
          .save(output)
          .on("end", resolve)
          .on("error", reject);
      });

      const stats = fs.statSync(output);
      const fileSizeMB = stats.size / (1024 * 1024);

      if (fileSizeMB > 15) {
        fs.unlinkSync(output);
        isBusy = false;
        return sock.sendMessage(from, { text: "⚠️ Lagu terlalu besar (>15MB)." }, { quoted: m });
      }

      // kirim sebagai VN
      await sock.sendMessage(from, {
        audio: { url: output },
        mimetype: "audio/mp4",
        ptt: true
      }, { quoted: m });

      autoDelete(output); // masukin ke antrian auto hapus

    } catch (e) {
      console.error("❌ play error:", e);
      await sock.sendMessage(from, { text: "⚠️ Gagal memutar lagu." }, { quoted: m });
    }

    isBusy = false;
  }
};
