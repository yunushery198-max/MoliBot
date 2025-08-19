// ====== BOT MOLI KOMPLIT ======
// by: ChatGPT + Hery

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const ytdl = require("ytdl-core");
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");

// ====== VARIABEL ======
const ADMINS = new Set(["62816267763@s.whatsapp.net"]); // admin default
let blockedUsers = new Set();
let spamCooldown = new Map();
let voiceQueue = [];
let musicQueue = [];
let promoGroups = {};
let sholatGroups = new Set();
let safetyGroups = new Set();

const SAFETY_QUOTES = [
"👷‍♂️ Utamakan keselamatan daripada kecepatan kerja.",
"⚠️ Helm bukan sekedar atribut, tapi penyelamat nyawa.",
"🔧 Bekerja aman, pulang selamat.",
"🚧 Jangan abaikan tanda peringatan di area kerja.",
"🦺 APD-mu adalah sahabatmu di tambang.",
"🏗️ Ingat! Keluarga menunggu di rumah, jaga keselamatanmu.",
"💡 Kecelakaan kecil bisa berdampak besar, waspada selalu.",
"🛠️ Mesin bisa diperbaiki, nyawa tidak.",
"📢 Jangan bekerja sendiri di area berisiko tinggi.",
"⛑️ Setiap pekerja adalah penanggung jawab keselamatan bersama."
];
let safetyDayIndex = 0;

// ====== HELPERS ======
const randomPick = arr => arr[Math.floor(Math.random() * arr.length)];
const wait = ms => new Promise(res => setTimeout(res, ms));

function filterBadWords(text) {
const badWords = ["kontol","memek","ngentot","anjing","bangsat"];
return badWords.some(w => text.toLowerCase().includes(w));
}

// auto hapus file 10 menit
function autoDelete(filePath) {
setTimeout(() => {
if (fs.existsSync(filePath)) {
fs.unlinkSync(filePath);
console.log("🗑️ File dihapus:", filePath);
}
}, 10 * 60 * 1000);
}

// ====== JADWAL SHOLAT ======
function startSholatReminder(sock) {
setInterval(() => {
const now = new Date();
const jam = now.getHours();
const menit = now.getMinutes();

const jadwalWIB = {4:"Subuh",12:"Dzuhur",15:"Ashar",18:"Maghrib",19:"Isya"};
const jadwalWITA = {5:"Subuh",13:"Dzuhur",16:"Ashar",19:"Maghrib",20:"Isya"};

if (menit === 0) {
if (jadwalWIB[jam]) {
sholatGroups.forEach(groupId => {
sock.sendMessage(groupId, { text: `🕌 Sekarang jam ${jam}:00 WIB, waktunya sholat *${jadwalWIB[jam]}*.\n"${randomPick(SAFETY_QUOTES)}"` });
});
}
if (jadwalWITA[jam]) {
sholatGroups.forEach(groupId => {
sock.sendMessage(groupId, { text: `🕌 Sekarang jam ${jam}:00 WITA, waktunya sholat *${jadwalWITA[jam]}*.\n"${randomPick(SAFETY_QUOTES)}"` });
});
}
}
}, 60000);
}

// ====== SAFETY REMINDER ======
function startSafetyReminder(sock) {
setInterval(() => {
const now = new Date();
const jam = now.getHours();
const menit = now.getMinutes();

const targetJam = [8, 13, 19];

if (targetJam.includes(jam) && menit === 0) {
const startIndex = (safetyDayIndex * 3) % SAFETY_QUOTES.length;
const pesanHari = [
SAFETY_QUOTES[startIndex % SAFETY_QUOTES.length],
SAFETY_QUOTES[(startIndex + 1) % SAFETY_QUOTES.length],
SAFETY_QUOTES[(startIndex + 2) % SAFETY_QUOTES.length]
];

let pesan;
if (jam === 8) pesan = `🌅 *Pesan Keselamatan Pagi*\n${pesanHari[0]}`;
if (jam === 13) pesan = `☀️ *Pesan Keselamatan Siang*\n${pesanHari[1]}`;
if (jam === 19) {
pesan = `🌙 *Pesan Keselamatan Malam*\n${pesanHari[2]}`;
safetyDayIndex++;
}

safetyGroups.forEach(groupId => {
sock.sendMessage(groupId, { text: pesan });
});
}
}, 60000);
}

