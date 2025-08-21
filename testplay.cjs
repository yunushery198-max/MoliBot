const yts = require("yt-search");
// const ytdl = require("ytdl-core");
const ytdl = require("@distube/ytdl-core"); // <-- pakai ini
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");

(async () => {
  const query = "ungu luka disini"; // ganti sesuai mau test
  console.log("🔎 Cari:", query);

  // cari video
  const result = await yts(query);
  if (!result.videos.length) return console.log("❌ Tidak ketemu");
  const song = result.videos[0];
  console.log("🎶 Ambil dari:", song.url);
  console.log("📀 Judul:", song.title);

  // download audio
  if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp");
  const output = `./tmp/${Date.now()}.mp3`;

  await new Promise((resolve, reject) => {
    ffmpeg(ytdl(song.url, { filter: "audioonly", quality: "highestaudio" }))
      .audioBitrate(128)
      .save(output)
      .on("end", resolve)
      .on("error", reject);
  });

  console.log("✅ Selesai ->", output);

  // cek ukuran file
  const size = fs.statSync(output).size / 1024 / 1024;
  console.log("📦 Size:", size.toFixed(2), "MB");
})();
