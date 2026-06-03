// plugins/yts.js
const { cmd } = require('../command');

cmd({
    pattern: "yts",
    alias: ["ytsearch"],
    desc: "Search YouTube and get video details",
    category: "download",
    react: "🔎",
    filename: __filename,
    use: "<search query>"
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply('*Please provide a search query!*');

        const yts = require("yt-search");
        const searchResults = await yts(q);

        if (!searchResults.all || searchResults.all.length === 0) {
            return reply('❌ No results found.');
        }

        let msg = '';
        searchResults.all.forEach((video) => {
            msg += `🎬 *${video.title}*\n🔗 ${video.url}\n⏱️ ${video.timestamp || 'N/A'}\n\n`;
        });

        // Trim to avoid excessively long messages (WhatsApp limit ~4096 characters)
        if (msg.length > 4000) msg = msg.substring(0, 4000) + '\n... (results truncated)';

        await conn.sendMessage(from, { text: msg }, { quoted: mek });
    } catch (e) {
        console.error("YTS Error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});