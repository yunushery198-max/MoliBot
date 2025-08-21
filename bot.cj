const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const fs = require("fs");
const pino = require("pino");
require("dotenv").config();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: true,
        auth: state,
        version,
    });

    sock.ev.on("creds.update", saveCreds);

    // 🔥 Load semua commands otomatis dari folder ./commands
    const commands = {};
    const files = fs.readdirSync("./commands").filter(f => f.endsWith(".cjs"));
    for (let file of files) {
        const cmd = require(`./commands/${file}`);
        if (cmd.name) {
            commands[cmd.name] = cmd;
        }
    }

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const text = m.message.conversation || m.message.extendedTextMessage?.text || "";

        if (!text) return;

        console.log("📩 Pesan masuk:", text);

        // cek prefix
        if (text.startsWith("!")) {
            const args = text.slice(1).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();

            if (commands[cmdName]) {
                try {
                    await commands[cmdName].execute(sock, m,
