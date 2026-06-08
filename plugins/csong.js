// plugins/ACD_CSONG.js — Send Song to Channel/Group (unified style + custom footer per user)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const { getSetting } = require('../settings');  // 👈 import to read user's custom footer
const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ᴄʜᴀɴɴᴇʟ sᴏɴɢ';

const CSONG_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ══════════════════════════════════════════════════════════════════
// CSONG COMMAND (with per‑user custom footer)
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'csong',
    alias: ['channelsong', 'sendmusic'],
    desc: 'Send a song to a channel/group. Usage: .csong <channelJID> <song name>',
    category: 'download',
    react: '🎵',
    filename: __filename
}, async (conn, mek, m, { reply, q, from, sender }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🎵', key: mek.key } });

        if (!q) {
            const usageCaption = headerBox('CHANNEL SONG') + '\n\n' +
                                 contentBox([
                                     '❏ .csong <channelJID> <song name>',
                                     '',
                                     'Example:',
                                     '  .csong 1203631234567890@g.us Blinding Lights'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, CSONG_IMG, usageCaption);
        }

        const parts = q.split(' ');
        if (parts.length < 2) {
            const errorCaption = headerBox('CHANNEL SONG') + '\n\n' +
                                 contentBox([
                                     '❌ Please provide both channel JID and song name.',
                                     'Example: .csong 1203631234567890@g.us Faded'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, CSONG_IMG, errorCaption);
        }

        const channelJid = parts[0];
        const query = parts.slice(1).join(' ');

        if (!channelJid.includes('@')) {
            const invalidCaption = headerBox('CHANNEL SONG') + '\n\n' +
                                   contentBox(['❌ Invalid JID. Must end with @g.us or @broadcast']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, CSONG_IMG, invalidCaption);
        }

        if (!query) {
            const noQueryCaption = headerBox('CHANNEL SONG') + '\n\n' +
                                   contentBox(['❌ Please enter the song name.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, CSONG_IMG, noQueryCaption);
        }

        // ── Get user's custom footer (or default) ─────────────────
        // pair.js already loads settings for each sender, so getSetting works immediately.
        const customFooter = getSetting(sender, 'CUSTOM_SONG_FOOTER') || '▫️🎵 Check out this group for more songs!';

        // ── Animated searching ──────────────────────────────────
        const searchStages = ['sᴇᴀʀᴄʜɪɴɢ *', 'sᴇᴀʀᴄʜɪɴɢ **', 'sᴇᴀʀᴄʜɪɴɢ ***'];
        const searchMsg = await conn.sendMessage(from, { text: searchStages[0] }, { quoted: mek });

        let stageIdx = 0;
        const searchInterval = setInterval(async () => {
            stageIdx = (stageIdx + 1) % searchStages.length;
            try {
                await conn.sendMessage(from, { text: searchStages[stageIdx], edit: searchMsg.key });
            } catch (e) {}
        }, 400);

        // Search YouTube
        let video;
        try {
            const search = await yts(query);
            if (!search.videos.length) throw new Error('No videos found');
            video = search.videos[0];
        } catch (e) {
            clearInterval(searchInterval);
            await conn.sendMessage(from, { delete: searchMsg.key });
            const noResultCaption = headerBox('CHANNEL SONG') + '\n\n' +
                                    contentBox([`❌ No results for "${query}"`]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, CSONG_IMG, noResultCaption);
        }

        // Get download URL
        const apiKey = "SK-3tlxedd6f7m-moqfh796";
        const apiUrl = `https://shyracore.indevs.in/api/downloader/ytmp3?url=${encodeURIComponent(video.url)}&apikey=${apiKey}`;
        
        let dlUrl, title, thumb;
        try {
            const res = await axios.get(apiUrl);
            const json = res.data;
            if (!json?.status || !json?.downloadUrl) throw new Error('Download URL missing');
            dlUrl = json.downloadUrl || json.data?.downloadUrl;
            title = (json.title || json.data?.title || video.title || "Audio").replace(/[\\/:"*?<>|]/g, "");
            thumb = json.thumbnail || json.data?.thumbnail || video.thumbnail;
        } catch (e) {
            clearInterval(searchInterval);
            await conn.sendMessage(from, { delete: searchMsg.key });
            const apiErrorCaption = headerBox('CHANNEL SONG') + '\n\n' +
                                    contentBox(['❌ Failed to get download link from API.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, CSONG_IMG, apiErrorCaption);
        }

        clearInterval(searchInterval);
        await conn.sendMessage(from, { delete: searchMsg.key });

        // Download MP3 and thumbnail
        const tempMp3 = path.join(os.tmpdir(), `in_${Date.now()}.mp3`);
        const tempThumb = path.join(os.tmpdir(), `thumb_${Date.now()}.jpg`);

        const [mp3Response, thumbResponse] = await Promise.all([
            axios.get(dlUrl, { responseType: 'arraybuffer' }),
            axios.get(thumb, { responseType: 'arraybuffer' })
        ]);

        fs.writeFileSync(tempMp3, Buffer.from(mp3Response.data));
        const thumbBuffer = Buffer.from(thumbResponse.data);
        fs.writeFileSync(tempThumb, thumbBuffer);
        const finalAudioBuffer = fs.readFileSync(tempMp3);

        // ── Channel caption with user's custom footer ─────────────
        const channelCaption = ` 

☘️ Tɪᴛʟᴇ : ${video.title}

▫️📅 Rᴇʟᴇᴀꜱᴇ Dᴀᴛᴇ : ${video.ago || "Unknown"}
▫️⏱️ Dᴜʀᴀᴛɪᴏɴ : ${video.timestamp}
▫️🎭 Vɪᴇᴡꜱ : ${video.views || "Unknown"}
▫️🔗 Lɪɴᴋ : ${video.url}

➟➟➟➟➟➟➟➟➟➟➟➟➟➟
${customFooter}
➟➟➟➟➟➟➟➟➟➟➟➟➟➟
`;

        // Send preview image + caption to channel
        await conn.sendMessage(channelJid, {
            image: thumbBuffer,
            caption: channelCaption
        });

        // Send audio to channel
        await conn.sendMessage(channelJid, {
            audio: finalAudioBuffer,
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`,
            ptt: false
        });

        // Cleanup
        [tempMp3, tempThumb].forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        });

        // ── Success message to user (unified box) ────────────────
        const successCaption = headerBox('CHANNEL SONG') + '\n\n' +
                               contentBox([
                                   `🎵 *${video.title}* sent to channel`,
                                   `📡 JID: ${channelJid}`,
                                   '',
                                   '✨ Delivery complete!'
                               ]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, CSONG_IMG, successCaption);

    } catch (error) {
        console.error('[CSONG ERROR]', error);
        const errCaption = headerBox('CHANNEL SONG') + '\n\n' +
                           contentBox([`❌ ${error.message || 'Unknown error'}`]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, CSONG_IMG, errCaption);
    }
});