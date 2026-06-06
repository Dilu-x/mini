// plugins/ACD_APK.js — APK Downloader (unified box style, silent delivery)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ᴀᴘᴋ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ';

const APK_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ── Cooldown map ─────────────────────────────────────────────────
const cooldownMap = new Map();

// ══════════════════════════════════════════════════════════════════
// APK DOWNLOAD COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'apk',
    alias: ['apkdl', 'getapk', 'downloadapk'],
    desc: 'Download an APK from Aptoide. Usage: .apk <app name>',
    category: 'download',
    react: '📱',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '📱', key: mek.key } });

        if (!q) {
            const usageCaption = headerBox('APK DOWNLOADER') + '\n\n' +
                                 contentBox([
                                     '❏ .apk <app name>',
                                     '',
                                     'Example:',
                                     '  .apk WhatsApp'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, APK_IMG, usageCaption);
        }

        // Cooldown check
        const lastTime = cooldownMap.get(from);
        if (lastTime && Date.now() - lastTime < 5000) {
            const remaining = Math.ceil((5000 - (Date.now() - lastTime)) / 1000);
            const coolCaption = headerBox('APK DOWNLOADER') + '\n\n' +
                                contentBox([`⏳ Please wait ${remaining}s before another request.`]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, APK_IMG, coolCaption);
        }
        cooldownMap.set(from, Date.now());

        // ── Animated searching text ──────────────────────────────
        const searchStages = ['sᴇᴀʀᴄʜɪɴɢ *', 'sᴇᴀʀᴄʜɪɴɢ **', 'sᴇᴀʀᴄʜɪɴɢ ***'];
        const searchMsg = await conn.sendMessage(from, { text: searchStages[0] }, { quoted: mek });

        let stageIdx = 0;
        const searchInterval = setInterval(async () => {
            stageIdx = (stageIdx + 1) % searchStages.length;
            try {
                await conn.sendMessage(from, { text: searchStages[stageIdx], edit: searchMsg.key });
            } catch (e) {}
        }, 400);

        // Call Aptoide API
        let app;
        try {
            const apiUrl = `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(q)}/limit=10`;
            const { data } = await axios.get(apiUrl, {
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (!data?.datalist?.list?.length) throw new Error('NOT_FOUND');
            app = data.datalist.list[0];
        } catch (e) {
            clearInterval(searchInterval);
            await conn.sendMessage(from, { delete: searchMsg.key });
            cooldownMap.delete(from);
            const errCaption = headerBox('APK DOWNLOADER') + '\n\n' +
                               contentBox([`❌ No results for "${q}". Try different keywords.`]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, APK_IMG, errCaption);
        }

        // Stop animation & delete it
        clearInterval(searchInterval);
        await conn.sendMessage(from, { delete: searchMsg.key });

        // Validate download link
        if (!app.file?.path_alt) {
            cooldownMap.delete(from);
            const noLinkCaption = headerBox('APK DOWNLOADER') + '\n\n' +
                                  contentBox(['❌ Download link missing for this app.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, APK_IMG, noLinkCaption);
        }

        // Optional file size check
        try {
            const head = await axios.head(app.file.path_alt, { timeout: 10000 });
            const fileSize = head.headers['content-length'];
            if (fileSize && parseInt(fileSize) > 100 * 1024 * 1024) {
                const sizeMB = (parseInt(fileSize) / (1024 * 1024)).toFixed(2);
                const sizeCaption = headerBox('APK DOWNLOADER') + '\n\n' +
                                    contentBox([`❌ APK size too large (${sizeMB} MB). Max 100 MB.`]) + '\n\n' + FOOTER;
                return await sendWithImage(conn, from, mek, APK_IMG, sizeCaption);
            }
        } catch (_) { /* ignore */ }

        // ── Send APK silently (no caption) ──────────────────────
        await conn.sendMessage(from, {
            document: { url: app.file.path_alt },
            fileName: `${(app.name || 'app').replace(/[^a-zA-Z0-9]/g, '_')}.apk`,
            mimetype: 'application/vnd.android.package-archive',
            // no caption
            contextInfo: {
                externalAdReply: {
                    title: app.name || 'APK Download',
                    body: `Rating: ${app.rating ? app.rating.toFixed(1) : 'N/A'} | Size: ${app.size ? (app.size/(1024*1024)).toFixed(2) : '?'} MB`,
                    mediaType: 1,
                    thumbnailUrl: app.icon || '',
                    sourceUrl: app.file.path_alt,
                    renderLargerThumbnail: true,
                    showAdAttribution: false
                }
            }
        }, { quoted: mek });

        // Only a react, no success message
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (error) {
        console.error('[APK ERROR]', error);
        cooldownMap.delete(from);

        let errorTitle = 'APK DOWNLOADER';
        let errorMsg = 'An unexpected error occurred.';
        if (error.code === 'ECONNABORTED') errorMsg = 'Request timed out. Please try again.';
        else if (error.response?.status === 404) errorMsg = 'Aptoide endpoint not found.';
        else if (error.response?.status >= 500) errorMsg = 'Aptoide server error. Please try later.';
        else if (error.code === 'ENOTFOUND') errorMsg = 'Network error. Check your connection.';

        const errCaption = headerBox(errorTitle) + '\n\n' +
                           contentBox([errorMsg]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, APK_IMG, errCaption);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    }
});