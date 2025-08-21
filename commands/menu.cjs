module.exports = {
  name: "menu",
  description: "Tampilkan daftar command yang tersedia",
  async execute(sock, msg, args, commands) {
    const from = msg.key.remoteJid;

    let text = "📜 *Daftar Command Bot:*\n\n";
    for (const [name, cmd] of commands.entries()) {
      text += `.${name} — ${cmd.description || "tanpa deskripsi"}\n`;
    }

    await sock.sendMessage(from, { text });
  }
};
