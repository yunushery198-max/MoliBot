const axios = require("axios");

module.exports = {
  name: "ai",
  description: "Tanya ke AI (Moli)",
  async execute(sock, m, args) {
    const from = m.key.remoteJid;
    const prompt = args.join(" ");
    if (!prompt) {
      return sock.sendMessage(from, { text: "⚠️ Gunakan: .ai <pertanyaan>" }, { quoted: m });
    }

    try {
      const res = await axios.post("https://api.openai.com/v1/chat/completions", {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      }, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        }
      });

      const reply = res.data.choices?.[0]?.message?.content || "⚠️ AI tidak merespon.";
      await sock.sendMessage(from, { text: `🤖 ${reply}` }, { quoted: m });
    } catch (e) {
      console.error("AI Error:", e.response?.data || e.message);
      await sock.sendMessage(from, { text: "❌ Gagal konek ke AI. Cek API key & internet." }, { quoted: m });
    }
  }
};
