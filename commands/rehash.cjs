// moli-bot/commands/rehash.cjs
const fs = require("fs");
const path = require("path");

module.exports = {
  name: "rehash",
  description: "Reload semua command tanpa restart bot",
  async execute(sock, m, args, commands) {
    const commandsPath = path.join(__dirname);
    let success = [];
    let failed = [];

    for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith(".cjs"))) {
      const filePath = path.join(commandsPath, file);
      try {
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);
        if (command?.name && command?.execute) {
          commands.set(command.name, command); // ✅ langsung pakai commands Map
          success.push(file);
        } else {
          failed.push(`${file}: tidak valid (missing name/execute)`);
        }
      } catch (err) {
        failed.push(`${file}: ${err.message}`);
      }
    }

    let report = `♻️ Semua command berhasil direload.\n\n✅ Berhasil: ${success.length}\n❌ Gagal: ${failed.length}`;
    if (failed.length > 0) {
      report += `\n\nDetail error:\n- ${failed.join("\n- ")}`;
    }

    await sock.sendMessage(m.key.remoteJid, { text: report }, { quoted: m });
  }
};
