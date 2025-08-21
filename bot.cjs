require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  default: makeWASocket,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");

const commands = new Map();

// 🔄 Loader command
function loadCommands() {
  commands.clear();
  const cmdFiles = fs.readdirSync(path.join(__dirname, "commands")).filter(f => f.endsWith(".cjs"));

  for (const file of cmdFiles) {
    try {
      delete require.cache[require.resolve(`./commands/${file}`)];
      const cmd = require(`./commands/${file}`);
      if (cmd?.name && typeof cmd.execute === "function") {
        commands.set(cmd.name, cmd);
        console.log(`✅ Loaded command: ${cmd.name}`);
      }
    } catch (err) {
      console.error(`❌ Failed to load ${file}:`, err.message);
    }
  }
  return commands;
}

// 🔌 Start bot
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  loadCommands();

  sock.ev.on("creds.update", saveCreds);

  // 📩 Handler pesan masuk (debug mode)
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    console.log("📨 Event masuk:", type, messages.length);

    const m = messages[0];
    if (!m) return;

    console.log("📝 Pesan mentah:", JSON.stringify(m, null, 2));

    if (!m.message || !m.key.remoteJid) return;

    const text =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      m.message.videoMessage?.caption ||
      "";

    console.log("📩 Teks terdeteksi:", text);

    if (!text.startsWith(".")) return;

    const args = text.slice(1).trim().split(" ");
    const cmdName = args.shift().toLowerCase();

    console.log("📢 Diterima command:", cmdName, "args:", args);

    const command = commands.get(cmdName);
    if (!command) {
      console.log("⚠️ Command tidak ditemukan:", cmdName);
      return;
    }

    try {
      await command.execute(sock, m, args, commands, loadCommands);
      console.log(`✅ Command ${cmdName} selesai dieksekusi`);
    } catch (err) {
      console.error(`❌ Error in ${cmdName}:`, err);
      await sock.sendMessage(m.key.remoteJid, { text: `❌ Error: ${err.message}` });
    }
  });

  console.log("✅ Connected to WhatsApp");
}

startBot();
