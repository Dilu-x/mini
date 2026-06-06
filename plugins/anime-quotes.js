// plugins/ACD_ANIMEQUOTE.js — Random Anime Quote (unified box style)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ᴀɴɪᴍᴇ ϙᴜᴏᴛᴇ';

const ANIME_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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
// ANIME QUOTE COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'animequote',
    alias: ['aq', 'animequotes'],
    desc: 'Get a random anime quote.',
    category: 'fun',
    react: '🎌',
    filename: __filename
}, async (conn, mek, m, { reply, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🎌', key: mek.key } });

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

        let quote;
        try {
            const { data } = await axios.get('https://v2.api-varhad.my.id/random/animequoted');
            if (!data.status || !data.result?.length) throw new Error('No quotes available');
            const randomIndex = Math.floor(Math.random() * data.result.length);
            quote = data.result[randomIndex];
        } catch (e) {
            clearInterval(fetchInterval);
            await conn.sendMessage(from, { delete: fetchMsg.key });
            const errCaption = headerBox('ANIME QUOTE') + '\n\n' +
                               contentBox(['❌ No quotes available right now.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, ANIME_IMG, errCaption);
        }

        // Stop animation & delete it
        clearInterval(fetchInterval);
        await conn.sendMessage(from, { delete: fetchMsg.key });

        // ── Build result message ────────────────────────────────
        const resultCaption = headerBox('ANIME QUOTE') + '\n\n' +
                              contentBox([
                                  `📖 *Quote:* "${quote.quote}"`,
                                  '',
                                  `👤 *Character:* ${quote.char}`,
                                  `🎬 *Anime:* ${quote.from_anime}`,
                                  `📺 *Episode:* ${quote.episode}`
                              ]) + '\n\n' + FOOTER;

        await sendWithImage(conn, from, mek, ANIME_IMG, resultCaption);

    } catch (e) {
        console.error('[ANIMEQUOTE ERROR]', e);
        const errCaption = headerBox('ANIME QUOTE') + '\n\n' +
                           contentBox(['⚠️ An unexpected error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, ANIME_IMG, errCaption);
    }
});