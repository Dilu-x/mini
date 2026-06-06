// plugins/ACD_UPSCALE.js — Image Upscaler (unified box style, no final message)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const mime = require('mime-types');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ɪᴍᴀɢᴇ ᴜᴘsᴄᴀʟᴇʀ';

const UPSCALE_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ── Upload buffer to CDN (for public URL) ─────────────────────────
async function uploadToCDN(buffer) {
    const form = new FormData();
    form.append('file', Readable.from(buffer), {
        filename: 'upscale.jpg',
        contentType: mime.lookup('jpg') || 'image/jpeg'
    });
    const { data } = await axios.post('https://cdnn.ikyyxd.my.id/api/upload.php', form, {
        headers: form.getHeaders()
    });
    return data.url;
}

// ── Session store ─────────────────────────────────────────────────
const upscaleSession = new Map();

// ══════════════════════════════════════════════════════════════════
// UPSCALE COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'upscale',
    alias: ['hd', 'HD', 'Hd', 'enhance', 'remini'],
    desc: 'Enhance image quality using AI. Reply to an image.',
    category: 'tools',
    react: '🖼️',
    filename: __filename
}, async (conn, mek, m, { reply, from, sender }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🖼️', key: mek.key } });

        const quoted = m.quoted?.message;
        const imageMsg = quoted?.imageMessage;

        if (!imageMsg) {
            const usageCaption = headerBox('IMAGE UPSCALER') + '\n\n' +
                                 contentBox([
                                     'Reply to an image to enhance its quality.',
                                     '',
                                     'Example:',
                                     '  .upscale (reply to an image)'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, UPSCALE_IMG, usageCaption);
        }

        // Download image and upload to CDN
        const stream = await downloadContentFromMessage(imageMsg, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        const imageUrl = await uploadToCDN(buffer);

        // Save session and ask for server
        upscaleSession.set(sender, { imageUrl });
        setTimeout(() => upscaleSession.delete(sender), 120000);

        const engineCaption = headerBox('IMAGE UPSCALER') + '\n\n' +
                              contentBox([
                                  '🖼️ Image detected.',
                                  '',
                                  '⚡ Select an upscale engine:',
                                  '',
                                  '*1* ⚡ Flux HD',
                                  '*2* 🚀 Ultra HD',
                                  '*3* ✨ Premium 4K'
                              ]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, UPSCALE_IMG, engineCaption);

    } catch (e) {
        console.error('[UPSCALE CMD ERROR]', e);
        const errCaption = headerBox('IMAGE UPSCALER') + '\n\n' +
                           contentBox(['❌ Unable to process request.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, UPSCALE_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// NUMBER REPLY LISTENER – server selection & processing
// ══════════════════════════════════════════════════════════════════
cmd({
    on: 'body',
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, { sender, body, from }) => {
    try {
        const session = upscaleSession.get(sender);
        if (!session) return;

        const input = body.trim();
        if (input !== '1' && input !== '2' && input !== '3') return;

        const { imageUrl } = session;
        let type = '';
        let apiUrl = '';

        if (input === '1') {
            type = 'Flux HD';
            apiUrl = `https://api.ikyyxd.my.id/tools/upscale?url=${encodeURIComponent(imageUrl)}`;
        } else if (input === '2') {
            type = 'Ultra HD';
            apiUrl = `https://api.lexcode.biz.id/api/tools/upscale?url=${encodeURIComponent(imageUrl)}`;
        } else if (input === '3') {
            type = 'Premium 4K';
            apiUrl = `https://api.zenzxz.my.id/tools/upscale?url=${encodeURIComponent(imageUrl)}&scale=4`;
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

        // ── Call API ───────────────────────────────────────────
        let resultUrl;
        try {
            const { data } = await axios.get(apiUrl, { timeout: 60000 });

            if (input === '1') {
                if (!data?.status || !data?.result?.upscale) throw new Error('Upscale failed');
                resultUrl = data.result.upscale;
            } else if (input === '2') {
                if (!data?.success || !data?.result) throw new Error('Upscale failed');
                resultUrl = data.result;
            } else if (input === '3') {
                resultUrl = apiUrl; // API may return image directly
            }
        } catch (e) {
            clearInterval(procInterval);
            await conn.sendMessage(from, { delete: procMsg.key });
            upscaleSession.delete(sender);
            const errCaption = headerBox('IMAGE UPSCALER') + '\n\n' +
                               contentBox(['❌ Upscale failed. Try another engine.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, UPSCALE_IMG, errCaption);
        }

        // Stop animation & delete it
        clearInterval(procInterval);
        await conn.sendMessage(from, { delete: procMsg.key });

        if (!resultUrl) {
            upscaleSession.delete(sender);
            const errCaption = headerBox('IMAGE UPSCALER') + '\n\n' +
                               contentBox(['❌ No result image.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, UPSCALE_IMG, errCaption);
        }

        // ── Send upscaled image silently (no caption) ──────────
        try {
            const imgBuf = await getBuffer(resultUrl);
            await conn.sendMessage(from, {
                image: imgBuf,
                mimetype: 'image/jpeg'
            }, { quoted: mek });
        } catch (e) {
            // If direct buffer fails, try sending URL as fallback
            await conn.sendMessage(from, {
                image: { url: resultUrl },
                mimetype: 'image/jpeg'
            }, { quoted: mek });
        }

        upscaleSession.delete(sender);

    } catch (e) {
        console.error('[UPSCALE LISTENER ERROR]', e);
        const errCaption = headerBox('IMAGE UPSCALER') + '\n\n' +
                           contentBox(['❌ An error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, UPSCALE_IMG, errCaption);
        upscaleSession.delete(sender);
    }
});