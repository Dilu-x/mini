// plugins/ACD_ANIMU.js — Unified Anime GIF/Image/Quote Commands
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ᴀɴɪᴍᴇ';

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

// ── Content box (multiline safe) ─────────────────────────────────
function contentBox(lines) {
    const top = '┏━━━━━━━━━━━━━━✦';
    const bottom = '┗━━━━━━━━━━━━━━✦';
    const content = lines
        .flatMap(line => String(line).split('\n'))
        .map(line => `┃ ${line}`)
        .join('\n');
    return `${top}\n${content}\n${bottom}`;
}

// ── Animated fetching helper ─────────────────────────────────────
async function doFetching(conn, mek, from, taskFn) {
    const fetchStages = ['F E T C H I N G *', 'F E T C H I N G **', 'F E T C H I N G ***'];
    const fetchMsg = await conn.sendMessage(from, { text: fetchStages[0] }, { quoted: mek });

    let stageIdx = 0;
    const fetchInterval = setInterval(async () => {
        stageIdx = (stageIdx + 1) % fetchStages.length;
        try {
            await conn.sendMessage(from, { text: fetchStages[stageIdx], edit: fetchMsg.key });
        } catch (e) {}
    }, 400);

    let result;
    try {
        result = await taskFn();
    } catch (e) {
        clearInterval(fetchInterval);
        await conn.sendMessage(from, { delete: fetchMsg.key });
        throw e;
    }
    clearInterval(fetchInterval);
    await conn.sendMessage(from, { delete: fetchMsg.key });
    return result;
}

// ══════════════════════════════════════════════════════════════════
// Shared API callers
// ══════════════════════════════════════════════════════════════════
async function fetchWaifu() {
    const res = await axios.get('https://api.siputzx.my.id/api/r/waifu', { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
}
async function fetchNeko() {
    const res = await axios.get('https://api.siputzx.my.id/api/r/neko', { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
}
async function fetchLoli() {
    const res = await axios.get('https://shizoapi.onrender.com/api/sfw/loli?apikey=shizo', { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
}
async function fetchSomeRandom(type) {
    const res = await axios.get(`https://api.some-random-api.com/animu/${type}`);
    return res.data;
}

// ══════════════════════════════════════════════════════════════════
// Generic command runner – unified, no success caption
// ══════════════════════════════════════════════════════════════════
async function runAnimeCommand(conn, mek, m, { reply, from }, type, emoji, displayName) {
    try {
        await conn.sendMessage(from, { react: { text: emoji, key: mek.key } });

        // Animated fetching
        const content = await doFetching(conn, mek, from, async () => {
            if (type === 'waifu') return { buffer: await fetchWaifu() };
            if (type === 'neko') return { buffer: await fetchNeko() };
            if (type === 'loli') return { buffer: await fetchLoli() };
            // GIF / quote types
            const data = await fetchSomeRandom(type);
            if (data.link) return { gifLink: data.link };
            if (data.quote) return { quote: data.quote };
            throw new Error('No content received');
        });

        // Deliver content silently
        if (content.buffer) {
            // Image buffer
            await conn.sendMessage(from, {
                image: content.buffer,
                mimetype: 'image/jpeg'
            }, { quoted: mek });
        } else if (content.gifLink) {
            // GIF link – send as image
            await conn.sendMessage(from, {
                image: { url: content.gifLink },
                mimetype: 'image/gif'
            }, { quoted: mek });
        } else if (content.quote) {
            // Quote text – send directly (no box)
            await conn.sendMessage(from, { text: content.quote }, { quoted: mek });
        }

    } catch (e) {
        console.error(`[ANIME:${type}] error:`, e.message);
        const errCaption = headerBox(displayName || type.toUpperCase()) + '\n\n' +
                           contentBox([`❌ Could not fetch ${displayName || type}.`, e.message]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, ANIME_IMG, errCaption);
    }
}

// ══════════════════════════════════════════════════════════════════
//  INDIVIDUAL COMMANDS
// ══════════════════════════════════════════════════════════════════

cmd({ pattern: 'nom', desc: 'Random anime nom GIF.', category: 'anime', react: '🍜', filename: __filename },
    async (c, m, x, a) => runAnimeCommand(c, m, x, a, 'nom', '🍜', 'NOM'));
cmd({ pattern: 'poke', desc: 'Random anime poke GIF.', category: 'anime', react: '👉', filename: __filename },
    async (c, m, x, a) => runAnimeCommand(c, m, x, a, 'poke', '👉', 'POKE'));
cmd({ pattern: 'cry', desc: 'Random anime cry GIF.', category: 'anime', react: '😢', filename: __filename },
    async (c, m, x, a) => runAnimeCommand(c, m, x, a, 'cry', '😢', 'CRY'));
cmd({ pattern: 'kiss', desc: 'Random anime kiss GIF.', category: 'anime', react: '💋', filename: __filename },
    async (c, m, x, a) => runAnimeCommand(c, m, x, a, 'kiss', '💋', 'KISS'));
cmd({ pattern: 'pat', desc: 'Random anime pat GIF.', category: 'anime', react: '👋', filename: __filename },
    async (c, m, x, a) => runAnimeCommand(c, m, x, a, 'pat', '👋', 'PAT'));
cmd({ pattern: 'hug', desc: 'Random anime hug GIF.', category: 'anime', react: '🤗', filename: __filename },
    async (c, m, x, a) => runAnimeCommand(c, m, x, a, 'hug', '🤗', 'HUG'));
cmd({ pattern: 'wink', desc: 'Random anime wink GIF.', category: 'anime', react: '😉', filename: __filename },
    async (c, m, x, a) => runAnimeCommand(c, m, x, a, 'wink', '😉', 'WINK'));
cmd({ pattern: 'facepalm', alias: ['face-palm'], desc: 'Random anime facepalm GIF.', category: 'anime', react: '🤦', filename: __filename },
    async (c, m, x, a) => runAnimeCommand(c, m, x, a, 'face-palm', '🤦', 'FACEPALM'));
cmd({ pattern: 'animequote', alias: ['animuquote', 'aq'], desc: 'Random anime quote.', category: 'anime', react: '📜', filename: __filename },
    async (c, m, x, a) => runAnimeCommand(c, m, x, a, 'quote', '📜', 'ANIME QUOTE'));
cmd({ pattern: 'waifu', desc: 'Random waifu image.', category: 'anime', react: '💖', filename: __filename },
    async (c, m, x, a) => runAnimeCommand(c, m, x, a, 'waifu', '💖', 'WAIFU'));
cmd({ pattern: 'neko', desc: 'Random neko image.', category: 'anime', react: '🐱', filename: __filename },
    async (c, m, x, a) => runAnimeCommand(c, m, x, a, 'neko', '🐱', 'NEKO'));
cmd({ pattern: 'loli', desc: 'Random loli image.', category: 'anime', react: '🌸', filename: __filename },
    async (c, m, x, a) => runAnimeCommand(c, m, x, a, 'loli', '🌸', 'LOLI'));