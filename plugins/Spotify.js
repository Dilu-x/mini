// plugins/ACD_SPOTIFY.js — Spotify Downloader (unified box style)
const { cmd } = require('../command');
const axios = require('axios');
const { getBuffer } = require('../lib/functions');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ꜱᴘᴏᴛɪꜰʏ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ';

const SPOTIFY_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ── Header box (exactly like SONG plugin) ────────────────────────
function headerBox(platform) {
    const top    = '*┏━━━━━━━━━━━━━━✦*';
    const bot    = `*┃ \`Bot Name :\` ${BOT_NAME}*`;
    const time   = getDateTimeLine();
    const plat   = `*┃ \`Platform :\` ${platform}*`;
    const bottom = '*┗━━━━━━━━━━━━━━✦*';
    return `${top}\n${bot}\n${time}\n${plat}\n${bottom}`;
}

// ── Content box (like Song's result/selection boxes) ─────────────
function contentBox(lines) {
    const top = '┏━━━━━━━━━━━━━━✦';
    const bottom = '┗━━━━━━━━━━━━━━✦';
    const content = lines.map(line => `┃ ${line}`).join('\n');
    return `${top}\n${content}\n${bottom}`;
}

// ══════════════════════════════════════════════════════════════════
// SPOTIFY COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'spotify',
    alias: ['spotifydl', 'spdl', 'spotifyplay', 'spotifydlv2'],
    desc: 'Download a Spotify track. Usage: .spotify <song name / Spotify URL>',
    category: 'download',
    react: '🎵',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🎵', key: mek.key } });

        // ── No query – show usage with image ────────────────────
        if (!q) {
            const usageCaption = headerBox('SPOTIFY DOWNLOADER') + '\n\n' +
                                 contentBox([
                                     '❏ .spotify <song name>',
                                     '❏ .spotify <Spotify URL>',
                                     '',
                                     '☘️ Example:',
                                     '  .spotify Blinding Lights'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SPOTIFY_IMG, usageCaption);
        }

        let spotifyUrl = q;

        // ── If not a link, search with animated text ─────────────
        if (!q.includes('open.spotify.com')) {
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

            // Search API call
            let searchResult;
            try {
                const search = await axios.get(
                    `https://riimusic.my.id/api/spotify/search?apikey=riicode&query=${encodeURIComponent(q)}`
                );
                searchResult = search.data;
            } catch (e) {
                clearInterval(searchInterval);
                await conn.sendMessage(from, { delete: searchMsg.key });
                const errCaption = headerBox('SEARCH ERROR') + '\n\n' +
                                   contentBox(['❌ Could not contact Spotify search.']) + '\n\n' + FOOTER;
                return await sendWithImage(conn, from, mek, SPOTIFY_IMG, errCaption);
            }

            clearInterval(searchInterval);
            await conn.sendMessage(from, { delete: searchMsg.key });

            const track = searchResult?.result?.songs?.[0];
            if (!track) {
                const notFoundCaption = headerBox('NOT FOUND') + '\n\n' +
                                        contentBox([
                                            `🎵 Query: ${q}`,
                                            '❌ No tracks found.'
                                        ]) + '\n\n' + FOOTER;
                return await sendWithImage(conn, from, mek, SPOTIFY_IMG, notFoundCaption);
            }

            spotifyUrl = track.url;

            // Show found track info with thumbnail + content box
            const thumbnail = track.thumb || track.thumbnail || SPOTIFY_IMG;
            const foundCaption = headerBox('TRACK FOUND') + '\n\n' +
                                 contentBox([
                                     `🎵 *Title:* ${track.title}`,
                                     `👤 *Artist:* ${track.artist}`,
                                     '',
                                     '⬇️ Preparing download...'
                                 ]) + '\n\n' + FOOTER;
            await sendWithImage(conn, from, mek, thumbnail, foundCaption);
        }

        // ── Animated preparing text ─────────────────────────────
        const prepStages = ['P R E P A R I N G *', 'P R E P A R I N G **', 'P R E P A R I N G ***'];
        const prepMsg = await conn.sendMessage(from, { text: prepStages[0] }, { quoted: mek });

        let prepIdx = 0;
        const prepInterval = setInterval(async () => {
            prepIdx = (prepIdx + 1) % prepStages.length;
            try {
                await conn.sendMessage(from, {
                    text: prepStages[prepIdx],
                    edit: prepMsg.key
                });
            } catch (e) {}
        }, 400);

        // ── Download metadata + audio in background ─────────────
        let songData, audioBuffer;
        try {
            const { data } = await axios.get(
                `https://api.ikyyxd.my.id/download/spotifydl?url=${encodeURIComponent(spotifyUrl)}`
            );
            if (!data.status) throw new Error('API returned unsuccessful status');
            songData = data.result;

            const audioRes = await axios.get(songData.download, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            audioBuffer = Buffer.from(audioRes.data);
        } catch (e) {
            clearInterval(prepInterval);
            await conn.sendMessage(from, { delete: prepMsg.key });
            const failCaption = headerBox('DOWNLOAD FAILED') + '\n\n' +
                                contentBox(['❌ Failed to retrieve the audio.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SPOTIFY_IMG, failCaption);
        }

        // Stop animation and delete it
        clearInterval(prepInterval);
        await conn.sendMessage(from, { delete: prepMsg.key });

        // ── Send the audio (no extra message) ───────────────────
        await conn.sendMessage(from, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${songData.title}.mp3`,
            ptt: false
        }, { quoted: mek });

    } catch (e) {
        console.error('[SPOTIFY ERROR]', e);
        const errCaption = headerBox('SYSTEM ERROR') + '\n\n' +
                           contentBox(['An unexpected error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, SPOTIFY_IMG, errCaption);
    }
});