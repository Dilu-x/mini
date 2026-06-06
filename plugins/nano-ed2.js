// plugins/ACD_NANOEDIT.js — Nano Banana Image Editor (unified box style, no final message)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const mime = require('mime-types');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ɴᴀɴᴏ ʙᴀɴᴀɴᴀ';

const NANO_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ── Upload image buffer to CDN (for public URL) ───────────────────
async function uploadToCDN(buffer) {
    const form = new FormData();
    form.append('file', Readable.from(buffer), {
        filename: 'nanobanana.jpg',
        contentType: mime.lookup('jpg') || 'image/jpeg'
    });
    const { data } = await axios.post('https://cdnn.ikyyxd.my.id/api/upload.php', form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    });
    if (!data?.success) throw new Error('Upload CDN failed');
    return data.url;
}

// ── Session store ─────────────────────────────────────────────────
const nanoSession = new Map();

// ══════════════════════════════════════════════════════════════════
// NANOEDIT COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'nanobanana',
    alias: ['nanobananav5', 'editing'],
    desc: 'Edit an image with AI (Nano Banana). Reply to image + prompt.',
    category: 'ai',
    react: '🍌',
    filename: __filename
}, async (conn, mek, m, { reply, q, from, sender }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🍌', key: mek.key } });

        let prompt = q;
        let imageUrl = null;

        // ── Get image from replied message ────────────────────
        const quoted = m.quoted?.message;
        if (quoted?.imageMessage) {
            const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);
            imageUrl = await uploadToCDN(buffer);
        }

        // ── If no image, check for URL in prompt or quoted text ──
        if (!imageUrl) {
            const urlMatch = (prompt || '').match(/https?:\/\/\S+/i);
            if (urlMatch) {
                imageUrl = urlMatch[0];
                prompt = prompt.replace(imageUrl, '').trim();
            } else if (quoted?.extendedTextMessage?.text) {
                const murl = quoted.extendedTextMessage.text.match(/https?:\/\/\S+/i);
                if (murl) imageUrl = murl[0];
            }
        }

        // ── Image missing ─────────────────────────────────────
        if (!imageUrl) {
            const errCaption = headerBox('NANO BANANA') + '\n\n' +
                               contentBox([
                                   '⚠️ Image required.',
                                   'Reply to an image or provide an image URL.'
                               ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, NANO_IMG, errCaption);
        }

        // ── Prompt missing ────────────────────────────────────
        if (!prompt) {
            const usageCaption = headerBox('NANO BANANA') + '\n\n' +
                                 contentBox([
                                     'Reply to an image and provide an editing prompt.',
                                     '',
                                     'Example:',
                                     '  .nanobanana Make the outfit black'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, NANO_IMG, usageCaption);
        }

        // ── Save session and ask for model ────────────────────
        nanoSession.set(sender, { prompt, imageUrl });
        setTimeout(() => nanoSession.delete(sender), 120000);

        const modelCaption = headerBox('NANO BANANA') + '\n\n' +
                             contentBox([
                                 `📝 *Prompt:* ${prompt}`,
                                 '',
                                 '✨ Select an editing model:',
                                 '',
                                 '*1* 🍌 Nano Banana',
                                 '*2* 🍌 Nano Banana V2',
                                 '*3* 👑 Nano Banana Pro',
                                 '*4* ⚡ Flux 2 Pro'
                             ]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, NANO_IMG, modelCaption);

    } catch (e) {
        console.error('[NANOBANANA CMD ERROR]', e);
        const errCaption = headerBox('NANO BANANA') + '\n\n' +
                           contentBox(['❌ Unable to process request.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, NANO_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// NUMBER REPLY LISTENER — model selection & processing
// ══════════════════════════════════════════════════════════════════
cmd({
    on: 'body',
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, { sender, body, from }) => {
    try {
        const session = nanoSession.get(sender);
        if (!session) return;

        const input = body.trim();
        const num = parseInt(input);
        if (isNaN(num) || num < 1 || num > 4) return;

        const { prompt, imageUrl } = session;
        let endpoint = '', typeLabel = '';

        if (num === 1) {
            typeLabel = 'Nano Banana';
            endpoint = `https://api.ikyyxd.my.id/edit/nanobanana?image=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`;
        } else if (num === 2) {
            typeLabel = 'Nano Banana V2';
            endpoint = `https://api.ikyyxd.my.id/edit/nanobananav2?prompt=${encodeURIComponent(prompt)}&url=${encodeURIComponent(imageUrl)}`;
        } else if (num === 3) {
            typeLabel = 'Nano Banana Pro';
            endpoint = `https://api.ikyyxd.my.id/edit/nanobananav3?prompt=${encodeURIComponent(prompt)}&url=${encodeURIComponent(imageUrl)}`;
        } else if (num === 4) {
            typeLabel = 'Flux 2 Pro';
            endpoint = `https://api.ikyyxd.my.id/edit/flux2pro?prompt=${encodeURIComponent(prompt)}&url=${encodeURIComponent(imageUrl)}`;
        }

        // ── Animated processing text ───────────────────────────
        const procStages = ['P R O C E S S I N G *', 'P R O C E S S I N G **', 'P R O C E S S I N G ***'];
        const procMsg = await conn.sendMessage(from, { text: procStages[0] }, { quoted: mek });

        let procIdx = 0;
        const procInterval = setInterval(async () => {
            procIdx = (procIdx + 1) % procStages.length;
            try {
                await conn.sendMessage(from, {
                    text: procStages[procIdx],
                    edit: procMsg.key
                });
            } catch (e) {}
        }, 400);

        // ── Call the API ──────────────────────────────────────
        let resultImageUrl;
        try {
            const { data: res } = await axios.get(endpoint, { timeout: 60000 });
            if (!res.status) throw new Error('API returned unsuccessful status');

            // Extract result URL (different models return different structures)
            if (num === 1) resultImageUrl = res.result;
            else if (num === 2) resultImageUrl = res.result.image;
            else resultImageUrl = res.result.result_url;

            if (!resultImageUrl) throw new Error('No result image URL');
        } catch (e) {
            clearInterval(procInterval);
            await conn.sendMessage(from, { delete: procMsg.key });
            nanoSession.delete(sender);
            const errCaption = headerBox('NANO BANANA') + '\n\n' +
                               contentBox(['❌ Editing failed. Try another model.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, NANO_IMG, errCaption);
        }

        // Stop animation & delete it
        clearInterval(procInterval);
        await conn.sendMessage(from, { delete: procMsg.key });

        // ── Send edited image silently (no caption) ────────────
        try {
            const imgBuf = await getBuffer(resultImageUrl);
            await conn.sendMessage(from, {
                image: imgBuf,
                mimetype: 'image/jpeg'
            }, { quoted: mek });
        } catch (e) {
            // If buffer fails, try URL directly
            await conn.sendMessage(from, {
                image: { url: resultImageUrl },
                mimetype: 'image/jpeg'
            }, { quoted: mek });
        }

        nanoSession.delete(sender);

    } catch (e) {
        console.error('[NANOBANANA LISTENER ERROR]', e);
        const errCaption = headerBox('NANO BANANA') + '\n\n' +
                           contentBox(['⚠️ An error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, NANO_IMG, errCaption);
        nanoSession.delete(sender);
    }
});