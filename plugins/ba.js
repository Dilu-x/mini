// plugins/ACD_BA.js — Random BA Image (unified box style, no caption)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ʀᴀɴᴅᴏᴍ ɪᴍᴀɢᴇ';

const BA_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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
// RANDOM BA COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'ba',
    alias: ['bocil', 'bocilaesthetic', 'randba'],
    desc: 'Get a random Bocil Aesthetic image.',
    category: 'fun',
    react: '🌸',
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🌸', key: mek.key } });

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

        let imageUrl;
        try {
            const { data } = await axios.get('https://v2.api-varhad.my.id/random/ba');
            if (!data.status || !data.result) throw new Error('No image');

            // Extract image URL from various response shapes
            if (typeof data.result === 'string') {
                imageUrl = data.result;
            } else if (data.result.url) {
                imageUrl = data.result.url;
            } else if (data.result.image) {
                imageUrl = data.result.image;
            } else if (Array.isArray(data.result) && data.result.length > 0) {
                const first = data.result[0];
                imageUrl = first.url || first.image || first.result || first;
                if (typeof imageUrl !== 'string') imageUrl = null;
            }

            if (!imageUrl) throw new Error('Could not extract image URL');
        } catch (e) {
            clearInterval(fetchInterval);
            await conn.sendMessage(from, { delete: fetchMsg.key });
            const errCaption = headerBox('RANDOM IMAGE') + '\n\n' +
                               contentBox(['❌ No image available right now.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, BA_IMG, errCaption);
        }

        // Stop animation & delete it
        clearInterval(fetchInterval);
        await conn.sendMessage(from, { delete: fetchMsg.key });

        // ── Send the image silently (no caption) ────────────────
        await conn.sendMessage(from, {
            image: { url: imageUrl },
            mimetype: 'image/jpeg'
        }, { quoted: mek });

    } catch (e) {
        console.error('[BA ERROR]', e);
        const errCaption = headerBox('RANDOM IMAGE') + '\n\n' +
                           contentBox(['⚠️ An unexpected error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, BA_IMG, errCaption);
    }
});