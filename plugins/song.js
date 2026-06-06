// plugins/ACD_SONG.js — Interactive Song Downloader with unique box style
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ══════════════════════════════════════════════════════════════════
// CONFIG (adjust according to your bot setup)
// ══════════════════════════════════════════════════════════════════
const config = require('../config');
const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ꜱᴏɴɢ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ';

const SONG_IMAGES = {
  search:   'https://shyra.edgeone.app/bot-img.jpg',
  loading:  'https://shyra.edgeone.app/bot-img.jpg',
  success:  'https://shyra.edgeone.app/bot-img.jpg',
  error:    'https://shyra.edgeone.app/bot-img.jpg',
  other:    'https://shyra.edgeone.app/bot-img.jpg'
};

// ── Pending state: userId -> { stage, results, chosen, query }
const songState = new Map();

// ══════════════════════════════════════════════════════════════════
// Helper: Send image + caption, fallback to text
// ══════════════════════════════════════════════════════════════════
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

// ── Header box for results / selection ───────────────────────────
function headerBox(platform) {
    const top    = '*┏━━━━━━━━━━━━━━✦*';
    const bot    = `*┃ \`Bot Name :\` ${BOT_NAME}*`;
    const time   = getDateTimeLine();
    const plat   = `*┃ \`Platform :\` ${platform}*`;
    const bottom = '*┗━━━━━━━━━━━━━━✦*';
    return `${top}\n${bot}\n${time}\n${plat}\n${bottom}`;
}

// ── Result lines (inside a box) ──────────────────────────────────
function resultLines(videos) {
    const lines = [];
    lines.push('*Top 5 results:*\n');
    lines.push('┏━━━━━━━━━━━━━━✦');
    videos.forEach((v, i) => {
        lines.push(`┃ *${i+1}.* ${v.title}`);
        lines.push(`┃ ⏱️ ${v.timestamp}  👁️ ${v.views?.toLocaleString() || 'N/A'} views`);
        lines.push(`┃ 📺 ${v.author.name}`);
        lines.push('┃');
    });
    lines.push('┗━━━━━━━━━━━━━━✦');
    return lines;
}

// ── Selection details box ────────────────────────────────────────
function selectionBox(chosen) {
    const lines = [];
    lines.push('┏━━━━━━━━━━━━━━✦');
    lines.push(`┃ 🎵 *Selected Song:*`);
    lines.push(`┃ ${chosen.title}`);
    lines.push(`┃ ⏱️ Duration : ${chosen.timestamp}`);
    lines.push(`┃ 👁️ Views : ${chosen.views?.toLocaleString() || 'N/A'}`);
    lines.push(`┃ 📺 Author : ${chosen.author.name}`);
    lines.push(`┃ 🔗 Link : ${chosen.url}`);
    if (chosen.description) lines.push(`┃ 📝 ${chosen.description.slice(0, 80)}...`);
    lines.push('┗━━━━━━━━━━━━━━✦\n');
    lines.push('*Select Format:*');
    lines.push('> Reply *1* → Audio (MP3)');
    lines.push('> Reply *2* → Document');
    return lines;
}

// ══════════════════════════════════════════════════════════════════
// SONG COMMAND — Start interactive search
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'song',
    alias: ['play', 'music', 'audio'],
    desc: 'Interactive song search & download with thumbnails.',
    category: 'download',
    react: '🎼',
    filename: __filename
}, async (conn, mek, m, { reply, q, from, sender }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🎼', key: mek.key } });

        if (!q) {
            // Usage message now comes with the bot image
            const usageCaption = headerBox('SONG DOWNLOADER') + '\n\n' +
                                 '❏ .song <song name / YouTube URL>\n' +
                                 'Example: .song Not Like Us\n\n' +
                                 FOOTER;
            return await sendWithImage(conn, from, mek, SONG_IMAGES['search'], usageCaption);
        }

        // ── Animated searching text (editing) ────────────────────
        const searchingStages = ['sᴇᴀʀᴄʜɪɴɢ *', 'sᴇᴀʀᴄʜɪɴɢ **', 'sᴇᴀʀᴄʜɪɴɢ ***'];
        const sentMsg = await conn.sendMessage(from, { text: searchingStages[0] }, { quoted: mek });

        const searchPromise = yts(q + " official");

        let stageIndex = 0;
        const editInterval = setInterval(async () => {
            stageIndex = (stageIndex + 1) % searchingStages.length;
            try {
                await conn.sendMessage(from, {
                    text: searchingStages[stageIndex],
                    edit: sentMsg.key
                });
            } catch (e) {}
        }, 400);

        const search = await searchPromise;
        clearInterval(editInterval);
        await conn.sendMessage(from, { delete: sentMsg.key });

        const videos = search.videos.slice(0, 5);
        if (!videos.length) {
            return await sendWithImage(conn, from, mek, SONG_IMAGES['error'],
                headerBox('SEARCH RESULTS') + '\n\n' + '❌ No songs found.\n\n' + FOOTER);
        }

        const header = headerBox('Song Results');
        const results = resultLines(videos);
        const instruction = `\n_Reply with a number (1-${videos.length}) to select._`;
        const caption = `${header}\n\n${results.join('\n')}\n${instruction}\n\n${FOOTER}`;

        songState.set(sender, {
            stage: 'select_song',
            results: videos,
            query: q
        });
        setTimeout(() => songState.delete(sender), 120000);

        await sendWithImage(conn, from, mek, videos[0].thumbnail, caption);

    } catch (e) {
        console.error('[SONG CMD ERROR]', e);
        await sendWithImage(conn, from, mek, SONG_IMAGES['error'],
            headerBox('ERROR') + '\n\n' + e.message);
    }
});

