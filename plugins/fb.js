// plugins/ACD_FACEBOOK.js — Facebook Video Downloader (unified box style, no final message)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ꜰᴀᴄᴇʙᴏᴏᴋ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ';

const FB_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ── Header box ──────────────────────────────────────────────────
function headerBox(platform) {
    const top    = '*┏━━━━━━━━━━━━━━✦*';
    const bot    = `*┃ \`Bot Name :\` ${BOT_NAME}*`;
    const time   = getDateTimeLine();
    const plat   = `*┃ \`Platform :\` ${platform}*`;
    const bottom = '*┗━━━━━━━━━━━━━━✦*';
    return `${top}\n${bot}\n${time}\n${plat}\n${bottom}`;
}

// ── Content box ─────────────────────────────────────────────────
function contentBox(lines) {
    const top = '┏━━━━━━━━━━━━━━✦';
    const bottom = '┗━━━━━━━━━━━━━━✦';
    const content = lines.map(line => `┃ ${line}`).join('\n');
    return `${top}\n${content}\n${bottom}`;
}

// ══════════════════════════════════════════════════════════════════
// FACEBOOK COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'facebook',
    alias: ['fb', 'fbdl', 'fbvideo'],
    desc: 'Download Facebook video. Usage: .facebook <URL>',
    category: 'download',
    react: '📘',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '📘', key: mek.key } });

        // ── Usage with image ────────────────────────────────────
        if (!q) {
            const usageCaption = headerBox('FACEBOOK DOWNLOADER') + '\n\n' +
                                 contentBox([
                                     '❏ .facebook <Facebook video URL>',
                                     '',
                                     'Example:',
                                     '  .facebook https://fb.watch/xxxx'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, FB_IMG, usageCaption);
        }

        const url = q.split(' ')[0].trim();
        if (!url.startsWith('http')) {
            const invalidCaption = headerBox('FACEBOOK DOWNLOADER') + '\n\n' +
                                   contentBox(['⚠️ Please provide a valid Facebook video link.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, FB_IMG, invalidCaption);
        }

        // ── Animated fetching text ──────────────────────────────
        const fetchStages = ['F E T C H I N G *', 'F E T C H I N G **', 'F E T C H I N G ***'];
        const fetchMsg = await conn.sendMessage(from, { text: fetchStages[0] }, { quoted: mek });

        let stageIdx = 0;
        const fetchInterval = setInterval(async () => {
            stageIdx = (stageIdx + 1) % fetchStages.length;
            try {
                await conn.sendMessage(from, {
                    text: fetchStages[stageIdx],
                    edit: fetchMsg.key
                });
            } catch (e) {}
        }, 400);

        let videoUrl;
        try {
            const { data } = await axios.get('https://v2.api-varhad.my.id/download/fb', {
                params: { url }
            });
            if (!data.status || !data.result?.video?.length) throw new Error('No video found');
            const bestVideo = data.result.video[0];
            videoUrl = bestVideo.url;
        } catch (e) {
            clearInterval(fetchInterval);
            await conn.sendMessage(from, { delete: fetchMsg.key });
            const errCaption = headerBox('FACEBOOK DOWNLOADER') + '\n\n' +
                               contentBox(['❌ Unable to fetch the video. Check the URL.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, FB_IMG, errCaption);
        }

        // Stop animation & delete it
        clearInterval(fetchInterval);
        await conn.sendMessage(from, { delete: fetchMsg.key });

        // ── Send the video silently (no caption) ────────────────
        await conn.sendMessage(from, {
            video: { url: videoUrl },
            mimetype: 'video/mp4'
        }, { quoted: mek });

    } catch (e) {
        console.error('[FACEBOOK ERROR]', e);
        const errCaption = headerBox('FACEBOOK DOWNLOADER') + '\n\n' +
                           contentBox(['An unexpected error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, FB_IMG, errCaption);
    }
});