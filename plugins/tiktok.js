// plugins/ACD_TIKTOK.js — TikTok Downloader (unified box style, no final message)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ᴛɪᴋᴛᴏᴋ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ';

const TIKTOK_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ── Session store ─────────────────────────────────────────────────
const tiktokSession = new Map();

// ══════════════════════════════════════════════════════════════════
// TIKTOK COMMAND — starts the version picker
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'tiktok',
    alias: ['tt', 'ttdl'],
    desc: 'Download TikTok video/audio. Usage: .tiktok <url>',
    category: 'download',
    react: '🎬',
    filename: __filename
}, async (conn, mek, m, { reply, q, from, sender }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🎬', key: mek.key } });

        if (!q) {
            const usageCaption = headerBox('TIKTOK DOWNLOADER') + '\n\n' +
                                 contentBox([
                                     '❏ .tiktok <TikTok URL>',
                                     '',
                                     'Example:',
                                     '  .tiktok https://vt.tiktok.com/abc'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TIKTOK_IMG, usageCaption);
        }

        const url = q.split(' ')[0].trim();
        if (!url.startsWith('http')) {
            const invalidCaption = headerBox('TIKTOK DOWNLOADER') + '\n\n' +
                                   contentBox(['⚠️ Please provide a valid TikTok URL.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TIKTOK_IMG, invalidCaption);
        }

        tiktokSession.set(sender, { url });
        setTimeout(() => tiktokSession.delete(sender), 120000);

        const versionCaption = headerBox('TIKTOK DOWNLOADER') + '\n\n' +
                               contentBox([
                                   '🔗 Link ready. Select API version:',
                                   '',
                                   '*1* ✨ V1 (Support Slide)',
                                   '*2* ✨ V2 (Support Slide)',
                                   '*3* ✨ V3 (No Slide)',
                                   '*4* ✨ V4 (Audio + Video)',
                                   '',
                                   'Reply with 1, 2, 3, or 4.'
                               ]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TIKTOK_IMG, versionCaption);

    } catch (e) {
        console.error('[TIKTOK CMD ERROR]', e);
        const errCaption = headerBox('TIKTOK DOWNLOADER') + '\n\n' +
                           contentBox(['❌ An unexpected error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TIKTOK_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// NUMBER REPLY LISTENER — version selection & download
// ══════════════════════════════════════════════════════════════════
cmd({
    on: 'body',
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, { sender, body, from }) => {
    try {
        const session = tiktokSession.get(sender);
        if (!session) return;

        const input = body.trim();
        const versionNum = parseInt(input);
        if (isNaN(versionNum) || versionNum < 1 || versionNum > 4) return;

        const { url } = session;
        const version = ['v1', 'v2', 'v3', 'v4'][versionNum - 1];
        tiktokSession.delete(sender);

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

        let downloadSuccess = false;

        try {
            // ── V4 (Audio + Video) ──────────────────────────────
            if (version === 'v4') {
                const { data } = await axios.get('https://tikdown.ikyzxz.my.id/api/v1', { params: { url } });
                if (!data.status) throw new Error('Download V4 failed');
                const res = data;

                if (res.download?.nowm) {
                    await conn.sendMessage(from, {
                        video: { url: res.download.nowm },
                        mimetype: 'video/mp4'
                    }, { quoted: mek });
                    downloadSuccess = true;
                } else if (res.download?.wm) {
                    await conn.sendMessage(from, {
                        video: { url: res.download.wm },
                        mimetype: 'video/mp4'
                    }, { quoted: mek });
                    downloadSuccess = true;
                }

                if (res.download?.mp3) {
                    await conn.sendMessage(from, {
                        audio: { url: res.download.mp3 },
                        mimetype: 'audio/mpeg',
                        fileName: 'tiktok.mp3',
                        ptt: false
                    }, { quoted: mek });
                    downloadSuccess = true;
                }
            }

            // ── V1 (Supports slides) ────────────────────────────
            else if (version === 'v1') {
                const { data } = await axios.get('https://api.ikyyxd.my.id/download/tiktok', {
                    params: { apikey: 'kyzz', query: url }
                });
                if (!data.status) throw new Error('Download V1 failed');
                const res = data.result;

                if (res.video) {
                    await conn.sendMessage(from, {
                        video: { url: res.video },
                        mimetype: 'video/mp4'
                    }, { quoted: mek });
                    downloadSuccess = true;
                }

                if (res.slides?.length) {
                    for (const slide of res.slides) {
                        await conn.sendMessage(from, {
                            image: { url: slide.img_result },
                            mimetype: 'image/jpeg'
                        }, { quoted: mek });
                    }
                    downloadSuccess = true;
                }

                if (res.audio) {
                    await conn.sendMessage(from, {
                        audio: { url: res.audio },
                        mimetype: 'audio/mpeg',
                        fileName: 'tiktok_audio.mp3',
                        ptt: false
                    }, { quoted: mek });
                    downloadSuccess = true;
                }
            }

            // ── V2 (Supports slides) ────────────────────────────
            else if (version === 'v2') {
                const { data } = await axios.get('https://api.ikyyxd.my.id/download/tiktokv2', { params: { url } });
                if (!data.status) throw new Error('Download V2 failed');
                const res = data.result;

                if (res.video?.length) {
                    for (const v of res.video) {
                        await conn.sendMessage(from, {
                            video: { url: v },
                            mimetype: 'video/mp4'
                        }, { quoted: mek });
                    }
                    downloadSuccess = true;
                }

                if (res.audio?.length) {
                    for (const a of res.audio) {
                        await conn.sendMessage(from, {
                            audio: { url: a },
                            mimetype: 'audio/mpeg',
                            fileName: 'tiktok_audio.mp3',
                            ptt: false
                        }, { quoted: mek });
                    }
                    downloadSuccess = true;
                }
            }

            // ── V3 (No slide, tikwm.com) ────────────────────────
            else if (version === 'v3') {
                const { data } = await axios.get('https://www.tikwm.com/api/', { params: { url } });
                if (data.code !== 0) throw new Error('Download V3 failed');
                const res = data.data;

                await conn.sendMessage(from, {
                    video: { url: res.play },
                    mimetype: 'video/mp4'
                }, { quoted: mek });
                downloadSuccess = true;

                if (res.music) {
                    await conn.sendMessage(from, {
                        audio: { url: res.music },
                        mimetype: 'audio/mpeg',
                        fileName: 'tiktok.mp3',
                        ptt: false
                    }, { quoted: mek });
                }
            }

        } catch (e) {
            clearInterval(procInterval);
            await conn.sendMessage(from, { delete: procMsg.key });
            const errCaption = headerBox('TIKTOK DOWNLOADER') + '\n\n' +
                               contentBox(['❌ Download failed. Try another version.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TIKTOK_IMG, errCaption);
        }

        // Stop animation & delete it
        clearInterval(procInterval);
        await conn.sendMessage(from, { delete: procMsg.key });

        // No final success message – media already sent silently

    } catch (e) {
        console.error('[TIKTOK LISTENER ERROR]', e);
        // If error occurs outside the download try-catch
        const errCaption = headerBox('TIKTOK DOWNLOADER') + '\n\n' +
                           contentBox(['⚠️ An error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TIKTOK_IMG, errCaption);
        tiktokSession.delete(sender);
    }
});