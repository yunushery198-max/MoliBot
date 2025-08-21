// ======================
// MOLI BOT MAIN RUNNER
// ======================
require("dotenv").config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

// === Load utils ===
const { filterBadWords } = require("./utils/filters.cjs");
const { addToQueue, removeFromQueue } = require("./utils/queue.cjs");

// === Auto load semua command ===
const commands = new Map();
const commandsPath = path.join(__dirname, "commands");
fs.readdirSync(commandsPath).forEach(file => {
    if (file.endsWith(".cjs")) {
        const cmd = require(path.join(commandsPath, file));
        if (cmd.name && cmd.execute) {
            commands.set(cmd.name, cmd);
            console.log(`✅ Command loaded: ${cmd.name}`);
        }
    }
});

// === Start Bot ===
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: "silent" })
    });

    // Save session
    sock.ev.on("creds.update", saveCreds);

    // Handle disconnect
    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("connection closed, reconnecting:", shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("✅ Bot berhasil login ke WhatsApp!");
        }
    });

    // Handle pesan masuk
    sock.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const type = Object.keys(msg.message)[0];
            const body =
                (type === "conversation" && msg.message.conversation) ||
                (type === "extendedTextMessage" && msg.message.extendedTextMessage.text) ||
                (type === "imageMessage" && msg.message.imageMessage.caption) ||
                "";

            if (!body) return;
            console.log("📩 Pesan masuk:", body);

            // Filter kata kasar
            if (filterBadWords(body)) {
                await sock.sendMessage(from, { text: "❌ Permintaan ditolak, kata tidak pantas." });
                return;
            }

            // Command handler
            if (body.startsWith("!")) {
                const [commandName, ...args] = body.slice(1).trim().split(" ");
                const command = commands.get(commandName);

                if (command) {
                    try {
                        await command.execute(sock, msg, args);
                    } catch (err) {
                        console.error(`❌ Error di command ${commandName}:`, err);
                        await sock.sendMessage(from, { text: "⚠️ Terjadi error saat menjalankan perintah." });
                    }
                } else {
                    await sock.sendMessage(from, { text: "🤖 Command tidak dikenali." });
                }
            }
        } catch (err) {
            console.error("Error handler messages.upsert:", err);
        }
    });

    // === CRON JOB ===
    // Sholat reminder (contoh: jam 05:00, 12:00, 18:00)
    cron.schedule("0 5,12,18 * * *", async () => {
        await broadcast(sock, "🕌 Waktunya sholat, jangan lupa ibadah ya!");
    });

    // Safety message (pagi, siang, malam)
    cron.schedule("0 08,13,20 * * *", async () => {
        const safetyQuotes = [
            "⚠️ Keselamatan adalah prioritas utama di tambang!",
            "🦺 Jangan lupa pakai APD sebelum mulai kerja.",
            "💡 Ingat, satu kesalahan kecil bisa berakibat fatal."
        ];
        const msg = safetyQuotes[Math.floor(Math.random() * safetyQuotes.length)];
        await broadcast(sock, msg);
    });

    // Promo harian
    cron.schedule("0 9 * * *", async () => {
        await broadcast(sock, "📢 Promo hari ini! Jangan lewatkan kesempatan spesial.");
    });

    async function broadcast(sock, message) {
        const groups = Object.keys(sock.groupMetadata || {});
        for (const id of groups) {
            try {
                await sock.sendMessage(id, { text: message });
            } catch (err) {
                console.log(`Gagal kirim ke ${id}`, err);
            }
        }
    }
}

startBot();
