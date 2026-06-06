// plugins/ACD_PLAY.js — YouTube Play (ikyyxd API) – no final message
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ʏᴏᴜᴛᴜʙᴇ ᴘʟᴀʏ';

const PLAY_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ── Header box (standard across all plugins) ────────────────────
function headerBox(platform) {
    const top    = '*┏━━━━━━━━━━━━━━✦*';
    const bot    = `*┃ \`Bot Name :\` ${BOT_NAME}*`;
    const time   = getDateTimeLine();
    const plat   = `*┃ \`Platform :\` ${platform}*`;
    const bottom = '*┗━━━━━━━━━━━━━━✦*';
    return `${top}\n${bot}\n${time}\n${plat}\n${bottom}`;
}

// ── Content box (like Song results) ─────────────────────────────
function contentBox(lines) {
    const top = '┏━━━━━━━━━━━━━━✦';
    const bottom = '┗━━━━━━━━━━━━━━✦';
    const content = lines.map(line => `┃ ${line}`).join('\n');
    return `${top}\n${content}\n${bottom}`;
}

// ══════════════════════════════════════════════════════════════════
// YOUTUBE PLAY COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'play',
    alias: ['ytplay', 'youtubemusic'],
    desc: 'Download & play a YouTube song instantly.',
    category: 'download',
    react: '🎵',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🎵', key: mek.key } });

        // ── Usage with image + content box ──────────────────────
        if (!q) {
            const usageCaption = headerBox('YOUTUBE PLAY') + '\n\n' +
                                 contentBox([
                                     '❏ .play <song name / YouTube URL>',
                                     '',
                                     'Example:',
                                     '  .play Faded',
                                     '  .play https://youtu.be/xxxxx'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, PLAY_IMG, usageCaption);
        }

        // ── Animated searching text ─────────────────────────────
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

        // Call the API in background
        let apiData;
        try {
            const res = await axios.get(
                `https://api.ikyyxd.my.id/search/ytplayv2?q=${encodeURIComponent(q)}`
            );
            apiData = res.data;
        } catch (e) {
            clearInterval(searchInterval);
            await conn.sendMessage(from, { delete: searchMsg.key });
            const errCaption = headerBox('SEARCH ERROR') + '\n\n' +
                               contentBox(['❌ Could not connect to server.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, PLAY_IMG, errCaption);
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
            return await sendWithImage(conn, from, mek, PLAY_IMG, failCaption);
        }

        const res = apiData.result;
        const durationMin = Math.floor(res.duration / 60);
        const durationSec = (res.duration % 60).toString().padStart(2, '0');

        // ── Show track info with thumbnail (before sending audio) ──
        const infoCaption = headerBox('YOUTUBE PLAY') + '\n\n' +
                            contentBox([
                                `🎵 *Title:* ${res.title}`,
                                `⏱️ *Duration:* ${durationMin}:${durationSec}`,
                                `🔗 *Source:* ${res.source}`,
                                '',
                                '⬇️ Downloading high quality audio...'
                            ]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, res.thumbnail, infoCaption);

        // ── Send the audio ─────────────────────────────────────
        await conn.sendMessage(from, {
            audio: { url: res.audio.url },
            mimetype: 'audio/mpeg',
            fileName: `${res.title}.mp3`,
            ptt: false
        }, { quoted: mek });

        // ✅ No final success message – exactly like SONG behaviour

    } catch (e) {
        console.error('[PLAY ERROR]', e);
        const errCaption = headerBox('SYSTEM ERROR') + '\n\n' +
                           contentBox(['An unexpected error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, PLAY_IMG, errCaption);
    }
});