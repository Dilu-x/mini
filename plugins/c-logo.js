// plugins/ACD_CREATELOGO.js — Logo Generator (unified box style, no final message)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ʟᴏɢᴏ ɢᴇɴᴇʀᴀᴛᴏʀ';

const LOGO_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ── Header box (standard) ────────────────────────────────────────
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

// ── Pending requests (userId -> prompt) ──────────────────────────
const logoState = new Map();

// ══════════════════════════════════════════════════════════════════
// CREATELOGO COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'createlogo',
    alias: ['logo', 'generate-logo', 'ai-logo'],
    desc: 'Generate a logo using AI. Usage: .createlogo <prompt>',
    category: 'ai',
    react: '🎨',
    filename: __filename
}, async (conn, mek, m, { reply, q, from, sender }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🎨', key: mek.key } });

        if (!q) {
            const usageCaption = headerBox('LOGO GENERATOR') + '\n\n' +
                                 contentBox([
                                     '❏ .createlogo <prompt>',
                                     '',
                                     'Example:',
                                     '  .createlogo Modern gaming logo',
                                     '  .createlogo Coding logo with name Dilsha'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, LOGO_IMG, usageCaption);
        }

        // Save prompt and ask for model
        logoState.set(sender, q);
        setTimeout(() => logoState.delete(sender), 120000);

        const modelPromptCaption = headerBox('LOGO GENERATOR') + '\n\n' +
                                   contentBox([
                                       `📝 *Prompt:* ${q}`,
                                       '',
                                       '✨ Select your preferred AI model.',
                                       '',
                                       'Reply:',
                                       '  *1* → 🎨 Sora AI',
                                       '  *2* → 🖼️ Photiu AI'
                                   ]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, LOGO_IMG, modelPromptCaption);

    } catch (e) {
        console.error('[CREATELOGO ERROR]', e);
        const errCaption = headerBox('ERROR') + '\n\n' +
                           contentBox([e.message]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, LOGO_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// NUMBER REPLY LISTENER – handles model selection
// ══════════════════════════════════════════════════════════════════
cmd({
    on: 'body',
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, { sender, body, from }) => {
    try {
        const prompt = logoState.get(sender);
        if (!prompt) return;

        const input = body.trim();
        if (input !== '1' && input !== '2') return;

        const model = input === '1' ? 'sora' : 'photiu';
        logoState.delete(sender);

        // ── Animated generating text ────────────────────────────
        const genStages = ['G E N E R A T I N G *', 'G E N E R A T I N G **', 'G E N E R A T I N G ***'];
        const genMsg = await conn.sendMessage(from, { text: genStages[0] }, { quoted: mek });

        let stageIdx = 0;
        const genInterval = setInterval(async () => {
            stageIdx = (stageIdx + 1) % genStages.length;
            try {
                await conn.sendMessage(from, {
                    text: genStages[stageIdx],
                    edit: genMsg.key
                });
            } catch (e) {}
        }, 400);

        // ── Call appropriate API in background ──────────────────
        let imageUrl;
        try {
            if (model === 'sora') {
                const { data } = await axios.get(
                    `https://api.ikyyxd.my.id/ai/text2img?apikey=kyzz&text=${encodeURIComponent(prompt)}`,
                    { timeout: 60000 }
                );
                imageUrl = data?.result?.url;
            } else {
                const { data } = await axios.get(
                    `https://api.ikyyxd.my.id/ai/photiu?prompt=${encodeURIComponent(prompt)}`,
                    { timeout: 60000 }
                );
                imageUrl = data?.result?.image;
            }
        } catch (e) {
            clearInterval(genInterval);
            await conn.sendMessage(from, { delete: genMsg.key });
            const errCaption = headerBox('GENERATION FAILED') + '\n\n' +
                               contentBox(['❌ Could not generate logo.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, LOGO_IMG, errCaption);
        }

        // Stop animation & delete it
        clearInterval(genInterval);
        await conn.sendMessage(from, { delete: genMsg.key });

        if (!imageUrl) {
            const errCaption = headerBox('GENERATION FAILED') + '\n\n' +
                               contentBox(['❌ Image not found.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, LOGO_IMG, errCaption);
        }

        // ── Send the generated image (no caption) ────────────────
        await conn.sendMessage(from, {
            image: { url: imageUrl },
            mimetype: 'image/jpeg'
        }, { quoted: mek });

    } catch (e) {
        console.error('[LOGO GENERATION ERROR]', e);
        const errCaption = headerBox('ERROR') + '\n\n' +
                           contentBox([e.message]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, LOGO_IMG, errCaption);
    }
});