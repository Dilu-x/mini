// plugins/ACD_IMAGE_TOOLS.js — Unified Image Enhancers (HD, Remini, RemoveBG) 
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const mime = require('mime-types');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ɪᴍᴀɢᴇ ᴛᴏᴏʟs';

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

// ── Upload buffer to CDN ─────────────────────────────────────────
async function uploadToCDN(buffer) {
    const form = new FormData();
    form.append('file', Readable.from(buffer), {
        filename: 'image.jpg',
        contentType: mime.lookup('jpg') || 'image/jpeg'
    });
    const { data } = await axios.post('https://cdnn.ikyyxd.my.id/api/upload.php', form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    });
    if (!data?.success) throw new Error('CDN upload failed');
    return data.url;
}

// ── Extract final image buffer from API response ─────────────────
async function extractImageBuffer(response) {
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('image')) {
        return Buffer.from(response.data);
    }
    // Assume JSON with a URL
    const json = JSON.parse(Buffer.from(response.data).toString('utf-8'));
    const imageUrl = json.url || json.result_url || json.result || json.image;
    if (!imageUrl) throw new Error('No image URL in response');
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    return Buffer.from(imgRes.data);
}

// ── Common error message sender ──────────────────────────────────
async function sendError(conn, from, mek, platform, message) {
    const errCaption = headerBox(platform) + '\n\n' +
                       contentBox([message]) + '\n\n' + FOOTER;
    await sendWithImage(conn, from, mek, TOOLS_IMG, errCaption);
}

// ══════════════════════════════════════════════════════════════════
//  HD STANDARD
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'hd',
    alias: ['enhancehd', 'imagehd'],
    desc: 'Enhance image using HD (standard)',
    category: 'tools',
    react: '🖼️',
    filename: __filename
}, async (conn, mek, m) => {
    const { from } = m;
    try {
        await conn.sendMessage(from, { react: { text: '🖼️', key: mek.key } });

        const imageMsg = m.quoted?.message?.imageMessage;
        if (!imageMsg) return sendError(conn, from, mek, 'HD STANDARD', '❌ Please reply to an image.');

        // Animated processing + upload + API call
        const finalBuffer = await doProcessing(conn, mek, from, async () => {
            const stream = await downloadContentFromMessage(imageMsg, 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);
            const publicUrl = await uploadToCDN(buffer);
            const apiResponse = await axios.get('https://v2.api-varhad.my.id/tools/hd?imageUrl=' + encodeURIComponent(publicUrl), {
                responseType: 'arraybuffer',
                timeout: 60000
            });
            return extractImageBuffer(apiResponse);
        });

        // Send enhanced image silently
        await conn.sendMessage(from, { image: finalBuffer, mimetype: 'image/jpeg' }, { quoted: mek });
    } catch (e) {
        console.error('[HD ERROR]', e);
        sendError(conn, from, mek, 'HD STANDARD', 'Unable to process HD enhancement.');
    }
});

// ══════════════════════════════════════════════════════════════════
//  HD PREMIUM v2
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'hdv2',
    alias: ['enhancehd2'],
    desc: 'Enhance image using HD v2 (premium)',
    category: 'tools',
    react: '🎯',
    filename: __filename
}, async (conn, mek, m) => {
    const { from } = m;
    try {
        await conn.sendMessage(from, { react: { text: '🎯', key: mek.key } });

        const imageMsg = m.quoted?.message?.imageMessage;
        if (!imageMsg) return sendError(conn, from, mek, 'HD PREMIUM V2', '❌ Please reply to an image.');

        const finalBuffer = await doProcessing(conn, mek, from, async () => {
            const stream = await downloadContentFromMessage(imageMsg, 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);
            const publicUrl = await uploadToCDN(buffer);
            const apiResponse = await axios.get('https://v2.api-varhad.my.id/image/hdv2?imageUrl=' + encodeURIComponent(publicUrl), {
                responseType: 'arraybuffer',
                timeout: 60000
            });
            return extractImageBuffer(apiResponse);
        });

        await conn.sendMessage(from, { image: finalBuffer, mimetype: 'image/jpeg' }, { quoted: mek });
    } catch (e) {
        console.error('[HDv2 ERROR]', e);
        sendError(conn, from, mek, 'HD PREMIUM V2', 'Unable to process HD v2 enhancement.');
    }
});

