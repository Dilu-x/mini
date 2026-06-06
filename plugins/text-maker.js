// plugins/ACD_TEXTMAKER.js — Unified Text Effects (mumaker/ephoto360)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const mumaker = require('mumaker');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ᴛᴇxᴛ ᴍᴀᴋᴇʀ';

const TEXTMAKER_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ── Animated processing helper ───────────────────────────────────
async function doProcessing(conn, mek, from, taskFn) {
    const procStages = ['P R O C E S S I N G *', 'P R O C E S S I N G **', 'P R O C E S S I N G ***'];
    const procMsg = await conn.sendMessage(from, { text: procStages[0] }, { quoted: mek });

    let stageIdx = 0;
    const procInterval = setInterval(async () => {
        stageIdx = (stageIdx + 1) % procStages.length;
        try {
            await conn.sendMessage(from, { text: procStages[stageIdx], edit: procMsg.key });
        } catch (e) {}
    }, 400);

    let result;
    try {
        result = await taskFn();
    } catch (e) {
        clearInterval(procInterval);
        await conn.sendMessage(from, { delete: procMsg.key });
        throw e;
    }
    clearInterval(procInterval);
    await conn.sendMessage(from, { delete: procMsg.key });
    return result;
}

// ══════════════════════════════════════════════════════════════════
// Core text effect generator (unified, no final message)
// ══════════════════════════════════════════════════════════════════
async function generateTextEffect(conn, mek, m, { reply, q, from }, type, emoji, label, ephotoUrl) {
    try {
        await conn.sendMessage(from, { react: { text: emoji, key: mek.key } });

        if (!q) {
            const usageCaption = headerBox(label) + '\n\n' +
                                 contentBox([
                                     `❏ .${type} <text>`,
                                     '',
                                     'Example:',
                                     `  .${type} Supreme`
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TEXTMAKER_IMG, usageCaption);
        }

        // Animated processing and generation
        const result = await doProcessing(conn, mek, from, async () => {
            return await mumaker.ephoto(ephotoUrl, q);
        });

        if (!result || !result.image) throw new Error('No image generated');

        // Send the resulting image silently (no caption)
        await conn.sendMessage(from, {
            image: { url: result.image },
            mimetype: 'image/jpeg'
        }, { quoted: mek });

    } catch (e) {
        console.error(`[${type.toUpperCase()} ERROR]`, e);
        const errCaption = headerBox(label) + '\n\n' +
                           contentBox([`❌ Failed to generate effect.`, e.message]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TEXTMAKER_IMG, errCaption);
    }
}

// ══════════════════════════════════════════════════════════════════
// INDIVIDUAL COMMANDS – each with its own ephoto360 URL
// ══════════════════════════════════════════════════════════════════

cmd({ pattern: 'metallic', alias: ['metal'], desc: 'Metallic text effect.', category: 'textmaker', react: '🔩', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'metallic', '🔩', 'METALLIC', 'https://en.ephoto360.com/impressive-decorative-3d-metal-text-effect-798.html'));

cmd({ pattern: 'ice', desc: 'Ice text effect.', category: 'textmaker', react: '🧊', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'ice', '🧊', 'ICE', 'https://en.ephoto360.com/ice-text-effect-online-101.html'));

cmd({ pattern: 'snow', desc: 'Snow text effect.', category: 'textmaker', react: '❄️', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'snow', '❄️', 'SNOW', 'https://en.ephoto360.com/create-a-snow-3d-text-effect-free-online-621.html'));

cmd({ pattern: 'impressive', alias: ['impressive3d'], desc: 'Impressive 3D text effect.', category: 'textmaker', react: '🎨', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'impressive', '🎨', 'IMPRESSIVE', 'https://en.ephoto360.com/create-3d-colorful-paint-text-effect-online-801.html'));

cmd({ pattern: 'matrix', desc: 'Matrix text effect.', category: 'textmaker', react: '💚', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'matrix', '💚', 'MATRIX', 'https://en.ephoto360.com/matrix-text-effect-154.html'));

cmd({ pattern: 'light', desc: 'Light/futuristic text effect.', category: 'textmaker', react: '💡', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'light', '💡', 'LIGHT', 'https://en.ephoto360.com/light-text-effect-futuristic-technology-style-648.html'));

cmd({ pattern: 'neon', desc: 'Neon text effect.', category: 'textmaker', react: '🌈', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'neon', '🌈', 'NEON', 'https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html'));

cmd({ pattern: 'devil', alias: ['neondevil'], desc: 'Neon devil wings text effect.', category: 'textmaker', react: '😈', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'devil', '😈', 'DEVIL', 'https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html'));

cmd({ pattern: 'purple', desc: 'Purple text effect.', category: 'textmaker', react: '💜', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'purple', '💜', 'PURPLE', 'https://en.ephoto360.com/purple-text-effect-online-100.html'));

cmd({ pattern: 'thunder', desc: 'Thunder text effect.', category: 'textmaker', react: '⚡', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'thunder', '⚡', 'THUNDER', 'https://en.ephoto360.com/thunder-text-effect-online-97.html'));

cmd({ pattern: 'leaves', alias: ['greenbrush'], desc: 'Green brush/leaves text effect.', category: 'textmaker', react: '🌿', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'leaves', '🌿', 'LEAVES', 'https://en.ephoto360.com/green-brush-text-effect-typography-maker-online-153.html'));

cmd({ pattern: '1917', alias: ['1917style'], desc: '1917 style text effect.', category: 'textmaker', react: '🎞️', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, '1917', '🎞️', '1917', 'https://en.ephoto360.com/1917-style-text-effect-523.html'));

cmd({ pattern: 'arena', desc: 'Arena of Valor text effect.', category: 'textmaker', react: '⚔️', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'arena', '⚔️', 'ARENA', 'https://en.ephoto360.com/create-cover-arena-of-valor-by-mastering-360.html'));

cmd({ pattern: 'hacker', alias: ['anonymous'], desc: 'Anonymous hacker text effect.', category: 'textmaker', react: '👨‍💻', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'hacker', '👨‍💻', 'HACKER', 'https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html'));

cmd({ pattern: 'sand', alias: ['sandwrite'], desc: 'Sand writing text effect.', category: 'textmaker', react: '🏖️', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'sand', '🏖️', 'SAND', 'https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html'));

cmd({ pattern: 'blackpink', alias: ['bpink'], desc: 'Blackpink style logo.', category: 'textmaker', react: '🖤💗', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'blackpink', '🖤💗', 'BLACKPINK', 'https://en.ephoto360.com/create-a-blackpink-style-logo-with-members-signatures-810.html'));

cmd({ pattern: 'glitch', alias: ['digitalglitch'], desc: 'Digital glitch text effect.', category: 'textmaker', react: '🎛️', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'glitch', '🎛️', 'GLITCH', 'https://en.ephoto360.com/create-digital-glitch-text-effects-online-767.html'));

cmd({ pattern: 'fire', alias: ['flame'], desc: 'Fire/flame text effect.', category: 'textmaker', react: '🔥', filename: __filename },
    async (c, m, x, a) => generateTextEffect(c, m, x, a, 'fire', '🔥', 'FIRE', 'https://en.ephoto360.com/flame-lettering-effect-372.html'));