// ====== MAIN BOT ======
async function startBot() {
const { state, saveCreds } = await useMultiFileAuthState("session");
const sock = makeWASocket({ auth: state, printQRInTerminal: true });

sock.ev.on("creds.update", saveCreds);
sock.ev.on("connection.update", ({ connection }) => {
if (connection === "open") console.log("✅ Bot berhasil login ke WhatsApp!");
});

// Listener pesan
sock.ev.on("messages.upsert", async ({ messages }) => {
const m = messages[0];
if (!m.message || m.key.fromMe) return;

const from = m.key.remoteJid;
const sender = m.key.participant || m.key.remoteJid;
const isGroup = from.endsWith("@g.us");
const text = m.message.conversation || m.message.extendedTextMessage?.text || "";

// Anti spam 10 detik
if (spamCooldown.has(sender) && Date.now() < spamCooldown.get(sender)) {
sock.sendMessage(sender, { text: randomPick([
"⚠️ Kamu terlalu sering kirim perintah.",
"⏳ Sabar ya, tunggu 10 detik dulu.",
"🚫 Jangan spam bot, tunggu giliran."
]) });
return;
}
spamCooldown.set(sender, Date.now() + 10000);

// Blok user
if (blockedUsers.has(sender)) return;

// ========== FILTER KATA KOTOR ==========
if (filterBadWords(text)) {
sock.sendMessage(from, { text: `❌ Maaf @${sender.split("@")[0]}, permintaanmu ditolak karena mengandung kata tidak pantas.`, mentions:[sender] }, { quoted: m });
return;
}

// ========== PERINTAH ==========
if (text.toLowerCase().includes("moli menu")) {
const menu = `
📌 *Daftar Perintah WaBot-Kamu*:
- moli [tanya AI]
- suara / nyanyi [buat suara/nyanyi AI]
- !play [judul lagu ≤5 menit]
- !addadmin [nomor]
- !blok [nomor]
- !unblok [nomor]
- !panggil [@user]
- !addpromo / !delpromo / !listpromo
- !listgrup
- !sholat on|off [id grup]
- !savety on|off [id grup]
- !hapusfile
`;
sock.sendMessage(from, { text: menu }, { quoted: m });
}

// contoh !play
if (text.startsWith("!play")) {
const query = text.replace("!play", "").trim();
if (!query) return sock.sendMessage(from, { text: "❌ Masukkan judul lagu." }, { quoted: m });

try {
const info = await ytdl.getInfo(`ytsearch:${query}`);
const video = info.videoDetails;
const durasi = parseInt(video.lengthSeconds);

if (durasi > 300) {
return sock.sendMessage(from, { text: randomPick([
"🚫 Lagu terlalu panjang, maksimal 5 menit.",
"❌ Maaf, hanya bisa memutar lagu singkat (≤5 menit)."
]) }, { quoted: m });
}

const filePath = path.join(__dirname, "music.ogg");
ytdl(video.video_url, { filter: "audioonly", quality: "lowestaudio" })
.pipe(fs.createWriteStream(filePath))
.on("finish", async () => {
await sock.sendMessage(from, { audio: { url: filePath }, mimetype: "audio/ogg", ptt: true }, { quoted: m });
autoDelete(filePath);
});

} catch (err) {
console.error(err);
sock.sendMessage(from, { text: "❌ Gagal memutar lagu." }, { quoted: m });
}
}

// !blok
if (text.startsWith("!blok") && ADMINS.has(sender)) {
const num = text.split(" ")[1];
if (num) {
blockedUsers.add(num.replace(/[^0-9]/g, "") + "@s.whatsapp.net");
sock.sendMessage(from, { text: `🚫 User ${num} diblokir.` }, { quoted: m });
}
}

// !unblok
if (text.startsWith("!unblok") && ADMINS.has(sender)) {
const num = text.split(" ")[1];
if (num) {
blockedUsers.delete(num.replace(/[^0-9]/g, "") + "@s.whatsapp.net");
sock.sendMessage(from, { text: `✅ User ${num} dibuka blokir.` }, { quoted: m });
}
}

// !sholat on/off
if (text.startsWith("!sholat")) {
const [cmd, mode, gid] = text.split(" ");
if (mode === "on") {
sholatGroups.add(gid);
sock.sendMessage(from, { text: `🕌 Reminder Sholat aktif di grup ${gid}` }, { quoted: m });
} else if (mode === "off") {
sholatGroups.delete(gid);
sock.sendMessage(from, { text: `🕌 Reminder Sholat dimatikan di grup ${gid}` }, { quoted: m });
}
}

// !savety on/off
if (text.startsWith("!savety")) {
const [cmd, mode, gid] = text.split(" ");
if (mode === "on") {
safetyGroups.add(gid);
sock.sendMessage(from, { text: `👷 Safety Reminder aktif di grup ${gid}` }, { quoted: m });
} else if (mode === "off") {
safetyGroups.delete(gid);
sock.sendMessage(from, { text: `👷 Safety Reminder dimatikan di grup ${gid}` }, { quoted: m });
}
}

// !hapusfile
if (text === "!hapusfile") {
fs.readdirSync(__dirname).forEach(file => {
if (file.endsWith(".mp3") || file.endsWith(".ogg")) {
fs.unlinkSync(path.join(__dirname, file));
sock.sendMessage(from, { text: `🗑️ File ${file} dihapus.` }, { quoted: m });
}
});
}

});

// start auto reminder
startSholatReminder(sock);
startSafetyReminder(sock);
}

startBot();
