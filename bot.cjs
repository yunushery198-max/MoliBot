// ================== IMPORT & SETUP ==================
require("dotenv").config()
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")

const fs = require("fs")
const P = require("pino")
const ytdl = require("ytdl-core")
const yts = require("yt-search")
const axios = require("axios")
const cron = require("node-cron")

// =============== GLOBAL STATE ===============
let queue = new Map()        // antrian user
let cooldowns = new Map()    // cooldown user
let promos = []              // daftar promo
let sholatGroups = new Set() // grup yang aktif jadwal sholat
let safetyGroups = new Set() // grup yang aktif safety message
let admins = new Set()       // admin list

// Kata kotor untuk filter
const bannedWords = ["mesum", "bokep", "kontol", "anjing", "ngentot", "jancok"]

// Kata random untuk respon
const randomResponses = [
    "🙏 Mohon gunakan kata-kata yang baik.",
    "⚠️ Permintaan tidak pantas, ditolak.",
    "🤖 Aku tidak bisa memproses itu.",
    "🚫 Tolong jangan gunakan kata kotor."
]

// Kata-kata bijak random
const bijakList = [
    "Kesabaran adalah kunci kesuksesan.",
    "Jangan menyerah meski jalannya sulit.",
    "Syukur adalah kekayaan sejati.",
    "Setiap langkah kecil membawa kita lebih dekat ke tujuan."
]

// Safety message (berbeda setiap kali)
const safetyMessages = [
    "⚠️ Utamakan keselamatan kerja, keluarga menunggu di rumah.",
    "👷‍♂️ Jangan lupa gunakan APD sebelum bekerja.",
    "🚧 Keselamatan adalah tanggung jawab kita bersama.",
    "🔥 Waspada bahaya kebakaran, tetap patuhi SOP.",
    "💡 Istirahat cukup agar tetap fokus bekerja."
]

// ================== ANTI SPAM / COOLDOWN ==================
function isOnCooldown(user) {
    const now = Date.now()
    if (cooldowns.has(user)) {
        const expire = cooldowns.get(user)
        if (now < expire) return true
        cooldowns.delete(user)
    }
    return false
}

function setCooldown(user, seconds = 10) {
    cooldowns.set(user, Date.now() + seconds * 1000)
}

// ================== QUEUE HANDLER ==================
function addToQueue(user, task) {
    queue.set(user, task)
}

function clearQueue(user) {
    queue.delete(user)
}

// ================== PROMO HANDLER ==================
function addPromo(idGrup, text, gambar, voice, interval) {
    promos.push({ idGrup, text, gambar, voice, interval, lastSent: 0 })
}

function removePromo(idGrup) {
    promos = promos.filter(p => p.idGrup !== idGrup)
}

function listPromo() {
    return promos.map((p, i) => `${i + 1}. Grup: ${p.idGrup}, Interval: ${p.interval} menit, Text: ${p.text}`).join("\n")
}

