// plugins/ACD_PAIR.js — Generate WhatsApp pairing code (stylish UI)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER   = config.footer  || '> ᴘᴀɪʀ ᴄᴏᴍᴍᴀɴᴅ';
const PAIR_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ══════════════════════════════════════════════════════════════════
// PAIR COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'pair',
    desc: 'Generate a WhatsApp pairing code using external API',
    category: 'main',
    react: '🔑',
    filename: __filename
}, async (conn, mek, m, { reply, q, from, sender }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🔑', key: mek.key } });

        if (!q) {
            const usageCaption = headerBox('PAIR CODE') + '\n\n' +
                                 contentBox([
                                     '❏ .pair 947646XXXX',
                                     '',
                                     'Example:',
                                     '  .pair 94764642432',
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, PAIR_IMG, usageCaption);
        }

        // Extract number (remove any non-digit except leading +)
        let number = q.trim();
        if (!number.startsWith('+')) number = '+' + number.replace(/[^0-9]/g, '');

        if (number.length < 10) {
            const invalidCaption = headerBox('PAIR CODE') + '\n\n' +
                                   contentBox(['❌ Invalid phone number. Use format: +947XXXXXXX']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, PAIR_IMG, invalidCaption);
        }

        // Processing message
        const processingCaption = headerBox('PAIR CODE') + '\n\n' +
                                  contentBox([`📱 Requesting code for ${number}`, '⏳ Please wait...']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, PAIR_IMG, processingCaption);

        // API call
        const apiUrl = `http://localhost:3000/code?number=${encodeURIComponent(number)}`;
        const { data } = await axios.get(apiUrl, { timeout: 30000 });

        if (!data || !data.code) {
            throw new Error('No code received from API');
        }

        const code = data.code;

        // Success response with stylish box
        const successCaption = headerBox('PAIR CODE') + '\n\n' +
                               contentBox([
                                   '✅ *Pairing code generated successfully*',
                                   '',
                                   `🔑 *Code:* ${code}`,
                                   '',
                                   'Use this code within 1 minutes to pair your WhatsApp.'
                               ]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, PAIR_IMG, successCaption);

    } catch (error) {
        console.error('[PAIR ERROR]', error);
        const errCaption = headerBox('PAIR CODE') + '\n\n' +
                           contentBox([`❌ Failed to get pairing code.\n${error.message}`]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, PAIR_IMG, errCaption);
    }
});