// plugins/ACD_YTMP3.js — YouTube MP3 Downloader (unified box style, no final message)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ʏᴛᴍᴘ3 ᴅᴏᴡɴʟᴏᴀᴅᴇʀ';

const YTMP3_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

// ── Helper: send image + caption, fallback to text ────────────────
async function sendWithImage(conn, from, mek, imageUrl, caption) {
    try {
        const imgBuf = await getBuffer(imageUrl);
        await conn.sendMessage(from, {
            image: imgBuf,
            caption: caption,
            mimetype: 'image/jpeg'
        }, { quoted: mek });
    } catch (e) {
        await conn.sendMessage(from, { text: caption }, { quoted: mek });
    }
}

// ── Build current date/time line ─────────────────────────────────
function getDateTimeLine() {
    const now = new Date();
    const date = now.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Colombo'
    });
    const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Colombo'
    });
    return `┃ \`Time :\` ${time}\n┃ \`Date :\` ${date}`;
}

// ── Header box (standard across all plugins) ─────────────────────
function headerBox(platform) {
    const top    = '*┏━━━━━━━━━━━━━━✦*';
    const bot    = `*┃ \`Bot Name :\` ${BOT_NAME}*`;
    const time   = getDateTimeLine();
    const plat   = `*┃ \`Platform :\` ${platform}*`;
    const bottom = '*┗━━━━━━━━━━━━━━✦*';
    return `${top}\n${bot}\n${time}\n${plat}\n${bottom}`;
}

// ── Content box (like other plugins) ─────────────────────────────
function contentBox(lines) {
    const top = '┏━━━━━━━━━━━━━━✦';
    const bottom = '┗━━━━━━━━━━━━━━✦';
    const content = lines.map(line => `┃ ${line}`).join('\n');
    return `${top}\n${content}\n${bottom}`;
}

// ══════════════════════════════════════════════════════════════════
// YTMP3 COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'ytmp3',
    alias: ['ytaudio', 'youtubemp3', 'yta'],
    desc: 'Download YouTube audio (MP3). Usage: .ytmp3 <song name / YouTube URL>',
    category: 'download',
    react: '🎵',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🎵', key: mek.key } });

        // ── Usage with image ────────────────────────────────────
        if (!q) {
            const usageCaption = headerBox('YTMP3 DOWNLOADER') + '\n\n' +
                                 contentBox([
                                     '❏ .ytmp3 <song name / YouTube URL>',
                                     '',
                                     'Example:',
                                     '  .ytmp3 Faded',
                                     '  .ytmp3 https://youtu.be/xxxxx'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, YTMP3_IMG, usageCaption);
        }

        // ── Animated searching text ──────────────────────────────
        const searchStages = ['sᴇᴀʀᴄʜɪɴɢ *', 'sᴇᴀʀᴄʜɪɴɢ **', 'sᴇᴀʀᴄʜɪɴɢ ***'];
        const searchMsg = await conn.sendMessage(from, { text: searchStages[0] }, { quoted: mek });

        let stageIdx = 0;
        const searchInterval = setInterval(async () => {
            stageIdx = (stageIdx + 1) % searchStages.length;
            try {
                await conn.sendMessage(from, {
                    text: searchStages[stageIdx],
                    edit: searchMsg.key
                });
            } catch (e) {}
        }, 400);

        // ── API call ────────────────────────────────────────────
        let apiData;
        try {
            const res = await axios.get('https://api.ikyyxd.my.id/search/ytplay', {
                params: { query: q }
            });
            apiData = res.data;
        } catch (e) {
            clearInterval(searchInterval);
            await conn.sendMessage(from, { delete: searchMsg.key });
            const errCaption = headerBox('SEARCH ERROR') + '\n\n' +
                               contentBox(['❌ Could not contact server.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, YTMP3_IMG, errCaption);
        }

        // Stop animation & delete it
        clearInterval(searchInterval);
        await conn.sendMessage(from, { delete: searchMsg.key });

        // ── Validate result ─────────────────────────────────────
        if (!apiData.status) {
            const failCaption = headerBox('NO RESULTS') + '\n\n' +
                                contentBox([
                                    'No matching results found.',
                                    'Try another keyword.'
                                ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, YTMP3_IMG, failCaption);
        }

        const result = apiData.result;
        const title = result.title;
        const channel = result.author;
        const duration = result.duration;
        const views = result.views?.toLocaleString() || 'Unknown';
        const image = result.thumbnail;
        const link = result.source;
        const audioUrl = result.download.url;
        const quality = result.download.quality || 'N/A';

        // ── Send thumbnail + track info ────────────────────────
        const infoCaption = headerBox('YOUTUBE AUDIO') + '\n\n' +
                            contentBox([
                                `📌 *Title:* ${title}`,
                                `👤 *Channel:* ${channel}`,
                                `⏱ *Duration:* ${duration}`,
                                `👁 *Views:* ${views}`,
                                `🎵 *Quality:* ${quality}`,
                                '',
                                `🔗 *Source:* ${link}`,
                                '',
                                '⬇️ Downloading high quality audio...'
                            ]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, image, infoCaption);

        // ── Download audio ─────────────────────────────────────
        const audioResponse = await axios.get(audioUrl, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        // Check file size (33 MB limit)
        if (audioResponse.data.length > 33 * 1024 * 1024) {
            const largeCaption = headerBox('FILE TOO LARGE') + '\n\n' +
                                 contentBox(['Audio file size exceeds 33 MB.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, YTMP3_IMG, largeCaption);
        }

        // ── Send audio (no success message) ────────────────────
        await conn.sendMessage(from, {
            audio: Buffer.from(audioResponse.data),
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            ptt: false
        }, { quoted: mek });

        // ✅ Done – no further message

    } catch (e) {
        console.error('[YTMP3 ERROR]', e);
        const errCaption = headerBox('SYSTEM ERROR') + '\n\n' +
                           contentBox(['An unexpected error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, YTMP3_IMG, errCaption);
    }
});