// ══════════════════════════════════════════════════════════════════
//  REMINI AI
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'remini',
    alias: ['enhanceremini', 'airemini'],
    desc: 'Enhance image using Remini (AI)',
    category: 'tools',
    react: '🤖',
    filename: __filename
}, async (conn, mek, m) => {
    const { from } = m;
    try {
        await conn.sendMessage(from, { react: { text: '🤖', key: mek.key } });

        const imageMsg = m.quoted?.message?.imageMessage;
        if (!imageMsg) return sendError(conn, from, mek, 'REMINI AI', '❌ Please reply to an image.');

        const finalBuffer = await doProcessing(conn, mek, from, async () => {
            const stream = await downloadContentFromMessage(imageMsg, 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);
            const publicUrl = await uploadToCDN(buffer);
            const apiResponse = await axios.get('https://v2.api-varhad.my.id/tools/remini?imageUrl=' + encodeURIComponent(publicUrl), {
                responseType: 'arraybuffer',
                timeout: 60000
            });
            return extractImageBuffer(apiResponse);
        });

        await conn.sendMessage(from, { image: finalBuffer, mimetype: 'image/jpeg' }, { quoted: mek });
    } catch (e) {
        console.error('[REMINI ERROR]', e);
        sendError(conn, from, mek, 'REMINI AI', 'Remini enhancement failed.');
    }
});

// ══════════════════════════════════════════════════════════════════
//  REMOVE BG (standard)
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'removebgv2',
    alias: ['nobg', 'rmbg'],
    desc: 'Remove background from image',
    category: 'tools',
    react: '✂️',
    filename: __filename
}, async (conn, mek, m) => {
    const { from } = m;
    try {
        await conn.sendMessage(from, { react: { text: '✂️', key: mek.key } });

        const imageMsg = m.quoted?.message?.imageMessage;
        if (!imageMsg) return sendError(conn, from, mek, 'REMOVE BG', '❌ Please reply to an image.');

        const finalBuffer = await doProcessing(conn, mek, from, async () => {
            const stream = await downloadContentFromMessage(imageMsg, 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);
            const publicUrl = await uploadToCDN(buffer);
            const apiResponse = await axios.get('https://v2.api-varhad.my.id/tools/removebg?imageUrl=' + encodeURIComponent(publicUrl), {
                responseType: 'arraybuffer',
                timeout: 60000
            });
            return extractImageBuffer(apiResponse);
        });

        await conn.sendMessage(from, { image: finalBuffer, mimetype: 'image/png' }, { quoted: mek });
    } catch (e) {
        console.error('[RemoveBGv2 ERROR]', e);
        sendError(conn, from, mek, 'REMOVE BG', 'Background removal failed.');
    }
});

// ══════════════════════════════════════════════════════════════════
//  REMOVE BG PRO (v3)
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'removebgv3',
    alias: ['nobg2', 'rmbgv2'],
    desc: 'Remove background (premium) from image',
    category: 'tools',
    react: '🎭',
    filename: __filename
}, async (conn, mek, m) => {
    const { from } = m;
    try {
        await conn.sendMessage(from, { react: { text: '🎭', key: mek.key } });

        const imageMsg = m.quoted?.message?.imageMessage;
        if (!imageMsg) return sendError(conn, from, mek, 'REMOVE BG PRO', '❌ Please reply to an image.');

        const finalBuffer = await doProcessing(conn, mek, from, async () => {
            const stream = await downloadContentFromMessage(imageMsg, 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);
            const publicUrl = await uploadToCDN(buffer);
            const apiResponse = await axios.get('https://v2.api-varhad.my.id/image/removebgv2?imageUrl=' + encodeURIComponent(publicUrl), {
                responseType: 'arraybuffer',
                timeout: 60000
            });
            return extractImageBuffer(apiResponse);
        });

        await conn.sendMessage(from, { image: finalBuffer, mimetype: 'image/png' }, { quoted: mek });
    } catch (e) {
        console.error('[RemoveBGv3 ERROR]', e);
        sendError(conn, from, mek, 'REMOVE BG PRO', 'Premium background removal failed.');
    }
});