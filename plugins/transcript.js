// plugins/ACD_TRANSCRIPT.js — Premium Transcript (modern unified style)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const crypto = require('crypto');

// ══════════════════════════════════════════════════════════════════
// CONFIG (same unified style)
// ══════════════════════════════════════════════════════════════════
const config = require('../config');
const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ᴛʀᴀɴꜱᴄʀɪᴘᴛ';

const TRANS_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ── Header box (exactly like other plugins) ──────────────────────
function headerBox(platform) {
    const top    = '*┏━━━━━━━━━━━━━━✦*';
    const bot    = `*┃ \`Bot Name :\` ${BOT_NAME}*`;
    const time   = getDateTimeLine();
    const plat   = `*┃ \`Platform :\` ${platform}*`;
    const bottom = '*┗━━━━━━━━━━━━━━✦*';
    return `${top}\n${bot}\n${time}\n${plat}\n${bottom}`;
}

// ══════════════════════════════════════════════════════════════════
// Original transcription function (unchanged)
// ══════════════════════════════════════════════════════════════════
async function transcript(url) {
    const { data } = await axios.post(
        "https://api.proactor.ai:7788/v1/tourists/files/transcription",
        {
            fileUrl: url,
            language: "en",
            track_id: crypto.randomUUID()
        }
    );
    return {
        status: true,
        transcript: data.data.map(x => x.text).join(" ")
    };
}

// ══════════════════════════════════════════════════════════════════
// TRANSCRIPT COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'transcript',
    alias: ['tr', 'transcribe', 'vttotext'],
    desc: 'Transcribe video/audio from URL.',
    category: 'tools',
    react: '📜',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '📜', key: mek.key } });

        // ── Usage with image ────────────────────────────────────
        if (!q) {
            const usageCaption = headerBox('TRANSCRIPT') + '\n\n' +
                                 '❏ .transcript <audio/video URL>\n\n' +
                                 'Example:\n' +
                                 '  .transcript https://example.com/speech.mp3\n' +
                                 '  .transcript https://youtu.be/...\n\n' +
                                 FOOTER;
            return await sendWithImage(conn, from, mek, TRANS_IMG, usageCaption);
        }

        // ── Animated analyzing text ─────────────────────────────
        const analyzeStages = ['A N A L Y Z I N G *', 'A N A L Y Z I N G **', 'A N A L Y Z I N G ***'];
        const analyzeMsg = await conn.sendMessage(from, { text: analyzeStages[0] }, { quoted: mek });

        let stageIdx = 0;
        const analyzeInterval = setInterval(async () => {
            stageIdx = (stageIdx + 1) % analyzeStages.length;
            try {
                await conn.sendMessage(from, {
                    text: analyzeStages[stageIdx],
                    edit: analyzeMsg.key
                });
            } catch (e) {}
        }, 400);

        // ── Call API in background ──────────────────────────────
        let result;
        try {
            result = await transcript(q);
        } catch (e) {
            clearInterval(analyzeInterval);
            await conn.sendMessage(from, { delete: analyzeMsg.key });
            const errCaption = headerBox('TRANSCRIPT FAILED') + '\n\n' +
                               '❌ Unable to transcribe. Check the link.\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TRANS_IMG, errCaption);
        }

        // Stop animation and delete it
        clearInterval(analyzeInterval);
        await conn.sendMessage(from, { delete: analyzeMsg.key });

        // ── Validate result ─────────────────────────────────────
        if (!result.status || !result.transcript) {
            const failCaption = headerBox('TRANSCRIPT FAILED') + '\n\n' +
                                'No speech detected or unsupported format.\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TRANS_IMG, failCaption);
        }

        // ── Build result (truncate if needed) ───────────────────
        let transcriptText = result.transcript;
        if (transcriptText.length > 3500) {
            transcriptText = transcriptText.substring(0, 3500) + '\n\n_(truncated)_';
        }

        const resultCaption = headerBox('TRANSCRIPT RESULT') + '\n\n' +
                              '✅ Transcription successful.\n\n' +
                              '📝 *Transcript:*\n' +
                              '```' + transcriptText + '```\n\n' +
                              FOOTER;

        // ── Send final result with image ────────────────────────
        await sendWithImage(conn, from, mek, TRANS_IMG, resultCaption);

    } catch (e) {
        console.error('[TRANSCRIPT ERROR]', e);
        const errCaption = headerBox('SYSTEM ERROR') + '\n\n' +
                           'An unexpected error occurred.\n' +
                           e.message + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TRANS_IMG, errCaption);
    }
});