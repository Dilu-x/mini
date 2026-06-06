// plugins/ACD_MEDIA_TOOLS.js — Image Search, Imagine, Inspect, Meme, Remini, RemoveBG (unified style)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const gis = require('g-i-s');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { uploadImage } = require('../lib/uploadImage');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ᴛᴏᴏʟs';

const TOOLS_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ── Helper: download WhatsApp image buffer ────────────────────────
async function downloadImageBuffer(imageMessage) {
    const stream = await downloadContentFromMessage(imageMessage, 'image');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

// ── Helper: get image URL from quoted/own message ────────────────
async function getImageUrl(conn, mek) {
    const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.imageMessage) {
        const buffer = await downloadImageBuffer(quoted.imageMessage);
        return await uploadImage(buffer);
    }
    if (mek.message?.imageMessage) {
        const buffer = await downloadImageBuffer(mek.message.imageMessage);
        return await uploadImage(buffer);
    }
    return null;
}

// ══════════════════════════════════════════════════════════════════
// 1. IMAGE SEARCH (g-i-s) — silent images, no final message
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'image',
    alias: ['imgsearch', 'gimage'],
    desc: 'Search images on Google. Usage: .image <query>',
    category: 'search',
    react: '📷',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '📷', key: mek.key } });
        if (!q) {
            const usageCaption = headerBox('IMAGE SEARCH') + '\n\n' +
                                 contentBox([
                                     '❏ .image <query>',
                                     '',
                                     'Example: .image cat'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, usageCaption);
        }

        // Animated searching
        const results = await doProcessing(conn, mek, from, () =>
            new Promise((resolve, reject) => {
                gis(q, (error, results) => {
                    if (error) reject(error);
                    else resolve(results || []);
                });
            })
        );

        const imageUrls = results
            .map(r => r.url)
            .filter(url => url && /\.(jpg|jpeg|png|webp)$/i.test(url))
            .slice(0, 5);

        if (!imageUrls.length) {
            const noResCaption = headerBox('IMAGE SEARCH') + '\n\n' +
                                 contentBox([`❌ No valid images found for "${q}"`]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, noResCaption);
        }

        // Send images silently, one by one
        for (const url of imageUrls) {
            try {
                const imgBuf = await getBuffer(url);
                await conn.sendMessage(from, { image: imgBuf, mimetype: 'image/jpeg' }, { quoted: mek });
            } catch (e) {}
            await new Promise(res => setTimeout(res, 500));
        }
        // No final message
    } catch (e) {
        console.error('[IMAGE SEARCH ERROR]', e);
        const errCaption = headerBox('IMAGE SEARCH') + '\n\n' +
                           contentBox([e.message]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TOOLS_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// 2. IMAGINE / FLUX AI — silent image, no caption
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'imagine',
    desc: 'Generate an image using Flux AI. Usage: .imagine <prompt>',
    category: 'ai',
    react: '🎨',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🎨', key: mek.key } });
        if (!q) {
            const usageCaption = headerBox('IMAGINE (FLUX)') + '\n\n' +
                                 contentBox([
                                     '❏ .imagine <prompt>',
                                     '',
                                     'Example: .imagine futuristic city'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, usageCaption);
        }
        if (q.length > 500) {
            const longCaption = headerBox('IMAGINE (FLUX)') + '\n\n' +
                                contentBox(['⚠️ Prompt too long (max 500 chars)']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, longCaption);
        }

        const imageBuffer = await doProcessing(conn, mek, from, async () => {
            const resp = await axios.get(`https://apiskeith.vercel.app/ai/flux?q=${encodeURIComponent(q)}`, {
                responseType: 'arraybuffer',
                timeout: 45000
            });
            return Buffer.from(resp.data);
        });

        // Send image silently
        await conn.sendMessage(from, {
            image: imageBuffer,
            mimetype: 'image/jpeg'
        }, { quoted: mek });
    } catch (e) {
        console.error('[FLUX ERROR]', e);
        const errCaption = headerBox('IMAGINE (FLUX)') + '\n\n' +
                           contentBox([e.message]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TOOLS_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// 3. INSPECT URL — dynamic responses, unified boxes
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'inspect',
    alias: ['fetch', 'urlinspect'],
    desc: 'Inspect a URL. Usage: .inspect <url> [flags]',
    category: 'tools',
    react: '🔍',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });
        if (!q) {
            const usageCaption = headerBox('URL INSPECT') + '\n\n' +
                                 contentBox([
                                     '❏ .inspect <URL> [flags]',
                                     '',
                                     'Flags:',
                                     '  -j : JSON response',
                                     '  -d : Download media',
                                     '  -h : Headers only',
                                     '',
                                     'Example: .inspect https://api.github.com'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, usageCaption);
        }

        const parts = q.split(/\s+/);
        const url = parts[0];
        const flags = parts.slice(1);
        const download = flags.includes('-d');
        const json = flags.includes('-j');
        const headersOnly = flags.includes('-h');

        const response = await doProcessing(conn, mek, from, () =>
            axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)' },
                maxRedirects: flags.includes('-n') ? 0 : 5,
                responseType: download ? 'arraybuffer' : 'text',
                validateStatus: () => true
            })
        );

        const contentType = response.headers['content-type'] || '';

        if (headersOnly) {
            let hdrText = `Status: ${response.status} ${response.statusText}\n`;
            for (const [key, value] of Object.entries(response.headers)) {
                hdrText += `${key}: ${value}\n`;
            }
            const hdrCaption = headerBox('URL INSPECT (HEADERS)') + '\n\n' +
                               contentBox([hdrText]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, hdrCaption);
        }

        if (download && (contentType.includes('audio/') || contentType.includes('video/') || contentType.includes('image/'))) {
            const buffer = Buffer.from(response.data);
            let mediaMsg = {};
            if (contentType.includes('audio/')) mediaMsg = { audio: buffer, mimetype: contentType, fileName: `audio_${Date.now()}.mp3` };
            else if (contentType.includes('video/')) mediaMsg = { video: buffer, mimetype: contentType };
            else mediaMsg = { image: buffer, mimetype: contentType };

            await conn.sendMessage(from, mediaMsg, { quoted: mek });
            return; // silent
        }

        if (json || contentType.includes('application/json')) {
            let jsonData = {};
            try { jsonData = JSON.parse(response.data); } catch (e) {}
            const formattedJson = JSON.stringify(jsonData, null, 2).substring(0, 3000);
            const jsonCaption = headerBox('URL INSPECT (JSON)') + '\n\n' +
                                contentBox([formattedJson]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, jsonCaption);
        }

        if (contentType.includes('text/')) {
            const textCaption = headerBox('URL INSPECT (TEXT)') + '\n\n' +
                                contentBox([response.data.substring(0, 2000)]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, textCaption);
        }

        const genCaption = headerBox('URL INSPECT') + '\n\n' +
                           contentBox([
                               `Status: ${response.status} ${response.statusText}`,
                               `Content-Type: ${contentType}`
                           ]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TOOLS_IMG, genCaption);
    } catch (e) {
        console.error('[INSPECT ERROR]', e);
        const errCaption = headerBox('URL INSPECT') + '\n\n' +
                           contentBox([e.message]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TOOLS_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// 4. MEME — silent image
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'meme',
    alias: ['memes', 'dankmeme'],
    desc: 'Get a random Cheems meme.',
    category: 'fun',
    react: '🎭',
    filename: __filename
}, async (conn, mek, m, { reply, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🎭', key: mek.key } });

        const memeBuffer = await doProcessing(conn, mek, from, () =>
            axios.get('https://shizoapi.onrender.com/api/memes/cheems?apikey=shizo', {
                responseType: 'arraybuffer',
                timeout: 15000
            }).then(res => Buffer.from(res.data))
        );

        await conn.sendMessage(from, {
            image: memeBuffer,
            mimetype: 'image/jpeg'
        }, { quoted: mek });
    } catch (e) {
        console.error('[MEME ERROR]', e);
        const errCaption = headerBox('MEME') + '\n\n' +
                           contentBox([e.message]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TOOLS_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// 5. REMINI (AI Enhancement) — silent enhanced image
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'remini',
    alias: ['ai-enhance'],
    desc: 'Enhance image quality using AI. Reply to image or provide URL.',
    category: 'tools',
    react: '✨',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '✨', key: mek.key } });
        let imageUrl;
        if (q && q.startsWith('http')) {
            imageUrl = q;
        } else {
            imageUrl = await getImageUrl(conn, mek);
        }
        if (!imageUrl) {
            const usageCaption = headerBox('REMINI') + '\n\n' +
                                 contentBox(['❌ Reply to an image or provide a URL.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, usageCaption);
        }

        const enhancedBuffer = await doProcessing(conn, mek, from, async () => {
            const { data } = await axios.get(`https://api.princetechn.com/api/tools/remini?apikey=prince&url=${encodeURIComponent(imageUrl)}`, {
                timeout: 60000
            });
            if (!data?.success || !data?.result?.image_url) throw new Error('Invalid API response');
            const resp = await axios.get(data.result.image_url, { responseType: 'arraybuffer' });
            return Buffer.from(resp.data);
        });

        await conn.sendMessage(from, {
            image: enhancedBuffer,
            mimetype: 'image/jpeg'
        }, { quoted: mek });
    } catch (e) {
        console.error('[REMINI ERROR]', e);
        const errCaption = headerBox('REMINI') + '\n\n' +
                           contentBox([e.message]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TOOLS_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// 6. REMOVE BACKGROUND — silent image
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'removebg',
    alias: ['rmbg', 'nobg'],
    desc: 'Remove background from image. Reply to image or provide URL.',
    category: 'tools',
    react: '✂️',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '✂️', key: mek.key } });
        let imageUrl;
        if (q && q.startsWith('http')) {
            imageUrl = q;
        } else {
            imageUrl = await getImageUrl(conn, mek);
        }
        if (!imageUrl) {
            const usageCaption = headerBox('REMOVE BG') + '\n\n' +
                                 contentBox(['❌ Reply to an image or provide a URL.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, usageCaption);
        }

        const resultBuffer = await doProcessing(conn, mek, from, async () => {
            const resp = await axios.get(`https://api.siputzx.my.id/api/iloveimg/removebg?image=${encodeURIComponent(imageUrl)}`, {
                responseType: 'arraybuffer',
                timeout: 30000
            });
            return Buffer.from(resp.data);
        });

        await conn.sendMessage(from, {
            image: resultBuffer,
            mimetype: 'image/png'
        }, { quoted: mek });
    } catch (e) {
        console.error('[REMOVEBG ERROR]', e);
        const errCaption = headerBox('REMOVE BG') + '\n\n' +
                           contentBox([e.message]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TOOLS_IMG, errCaption);
    }
});