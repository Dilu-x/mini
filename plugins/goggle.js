// plugins/ACD_GOOGLE.js — Google Search (unified box style)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ɢᴏᴏɢʟᴇ sᴇᴀʀᴄʜ';

const SEARCH_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ══════════════════════════════════════════════════════════════════
// GOOGLE SEARCH COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'google2',
    alias: ['gsearch', 'googlesearch'],
    desc: 'Search Google via Varhad API. Usage: .google2 <query>',
    category: 'search',
    react: '🔍',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });

        // ── Usage with image ────────────────────────────────────
        if (!q) {
            const usageCaption = headerBox('GOOGLE SEARCH') + '\n\n' +
                                 contentBox([
                                     '❏ .google2 <search query>',
                                     '',
                                     'Example:',
                                     '  .google2 latest AI news',
                                     '  .google2 whoami i'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, usageCaption);
        }

        // ── Animated searching text ─────────────────────────────
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

        let results;
        try {
            const { data } = await axios.get('https://v2.api-varhad.my.id/search/google', {
                params: { q }
            });
            if (!data.status || !data.result?.length) throw new Error('No results');
            results = data.result.slice(0, 5);
        } catch (e) {
            clearInterval(searchInterval);
            await conn.sendMessage(from, { delete: searchMsg.key });
            const errCaption = headerBox('GOOGLE SEARCH') + '\n\n' +
                               contentBox([`❌ No results found for "${q}".`]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, errCaption);
        }

        // Stop animation & delete it
        clearInterval(searchInterval);
        await conn.sendMessage(from, { delete: searchMsg.key });

        // ── Build result list ──────────────────────────────────
        const resultLines = results.map((item, i) => {
            const title = item.resource_title || 'No Title';
            const link = item.resolved_endpoint || '';
            const source = item.origin_node || 'Unknown';
            const time = item.temporal_stamp ? new Date(item.temporal_stamp).toLocaleDateString() : '';
            const line = `*${i + 1}.* ${title}\n   📎 ${link}\n   📰 ${source}` + (time ? `  🕒 ${time}` : '');
            return line;
        });

        const resultCaption = headerBox('GOOGLE SEARCH') + '\n\n' +
                              contentBox([
                                  `📝 Query: ${q}`,
                                  ...resultLines
                              ]) + '\n\n' + FOOTER;

        await sendWithImage(conn, from, mek, SEARCH_IMG, resultCaption);

    } catch (e) {
        console.error('[GOOGLE SEARCH ERROR]', e);
        const errCaption = headerBox('GOOGLE SEARCH') + '\n\n' +
                           contentBox(['⚠️ An unexpected error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, SEARCH_IMG, errCaption);
    }
});