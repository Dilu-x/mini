// plugins/ACD_INSTAGRAM.js — Instagram Downloader (unified box style, no captions)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ɪɴsᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ';

const IG_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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
// INSTAGRAM COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'instagram',
    alias: ['ig', 'igdl', 'insta'],
    desc: 'Download Instagram photos/videos. Usage: .instagram <URL>',
    category: 'download',
    react: '📸',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '📸', key: mek.key } });

        // ── Usage with image ────────────────────────────────────
        if (!q) {
            const usageCaption = headerBox('INSTAGRAM DOWNLOADER') + '\n\n' +
                                 contentBox([
                                     '❏ .instagram <Instagram post/reel URL>',
                                     '',
                                     'Example:',
                                     '  .instagram https://www.instagram.com/p/xxxx'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, IG_IMG, usageCaption);
        }

        const url = q.split(' ')[0].trim();
        if (!url.startsWith('http')) {
            const invalidCaption = headerBox('INSTAGRAM DOWNLOADER') + '\n\n' +
                                   contentBox(['⚠️ Please provide a valid Instagram link.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, IG_IMG, invalidCaption);
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

        let results;
        try {
            const { data } = await axios.get('https://v2.api-varhad.my.id/download/ig', {
                params: { url }
            });
            if (!data.status || !data.result?.results?.length) throw new Error('No media found');
            results = data.result.results;
        } catch (e) {
            clearInterval(fetchInterval);
            await conn.sendMessage(from, { delete: fetchMsg.key });
            const errCaption = headerBox('INSTAGRAM DOWNLOADER') + '\n\n' +
                               contentBox(['❌ No media found or unable to download.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, IG_IMG, errCaption);
        }

        // Stop animation & delete it
        clearInterval(fetchInterval);
        await conn.sendMessage(from, { delete: fetchMsg.key });

        // ── Send each media file silently (no captions) ─────────
        for (let i = 0; i < results.length; i++) {
            const mediaUrl = results[i];
            const isVideo = /\.mp4(\?|$)/i.test(mediaUrl);

            if (isVideo) {
                await conn.sendMessage(from, {
                    video: { url: mediaUrl },
                    mimetype: 'video/mp4'
                }, { quoted: mek });
            } else {
                await conn.sendMessage(from, {
                    image: { url: mediaUrl },
                    mimetype: 'image/jpeg'
                }, { quoted: mek });
            }

            // Small delay to avoid rate limits
            if (i < results.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }
        // No final message sent

    } catch (e) {
        console.error('[INSTAGRAM ERROR]', e);
        const errCaption = headerBox('INSTAGRAM DOWNLOADER') + '\n\n' +
                           contentBox(['An unexpected error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, IG_IMG, errCaption);
    }
});