// ================== BOT MAIN ==================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth")
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        printQRInTerminal: true,
        auth: state,
        logger: P({ level: "silent" })
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update
        if (connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                startBot()
            }
        } else if (connection === "open") {
            console.log("✅ Bot berhasil login ke WhatsApp!")
        }
    })

    // ================== PESAN MASUK ==================
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if (!m.message) return
        const from = m.key.remoteJid
        const sender = m.key.participant || m.key.remoteJid
        const text = m.message.conversation || m.message.extendedTextMessage?.text
        if (!text) return

        // 🔒 Anti spam cooldown
        if (isOnCooldown(sender)) return
        setCooldown(sender, 10)

        // 🔞 Filter kata kotor
        if (bannedWords.some(w => text.toLowerCase().includes(w))) {
            await sock.sendMessage(from, { text: randomResponses[Math.floor(Math.random() * randomResponses.length)] }, { quoted: m })
            return
        }

        // ========== PERINTAH ==========
        const cmd = text.trim().toLowerCase()

        if (cmd === "!menu") {
            await sock.sendMessage(from, { text: `
📌 *Menu Perintah Bot* 📌

🎵 Musik: 
!play <judul/link>

🕌 Sholat:
!sholat on <idgrup>
!sholat off <idgrup>

⚠️ Safety:
!savety on <idgrup>
!savety off <idgrup>

📢 Promo:
!addpromo <text> <idgrup> <interval>
!delpromo <idgrup>
!listpromo

👥 Grup:
!listgrup
!panggil @user

🛠️ Admin:
!addadmin @user
!block <nomor>
!unblock <nomor>

🧹 Request:
!clean
            ` }, { quoted: m })
        }

        // 🎵 !play lagu
        else if (cmd.startsWith("!play")) {
            let query = text.split(" ").slice(1).join(" ")
            if (!query) return sock.sendMessage(from, { text: "❌ Masukkan judul atau link YouTube." }, { quoted: m })

            // cari di youtube
            const search = await yts(query)
            const video = search.videos[0]
            if (!video) return sock.sendMessage(from, { text: "❌ Lagu tidak ditemukan." }, { quoted: m })

            if (video.seconds > 300) {
                await sock.sendMessage(from, { text: "⏳ Lagu terlalu panjang. Cari lagu lain ya." }, { quoted: m })
                return
            }

            const stream = ytdl(video.url, { filter: "audioonly", quality: "lowestaudio" })
            const chunks = []
            stream.on("data", chunk => chunks.push(chunk))
            stream.on("end", async () => {
                const buffer = Buffer.concat(chunks)
                await sock.sendMessage(from, {
                    audio: buffer,
                    mimetype: "audio/ogg; codecs=opus",
                    ptt: true
                }, { quoted: m })
                clearQueue(sender)
            })
        }

        // 🕌 Jadwal sholat
        else if (cmd.startsWith("!sholat on")) {
            sholatGroups.add(from)
            await sock.sendMessage(from, { text: "🕌 Jadwal sholat diaktifkan untuk grup ini." }, { quoted: m })
        } else if (cmd.startsWith("!sholat off")) {
            sholatGroups.delete(from)
            await sock.sendMessage(from, { text: "🕌 Jadwal sholat dimatikan untuk grup ini." }, { quoted: m })
        }

        // ⚠️ Safety
        else if (cmd.startsWith("!savety on")) {
            safetyGroups.add(from)
            await sock.sendMessage(from, { text: "⚠️ Safety message aktif di grup ini." }, { quoted: m })
        } else if (cmd.startsWith("!savety off")) {
            safetyGroups.delete(from)
            await sock.sendMessage(from, { text: "⚠️ Safety message dimatikan di grup ini." }, { quoted: m })
        }

        // 📢 Promo
        else if (cmd.startsWith("!addpromo")) {
            let args = text.split(" ").slice(1)
            let idGrup = args[0]
            let interval = parseInt(args[1]) || 30
            let promoText = args.slice(2).join(" ")
            addPromo(idGrup, promoText, null, null, interval)
            await sock.sendMessage(from, { text: `✅ Promo ditambahkan ke grup ${idGrup}` }, { quoted: m })
        } else if (cmd.startsWith("!delpromo")) {
            let idGrup = text.split(" ")[1]
            removePromo(idGrup)
            await sock.sendMessage(from, { text: `🗑️ Promo dihapus untuk grup ${idGrup}` }, { quoted: m })
        } else if (cmd.startsWith("!listpromo")) {
            await sock.sendMessage(from, { text: listPromo() || "Belum ada promo aktif." }, { quoted: m })
        }

        // 🧹 Clean request
        else if (cmd === "!clean") {
            clearQueue(sender)
            await sock.sendMessage(from, { text: "🧹 Antrian kamu sudah dibersihkan." }, { quoted: m })
        }
    })

    // ============= CRON SHOLAT & SAFETY =============
    cron.schedule("0 12 * * *", async () => {
        for (let g of sholatGroups) {
            await sock.sendMessage(g, { text: `🕌 Sekarang waktu Dzuhur. ${bijakList[Math.floor(Math.random() * bijakList.length)]}` })
        }
    })

    cron.schedule("0 8,12,20 * * *", async () => {
        for (let g of safetyGroups) {
            await sock.sendMessage(g, { text: safetyMessages[Math.floor(Math.random() * safetyMessages.length)] })
        }
    })
}

startBot()
