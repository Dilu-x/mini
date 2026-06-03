const { cmd } = require('../command');
const config = require('../config');
const DY_SCRAP = require('@dark-yasiya/scrap');
const dy_scrap = new DY_SCRAP();

// Pending interactions – key = sent message ID, value = { userId, videoId, title, author, ... }
const pendingSong = new Map();

function replaceYouTubeID(url) {
    const regex = /(?:youtube\.com\/(?:.*v=|.*\/)|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// ── The main command ──────────────────────────────
cmd({
    pattern: "song",
    alias: ["s", "play"],
    desc: "Download Ytmp3 (Audio/Document)",
    category: "download",
    react: "🎵",
    filename: __filename,
    use: "<text or YT URL>"
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❌ Please provide a Query or Youtube URL!");

        let id = q.startsWith("https://") ? replaceYouTubeID(q) : null;
        if (!id) {
            const searchResults = await dy_scrap.ytsearch(q);
            if (!searchResults?.results?.length) return reply("❌ No results found!");
            id = searchResults.results[0].videoId;
        }

        const data = await dy_scrap.ytsearch(`https://youtube.com/watch?v=${id}`);
        if (!data?.results?.length) return reply("❌ Failed to fetch video details!");
        const { url, title, image, timestamp, ago, views, author } = data.results[0];

        const info = `🍄 *𝚂𝙾𝙽𝙶 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳𝙴𝚁* 🍄\n\n` +
            `🎵 *Title:* ${title || "Unknown"}\n` +
            `⏳ *Duration:* ${timestamp || "Unknown"}\n` +
            `👀 *Views:* ${views || "Unknown"}\n` +
            `🌏 *Release Ago:* ${ago || "Unknown"}\n` +
            `👤 *Author:* ${author?.name || "Unknown"}\n` +
            `🖇 *Url:* ${url || "Unknown"}\n\n` +
            `🔽 *Reply with your choice:*\n` +
            `> 1 *Audio Type* 🎵\n` +
            `> 2 *Document Type* 📁\n\n` +
            `${config.FOOTER || "ʟɪᴛᴇ-xᴅ"}`;

        const sentMsg = await conn.sendMessage(from, { image: { url: image }, caption: info }, { quoted: mek });
        await conn.sendMessage(from, { react: { text: '🎶', key: sentMsg.key } });

        // Store the pending interaction
        pendingSong.set(sentMsg.key.id, {
            userId: m.sender,
            videoId: id,
            title: title || "Unknown",
            author: author?.name || "Unknown",
            timestamp: timestamp || "Unknown"
        });

        // Auto-delete after 60 seconds
        setTimeout(() => { pendingSong.delete(sentMsg.key.id); }, 60000);

    } catch (error) {
        console.error("Song command error:", error);
        reply(`❌ *Error:* ${error.message}`);
    }
});

// ── Body listener to capture the reply (1 or 2) ──
cmd({
    on: "body",
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, { sender, body, reply }) => {
    try {
        const text = body.trim();
        const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
        if (!contextInfo?.stanzaId) return;

        const stanzaId = contextInfo.stanzaId;
        const pending = pendingSong.get(stanzaId);
        if (!pending) return;

        // Verify it's the same user who initiated the command
        if (sender !== pending.userId) return reply("❌ Only the person who requested can choose.");

        const choice = text;
        if (choice !== '1' && choice !== '2') return reply("❌ Invalid choice. Reply with 1 or 2 only.");

        pendingSong.delete(stanzaId);   // prevent multiple triggers

        const { videoId, title } = pending;
        let type;
        let processingMsg;

        if (choice === '1') {
            processingMsg = await conn.sendMessage(m.chat, { text: "⏳ Processing audio..." }, { quoted: mek });
            const response = await dy_scrap.ytmp3(`https://youtube.com/watch?v=${videoId}`);
            const downloadUrl = response?.result?.download?.url;
            if (!downloadUrl) {
                await conn.sendMessage(m.chat, { text: '❌ Download link not found!', edit: processingMsg.key });
                return;
            }
            type = { audio: { url: downloadUrl }, mimetype: "audio/mpeg" };
            await conn.sendMessage(m.chat, type, { quoted: mek });
            await conn.sendMessage(m.chat, { text: '✅ Audio uploaded successfully!', edit: processingMsg.key });
        } else {
            // choice === '2'
            processingMsg = await conn.sendMessage(m.chat, { text: "⏳ Preparing document..." }, { quoted: mek });
            const response = await dy_scrap.ytmp3(`https://youtube.com/watch?v=${videoId}`);
            const downloadUrl = response?.result?.download?.url;
            if (!downloadUrl) {
                await conn.sendMessage(m.chat, { text: '❌ Download link not found!', edit: processingMsg.key });
                return;
            }
            type = { document: { url: downloadUrl }, fileName: `${title}.mp3`, mimetype: "audio/mpeg", caption: title };
            await conn.sendMessage(m.chat, type, { quoted: mek });
            await conn.sendMessage(m.chat, { text: '✅ Document uploaded successfully!', edit: processingMsg.key });
        }

    } catch (error) {
        console.error("Song reply error:", error);
        // reply is not guaranteed to be in scope here, so we just log.
    }
});