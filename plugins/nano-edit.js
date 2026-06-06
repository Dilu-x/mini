// plugins/ACD_NANOEDIT.js — Nano Banana (unified box style, no final message)
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

// ── Upload buffer to CDN ─────────────────────────────────────────
async function uploadBufferToCDN(buffer) {
    const form = new FormData();
    form.append('file', Readable.from(buffer), {
        filename: 'img.jpg',
        contentType: mime.lookup('jpg') || 'image/jpeg'
    });
    const { data } = await axios.post('https://cdnn.ikyyxd.my.id/api/upload.php', form, {
        headers: form.getHeaders()
    });
    return data.url;
}

// ── Session store ─────────────────────────────────────────────────
const nanoSession = new Map();

// ══════════════════════════════════════════════════════════════════
// NANOEDIT COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'nanoedit',
    alias: ['nanobanana', 'bananaedit', 'nano', 'editimg'],
    desc: 'Edit an image with AI (Nano Banana v3). Reply to an image + prompt.',
    category: 'ai',
    react: '🍌',
    filename: __filename
}, async (conn, mek, m, { reply, q, from, sender }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🍌', key: mek.key } });

        let prompt = q;
        let imageUrl = null;

        // Check for replied image
        const quoted = m.quoted?.message;
        if (quoted?.imageMessage) {
            const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);
            imageUrl = await uploadBufferToCDN(buffer);
        }

        // Check for URL in prompt if no replied image
        if (!imageUrl) {
            const urlMatch = (prompt || '').match(/https?:\/\/\S+/i);
            if (urlMatch) {
                imageUrl = urlMatch[0];
                prompt = prompt.replace(imageUrl, '').trim();
            }
        }

        // ── Image missing ──────────────────────────────────────
        if (!imageUrl) {
            const errCaption = headerBox('NANO BANANA') + '\n\n' +
                               contentBox([
                                   '⚠️ Image required.',
                                   'Reply to an image or provide an image URL.'
                               ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, NANO_IMG, errCaption);
        }

        // ── Prompt missing ─────────────────────────────────────
        if (!prompt) {
            const usageCaption = headerBox('NANO BANANA') + '\n\n' +
                                 contentBox([
                                     'Please reply to an image and provide a prompt.',
                                     '',
                                     'Example:',
                                     '  .nanoedit Make it cinematic'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, NANO_IMG, usageCaption);
        }

        // Save session and ask for engine
        nanoSession.set(sender, {
            stage: 'select_engine',
            prompt,
            imageUrl
        });
        setTimeout(() => nanoSession.delete(sender), 120000);

        // Engine selection caption
        const engineCaption = headerBox('NANO BANANA') + '\n\n' +
                              contentBox([
                                  `📝 *Prompt:* ${prompt}`,
                                  '',
                                  '🎨 Select an AI Engine:',
                                  '',
                                  '*1* ⚡ Flux AI',
                                  '*2* 🍌 Nano AI',
                                  '*3* 🟡 Banana AI',
                                  '*4* 🎲 Standard AI'
                              ]) + '\n\n' + FOOTER;

        // Send the uploaded image with engine selection caption
        try {
            const imgBuf = await getBuffer(imageUrl);
            await conn.sendMessage(from, {
                image: imgBuf,
                caption: engineCaption,
                mimetype: 'image/jpeg'
            }, { quoted: mek });
        } catch (e) {
            // fallback: send caption as text
            await reply(engineCaption);
        }

    } catch (e) {
        console.error('[NANOEDIT CMD ERROR]', e);
        const errCaption = headerBox('NANO BANANA') + '\n\n' +
                           contentBox(['❌ Unable to process request.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, NANO_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// NUMBER REPLY LISTENER – engine & version selection
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

        // ── Stage 1: Select engine ─────────────────────────────
        if (session.stage === 'select_engine') {
            const num = parseInt(input);
            if (isNaN(num) || num < 1 || num > 4) return;

            const engines = ['flux', 'nano', 'banana', 'default'];
            session.engine = engines[num - 1];
            session.stage = 'select_version';
            nanoSession.set(sender, session);

            const versionCaption = headerBox('NANO BANANA') + '\n\n' +
                                   contentBox([
                                       '✨ Choose a version:',
                                       '',
                                       '*1* V1',
                                       '*2* V2',
                                       '*3* V3'
                                   ]) + '\n\n' + FOOTER;
            await sendWithImage(conn, from, mek, NANO_IMG, versionCaption);
            return;
        }

        // ── Stage 2: Select version ───────────────────────────
        if (session.stage === 'select_version') {
            const num = parseInt(input);
            if (isNaN(num) || num < 1 || num > 3) return;

            session.version = num;
            session.stage = 'processing';
            nanoSession.set(sender, session);

            // ── Animated processing text ───────────────────────
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

            // ── Call API ─────────────────────────────────────
            const { prompt, imageUrl } = session;
            const apiUrl = `https://api.ikyyxd.my.id/edit/nanobananav3?prompt=${encodeURIComponent(prompt)}&url=${encodeURIComponent(imageUrl)}`;
            let resultUrl;
            try {
                const { data } = await axios.get(apiUrl, { timeout: 60000 });
                if (!data.status) throw new Error('API returned unsuccessful status');
                resultUrl = data.result?.image || data.result?.result_url || data.result;
                if (!resultUrl) throw new Error('No image URL in response');
            } catch (e) {
                clearInterval(procInterval);
                await conn.sendMessage(from, { delete: procMsg.key });
                nanoSession.delete(sender);
                const errCaption = headerBox('NANO BANANA') + '\n\n' +
                                   contentBox(['❌ Generation failed. Please try again.']) + '\n\n' + FOOTER;
                return await sendWithImage(conn, from, mek, NANO_IMG, errCaption);
            }

            // Stop animation & delete it
            clearInterval(procInterval);
            await conn.sendMessage(from, { delete: procMsg.key });

            // ── Send edited image (no caption, no success message) ──
            try {
                const imgBuf = await getBuffer(resultUrl);
                await conn.sendMessage(from, {
                    image: imgBuf,
                    mimetype: 'image/jpeg'
                }, { quoted: mek });
            } catch (e) {
                // fallback: send as URL text? rare case, but just ignore
            }

            nanoSession.delete(sender);
            return;
        }

    } catch (e) {
        console.error('[NANOEDIT LISTENER ERROR]', e);
        const errCaption = headerBox('NANO BANANA') + '\n\n' +
                           contentBox(['⚠️ An error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, NANO_IMG, errCaption);
        nanoSession.delete(sender);
    }
});