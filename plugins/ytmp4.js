// plugins/ACD_YTMP4.js — YouTube Video Downloader (unified box style, no final message)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ʏᴛᴍᴘ4 ᴅᴏᴡɴʟᴏᴀᴅᴇʀ';

const VIDEO_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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
const ytmp4Session = new Map();

// ══════════════════════════════════════════════════════════════════
// YTMP4 COMMAND — query or direct link
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'ytmp4',
    alias: ['ytvideo', 'varhadvideo', 'ytdl'],
    desc: 'Download YouTube video (MP4). Usage: .ytmp4 <query / YouTube URL>',
    category: 'download',
    react: '▶️',
    filename: __filename
}, async (conn, mek, m, { reply, q, from, sender }) => {
    try {
        await conn.sendMessage(from, { react: { text: '▶️', key: mek.key } });

        if (!q) {
            const usageCaption = headerBox('YOUTUBE VIDEO') + '\n\n' +
                                 contentBox([
                                     '❏ .ytmp4 <search query / YouTube URL>',
                                     '',
                                     'Example:',
                                     '  .ytmp4 Alan Walker Faded',
                                     '  .ytmp4 https://youtu.be/xxxx'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, VIDEO_IMG, usageCaption);
        }

        const input = q.trim();
        const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/i;
        const isUrl = youtubeUrlPattern.test(input);

        // ── Animated searching text ──────────────────────────────
        const searchStages = ['sᴇᴀʀᴄʜɪɴɢ *', 'sᴇᴀʀᴄʜɪɴɢ **', 'sᴇᴀʀᴄʜɪɴɢ ***'];
        const searchMsg = await conn.sendMessage(from, { text: searchStages[0] }, { quoted: mek });

        let stageIdx = 0;
        const searchInterval = setInterval(async () => {
            stageIdx = (stageIdx + 1) % searchStages.length;
            try {
                await conn.sendMessage(from, {
                    text: searchStages[stageIdx],
                    edit: searchMsg.key
                });
            } catch (e) {}
        }, 400);

        let searchData, directDetails;
        try {
            if (isUrl) {
                // Direct URL → get video details and qualities
                const res = await axios.get('https://api-varhad.my.id/download/ytmp4', { params: { url: input } });
                directDetails = res.data;
            } else {
                // Search query
                const res = await axios.get('https://api-varhad.my.id/search/youtube', { params: { q: input } });
                searchData = res.data;
            }
        } catch (e) {
            clearInterval(searchInterval);
            await conn.sendMessage(from, { delete: searchMsg.key });
            const errCaption = headerBox('YOUTUBE VIDEO') + '\n\n' +
                               contentBox(['❌ Could not contact server.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, VIDEO_IMG, errCaption);
        }

        // Stop animation & delete it
        clearInterval(searchInterval);
        await conn.sendMessage(from, { delete: searchMsg.key });

        if (isUrl) {
            if (!directDetails?.status || !directDetails.result?.videos?.length) {
                const failCaption = headerBox('YOUTUBE VIDEO') + '\n\n' +
                                    contentBox(['❌ Unable to fetch video details.']) + '\n\n' + FOOTER;
                return await sendWithImage(conn, from, mek, VIDEO_IMG, failCaption);
            }

            const result = directDetails.result;
            const chosen = {
                title: result.title,
                channel: '',
                duration: result.duration ? `${Math.floor(result.duration / 60)}:${(result.duration % 60).toString().padStart(2, '0')}` : 'Unknown',
                imageUrl: result.thumbnail
            };

            // Build unique quality list
            const seen = new Set();
            const uniqueQualities = [];
            for (const q of result.videos) {
                const key = q.label;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueQualities.push(q);
                }
            }
            const topQualities = uniqueQualities.slice(0, 5);
            const qualityLines = topQualities.map((q, i) => `*${i+1}.* ${q.label} (${q.quality})`);

            ytmp4Session.set(sender, {
                stage: 'select_quality',
                chosen,
                qualities: topQualities,
                isDirect: true
            });
            setTimeout(() => ytmp4Session.delete(sender), 120000);

            const qualityCaption = headerBox('YOUTUBE VIDEO') + '\n\n' +
                                    contentBox([
                                        `📌 *Title:* ${chosen.title}`,
                                        `⏱️ *Duration:* ${chosen.duration}`,
                                        '',
                                        '⚡ Choose quality below:',
                                        ...qualityLines,
                                        '',
                                        `_Reply with a number (1-${topQualities.length})_`
                                    ]) + '\n\n' + FOOTER;
            await sendWithImage(conn, from, mek, chosen.imageUrl, qualityCaption);
        } else {
            if (!searchData?.status || !searchData.result?.length) {
                const noResultCaption = headerBox('YOUTUBE VIDEO') + '\n\n' +
                                        contentBox([`❌ No videos found for "${input}".`]) + '\n\n' + FOOTER;
                return await sendWithImage(conn, from, mek, VIDEO_IMG, noResultCaption);
            }

            const results = searchData.result.slice(0, 5);
            const listLines = results.map((r, i) => `*${i+1}.* ${r.title}\n   ⏱ ${r.duration}  📺 ${r.channel}\n`);

            ytmp4Session.set(sender, { stage: 'select_video', results });
            setTimeout(() => ytmp4Session.delete(sender), 120000);

            const searchCaption = headerBox('YOUTUBE VIDEO') + '\n\n' +
                                  contentBox([
                                      `📝 *Query:* ${input}`,
                                      '',
                                      '🎬 Top Results:',
                                      ...listLines,
                                      `⚡ Reply with number (1-${results.length}) to select`
                                  ]) + '\n\n' + FOOTER;
            await sendWithImage(conn, from, mek, results[0].imageUrl, searchCaption);
        }

    } catch (e) {
        console.error('[YTMP4 CMD ERROR]', e);
        const errCaption = headerBox('YOUTUBE VIDEO') + '\n\n' +
                           contentBox(['❌ An unexpected error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, VIDEO_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// NUMBER REPLY LISTENER — selection & quality download
// ══════════════════════════════════════════════════════════════════
cmd({
    on: 'body',
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, { sender, body, from }) => {
    try {
        const session = ytmp4Session.get(sender);
        if (!session) return;

        const input = body.trim();
        const num = parseInt(input);

        // ── Stage 1: Select video from search results ────────────
        if (session.stage === 'select_video') {
            if (isNaN(num) || num < 1 || num > session.results.length) return;

            const chosen = session.results[num - 1];
            // Fetch details for the chosen video to get quality options
            const { data } = await axios.get('https://api-varhad.my.id/download/ytmp4', {
                params: { url: chosen.link }
            });
            if (!data.status || !data.result?.videos?.length) {
                ytmp4Session.delete(sender);
                const failCaption = headerBox('YOUTUBE VIDEO') + '\n\n' +
                                    contentBox(['❌ Unable to fetch video qualities.']) + '\n\n' + FOOTER;
                return await sendWithImage(conn, from, mek, VIDEO_IMG, failCaption);
            }

            const result = data.result;
            const seen = new Set();
            const uniqueQualities = [];
            for (const q of result.videos) {
                if (!seen.has(q.label)) {
                    seen.add(q.label);
                    uniqueQualities.push(q);
                }
            }
            const topQualities = uniqueQualities.slice(0, 5);
            const qualityLines = topQualities.map((q, i) => `*${i+1}.* ${q.label} (${q.quality})`);

            ytmp4Session.set(sender, {
                stage: 'select_quality',
                chosen,
                qualities: topQualities
            });

            const qualityCaption = headerBox('YOUTUBE VIDEO') + '\n\n' +
                                    contentBox([
                                        `📌 *Title:* ${chosen.title}`,
                                        `📺 *Channel:* ${chosen.channel}`,
                                        `⏱️ *Duration:* ${chosen.duration}`,
                                        '',
                                        '⚡ Choose quality below:',
                                        ...qualityLines,
                                        '',
                                        `_Reply with a number (1-${topQualities.length})_`
                                    ]) + '\n\n' + FOOTER;
            await sendWithImage(conn, from, mek, result.thumbnail || chosen.imageUrl, qualityCaption);
            return;
        }

        // ── Stage 2: Select quality & download ──────────────────
        if (session.stage === 'select_quality') {
            if (isNaN(num) || num < 1 || num > session.qualities.length) return;

            const selectedQuality = session.qualities[num - 1];
            const video = session.chosen;
            ytmp4Session.delete(sender);

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

            try {
                // Download the video (Varhad API already provides direct URL)
                // We can just send the URL directly
                await conn.sendMessage(from, {
                    video: { url: selectedQuality.url },
                    mimetype: 'video/mp4'
                }, { quoted: mek });

                // Stop animation & delete it
                clearInterval(procInterval);
                await conn.sendMessage(from, { delete: procMsg.key });

                // No final success caption – silent delivery

            } catch (e) {
                clearInterval(procInterval);
                await conn.sendMessage(from, { delete: procMsg.key });
                const errCaption = headerBox('YOUTUBE VIDEO') + '\n\n' +
                                   contentBox(['❌ Failed to send the video.']) + '\n\n' + FOOTER;
                return await sendWithImage(conn, from, mek, VIDEO_IMG, errCaption);
            }
            return;
        }

    } catch (e) {
        console.error('[YTMP4 LISTENER ERROR]', e);
        const errCaption = headerBox('YOUTUBE VIDEO') + '\n\n' +
                           contentBox(['⚠️ An error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, VIDEO_IMG, errCaption);
        ytmp4Session.delete(sender);
    }
});