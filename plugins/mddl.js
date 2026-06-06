// plugins/ACD_MEDIAFIRE.js — MediaFire Downloader (same style as SONG)
const { cmd } = require('../command');
const axios = require('axios');
const { getBuffer } = require('../lib/functions');

// ══════════════════════════════════════════════════════════════════
// CONFIG (same as your SONG plugin)
// ══════════════════════════════════════════════════════════════════
const config = require('../config');
const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ꜰɪʟᴇ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ';

const MF_IMG_URL = 'https://shyra.edgeone.app/bot-img.jpg'; // same image

// ── Helper: Send image + caption, fallback to text ────────────────
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

// ── Header box (exactly like song plugin) ────────────────────────
function headerBox(platform) {
    const top    = '*┏━━━━━━━━━━━━━━✦*';
    const bot    = `*┃ \`Bot Name :\` ${BOT_NAME}*`;
    const time   = getDateTimeLine();
    const plat   = `*┃ \`Platform :\` ${platform}*`;
    const bottom = '*┗━━━━━━━━━━━━━━✦*';
    return `${top}\n${bot}\n${time}\n${plat}\n${bottom}`;
}

// ══════════════════════════════════════════════════════════════════
// MEDIAFIRE COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'mediafire',
    alias: ['mf', 'mfdl'],
    desc: 'Download MediaFire files directly to WhatsApp',
    category: 'download',
    react: '📁',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '📁', key: mek.key } });

        // ── Usage message with image ────────────────────────────
        if (!q) {
            const usageCaption = headerBox('MEDIAFIRE DOWNLOADER') + '\n\n' +
                                 '❏ .mediafire <MediaFire URL>\n\n' +
                                 '🔗 Example:\n' +
                                 '  .mediafire https://www.mediafire.com/file/xxxx\n\n' +
                                 FOOTER;
            return await sendWithImage(conn, from, mek, MF_IMG_URL, usageCaption);
        }

        const url = q.split(' ')[0].trim();
        if (!url.includes('mediafire.com')) {
            const invalidCaption = headerBox('INVALID URL') + '\n\n' +
                                   '⚠️ Please provide a valid MediaFire link.\n\n' +
                                   FOOTER;
            return await sendWithImage(conn, from, mek, MF_IMG_URL, invalidCaption);
        }

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

        // ── Call API in background ──────────────────────────────
        let apiResult;
        try {
            const { data } = await axios.get('https://api-varhad.my.id/download/mediafire', {
                params: { url }
            });
            apiResult = data;
        } catch (e) {
            clearInterval(fetchInterval);
            await conn.sendMessage(from, { delete: fetchMsg.key });
            const errCaption = headerBox('NETWORK ERROR') + '\n\n' +
                               'Unable to contact the download server.\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, MF_IMG_URL, errCaption);
        }

        // Stop animation & remove it
        clearInterval(fetchInterval);
        await conn.sendMessage(from, { delete: fetchMsg.key });

        // ── Validate API response ──────────────────────────────
        if (!apiResult.status || !apiResult.result) {
            const failCaption = headerBox('DOWNLOAD FAILED') + '\n\n' +
                                '❌ Unable to retrieve file info. Check the URL or try again.\n\n' +
                                FOOTER;
            return await sendWithImage(conn, from, mek, MF_IMG_URL, failCaption);
        }

        const { filename, filetype, filesize, uploaded, download } = apiResult.result;

        // ── File info with image (no success message after file) ──
        const infoCaption = headerBox('MEDIAFIRE FILE') + '\n\n' +
                            `📄 *File Name:* ${filename}\n` +
                            `📋 *Type:* ${filetype}\n` +
                            `📦 *Size:* ${filesize}\n` +
                            `📅 *Uploaded:* ${uploaded}\n\n` +
                            '🚀 Sending file now...\n\n' +
                            FOOTER;
        await sendWithImage(conn, from, mek, MF_IMG_URL, infoCaption);

        // ── Send the document ──────────────────────────────────
        await conn.sendMessage(from, {
            document: { url: download },
            fileName: filename,
            mimetype: filetype || 'application/octet-stream'
        }, { quoted: mek });

        // No further message – done

    } catch (e) {
        console.error('[MEDIAFIRE ERROR]', e);
        const errCaption = headerBox('SYSTEM ERROR') + '\n\n' +
                           'An unexpected error occurred.\n' +
                           'Please try again later.\n\n' +
                           FOOTER;
        await sendWithImage(conn, from, mek, MF_IMG_URL, errCaption);
    }
});