// ══════════════════════════════════════════════════════════════════
// NUMBER REPLY LISTENER — Handles song selection & format choice
// ══════════════════════════════════════════════════════════════════
cmd({
    on: 'body',
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, { sender, body, from, reply }) => {
    try {
        const state = songState.get(sender);
        if (!state) return;

        const input = body.trim();

        // ── Stage 1: Select song ──────────────────────────────────
        if (state.stage === 'select_song') {
            const num = parseInt(input);
            if (isNaN(num) || num < 1 || num > state.results.length) return;

            const chosen = state.results[num - 1];
            const header = headerBox('Song Selection');
            const details = selectionBox(chosen);
            const caption = `${header}\n\n${details.join('\n')}\n\n${FOOTER}`;

            songState.set(sender, {
                ...state,
                stage: 'select_format',
                chosen: chosen
            });

            await sendWithImage(conn, from, mek, chosen.thumbnail, caption);
            return;
        }

        // ── Stage 2: Select format (audio or document) ────────────
        if (state.stage === 'select_format') {
            if (input !== '1' && input !== '2') return;

            const video = state.chosen;
            const wantAudio = input === '1';
            const formatLabel = wantAudio ? 'Audio (MP3)' : 'Document';

            // ── Animated database loading text ──────────────────
            const loadingStages = ['Database loading *', 'Database loading **', 'Database loading ***'];
            const loadMsg = await conn.sendMessage(from, { text: loadingStages[0] }, { quoted: mek });

            let loadIdx = 0;
            const loadInterval = setInterval(async () => {
                loadIdx = (loadIdx + 1) % loadingStages.length;
                try {
                    await conn.sendMessage(from, {
                        text: loadingStages[loadIdx],
                        edit: loadMsg.key
                    });
                } catch (e) {}
            }, 400);

            // ── Start the API search and download in background ──
            const downloadPromise = (async () => {
                // Try APIs
                let downloadUrl, videoTitle;
                const apis = [
                    {
                        url: `https://apis.xwolf.space/download/yta3?url=${encodeURIComponent(video.url)}`,
                        parse: (data) => data?.success ? { url: data.downloadUrl, title: data.title } : null
                    },
                    {
                        url: `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(video.url)}`,
                        parse: (data) => data?.status && data?.url ? { url: data.url, title: data.title } : null
                    },
                    {
                        url: `https://api.giftedtech.co.ke/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(video.url)}`,
                        parse: (data) => data?.status && data?.result?.download_url ? { url: data.result.download_url, title: data.result.title } : null
                    },
                    {
                        url: `https://shyracore.indevs.in/api/downloader/ytmp3?url=${encodeURIComponent(video.url)}&apikey=SK-wp2hqbcaae-mpf90rdu`,
                        parse: (data) => data?.status && data?.downloadUrl ? { url: data.downloadUrl, title: data.title } : null
                    }
                ];

                for (const api of apis) {
                    try {
                        const res = await axios.get(api.url, { timeout: 30000 });
                        const result = api.parse(res.data);
                        if (result?.url) {
                            downloadUrl = result.url;
                            videoTitle = result.title || video.title;
                            break;
                        }
                    } catch (e) { continue; }
                }

                if (!downloadUrl) {
                    clearInterval(loadInterval);
                    songState.delete(sender);
                    await conn.sendMessage(from, { delete: loadMsg.key });
                    return await sendWithImage(conn, from, mek, SONG_IMAGES['error'],
                        headerBox('DOWNLOAD FAILED') + '\n\n❌ All APIs are currently unavailable.\n\n' + FOOTER);
                }

                // Download to temp file
                const tempDir = path.join(os.tmpdir(), "shitsu-temp");
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                const filePath = path.join(tempDir, `song_${Date.now()}.mp3`);

                const audioResponse = await axios({
                    method: 'get',
                    url: downloadUrl,
                    responseType: 'stream',
                    timeout: 900000,
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });

                const writer = fs.createWriteStream(filePath);
                audioResponse.data.pipe(writer);
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                // Stop the animation
                clearInterval(loadInterval);
                await conn.sendMessage(from, { delete: loadMsg.key });

                // Send the file (no success message)
                if (wantAudio) {
                    await conn.sendMessage(from, {
                        audio: { url: filePath },
                        mimetype: 'audio/mpeg',
                        fileName: `${video.title}.mp3`,
                        ptt: false
                    }, { quoted: mek });
                } else {
                    await conn.sendMessage(from, {
                        document: { url: filePath },
                        mimetype: 'audio/mpeg',
                        fileName: `${(videoTitle || video.title).substring(0, 100)}.mp3`
                    }, { quoted: mek });
                }

                // Cleanup
                fs.unlinkSync(filePath);
                songState.delete(sender);
            })();

            // Wait for the download to finish (the interval stops inside)
            await downloadPromise;
            return;
        }

    } catch (e) {
        console.error('[SONG NAV ERROR]', e);
        try {
            await sendWithImage(conn, from, mek, SONG_IMAGES['error'],
                headerBox('ERROR') + '\n\n' + e.message);
        } catch (_) {}
    }
});