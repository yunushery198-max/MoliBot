// moli-bot/commands/addfile.cjs
const fs = require("fs");
const path = require("path");

module.exports = {
  name: "addfile",
  description: "Tambah file command baru via WhatsApp",
  async execute(sock, m, args, _commands, loadCommands) {
    const from = m.key.remoteJid;

    if (args.length < 2) {
      await sock.sendMessage(from, {
        text: "⚠️ Format salah.\nGunakan:\n.addfile nama-file -> kode\n.addfile -r nama-file -> kode (langsung rehash)",
        quoted: m
      });
      return;
    }

    try {
      const fullText = args.join(" ");
      const isAutoRehash = fullText.startsWith("-r ");

      const cleanText = isAutoRehash ? fullText.slice(3) : fullText;
      const [fileNamePart, codePart] = cleanText.split("->");

      if (!fileNamePart || !codePart) {
        await sock.sendMessage(from, {
          text: "⚠️ Harus ada pemisah `->`\nContoh: `.addfile test.cjs -> module.exports = {...}`",
          quoted: m
        });
        return;
      }

      const fileName = fileNamePart.trim();
      const code = codePart.trim();

      if (!fileName.endsWith(".cjs")) {
        await sock.sendMessage(from, {
          text: "⚠️ Nama file harus diakhiri `.cjs`",
          quoted: m
        });
        return;
      }

      const filePath = path.join(__dirname, fileName);
      fs.writeFileSync(filePath, code, "utf8");

      if (isAutoRehash) {
        loadCommands(); // langsung reload
        await sock.sendMessage(from, {
          text: `✅ File *${fileName}* ditambahkan & command di-rehash.\nSekarang langsung aktif.`,
          quoted: m
        });
        return;
      }

      await sock.sendMessage(from, {
        text: `✅ File *${fileName}* berhasil ditambahkan.\nJalankan \`.rehash\` untuk memuat ulang.`,
        quoted: m
      });
    } catch (err) {
      await sock.sendMessage(from, {
        text: `❌ Gagal menambahkan file.\nError: ${err.message}`,
        quoted: m
      });
    }
  }
};
