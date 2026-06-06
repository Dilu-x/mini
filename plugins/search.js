// plugins/ACD_VARHAD_SEARCH.js — Unified Search Commands (fixed contentBox)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ꜱᴇᴀʀᴄʜ';

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

// ── Content box (FIXED: flattens multiline strings) ──────────────
function contentBox(lines) {
    const top = '┏━━━━━━━━━━━━━━✦';
    const bottom = '┗━━━━━━━━━━━━━━✦';
    // Flatten any element that contains '\n', then add prefix to each line
    const content = lines
        .flatMap(line => String(line).split('\n'))
        .map(line => `┃ ${line}`)
        .join('\n');
    return `${top}\n${content}\n${bottom}`;
}

// ── Shared animated search & API call ─────────────────────────────
async function performSearch(conn, mek, from, query, apiUrl, platformName) {
    const searchStages = ['sᴇᴀʀᴄʜɪɴɢ *', 'sᴇᴀʀᴄʜɪɴɢ **', 'sᴇᴀʀᴄʜɪɴɢ ***'];
    const searchMsg = await conn.sendMessage(from, { text: searchStages[0] }, { quoted: mek });

    let stageIdx = 0;
    const searchInterval = setInterval(async () => {
        stageIdx = (stageIdx + 1) % searchStages.length;
        try {
            await conn.sendMessage(from, { text: searchStages[stageIdx], edit: searchMsg.key });
        } catch (e) {}
    }, 400);

    let apiData;
    try {
        const { data } = await axios.get(apiUrl, { params: { q: query } });
        apiData = data;
    } catch (e) {
        clearInterval(searchInterval);
        await conn.sendMessage(from, { delete: searchMsg.key });
        const errCaption = headerBox(platformName) + '\n\n' +
                           contentBox(['❌ Could not contact server.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, SEARCH_IMG, errCaption);
        return false;
    }
    clearInterval(searchInterval);
    await conn.sendMessage(from, { delete: searchMsg.key });
    return apiData;
}

// ══════════════════════════════════════════════════════════════════
// 1. BSTATION SEARCH
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'bilibili',
    alias: ['bsearch'],
    desc: 'Search Bilibili (BStation). Usage: .bstation <query>',
    category: 'search',
    react: '📺',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '📺', key: mek.key } });
        if (!q) {
            const usageCaption = headerBox('BSTATION SEARCH') + '\n\n' +
                                 contentBox(['❏ .bstation <query>', '', 'Example:', '  .bstation Hi']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, usageCaption);
        }

        const data = await performSearch(conn, mek, from, q, 'https://v2.api-varhad.my.id/search/bstation', 'BSTATION SEARCH');
        if (!data) return;
        if (!data.status || !data.result?.length) {
            const noResultCaption = headerBox('BSTATION SEARCH') + '\n\n' +
                                    contentBox([`❌ No results for "${q}"`]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, noResultCaption);
        }

        const listLines = data.result.slice(0, 5).map(v => `*${v.title}*\n👁️ ${v.views}\n🔗 ${v.link}`);
        const resultCaption = headerBox('BSTATION SEARCH') + '\n\n' +
                              contentBox([`📝 Query: ${q}`, ...listLines]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, SEARCH_IMG, resultCaption);
    } catch (e) {
        console.error('[BSTATION ERROR]', e);
        const errCaption = headerBox('BSTATION SEARCH') + '\n\n' + contentBox(['⚠️ An error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, SEARCH_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// 2. GOOGLE SEARCH
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'google',
    alias: ['gsearch', 'googlesearch'],
    desc: 'Search Google via Varhad. Usage: .google <query>',
    category: 'search',
    react: '🔍',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });
        if (!q) {
            const usageCaption = headerBox('GOOGLE SEARCH') + '\n\n' +
                                 contentBox(['❏ .google <query>', '', 'Example:', '  .google Shitsu MD']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, usageCaption);
        }

        const data = await performSearch(conn, mek, from, q, 'https://v2.api-varhad.my.id/search/google', 'GOOGLE SEARCH');
        if (!data) return;
        if (!data.status || !data.result?.length) {
            const noResultCaption = headerBox('GOOGLE SEARCH') + '\n\n' +
                                    contentBox([`❌ No results for "${q}"`]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, noResultCaption);
        }

        const listLines = data.result.slice(0, 5).map(item => {
            const title = item.resource_title || 'No Title';
            const link = item.resolved_endpoint || '';
            const source = item.origin_node || 'Unknown';
            const time = item.temporal_stamp ? new Date(item.temporal_stamp).toLocaleDateString() : '';
            return `*${title}*\n📎 ${link}\n📰 ${source}${time ? '  🕒 ' + time : ''}`;
        });
        const resultCaption = headerBox('GOOGLE SEARCH') + '\n\n' +
                              contentBox([`📝 Query: ${q}`, ...listLines]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, SEARCH_IMG, resultCaption);
    } catch (e) {
        console.error('[GOOGLE ERROR]', e);
        const errCaption = headerBox('GOOGLE SEARCH') + '\n\n' + contentBox(['⚠️ An error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, SEARCH_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// 3. LIRIK / LYRICS SEARCH
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'lirik',
    alias: ['lyrics', 'songtext'],
    desc: 'Search song lyrics. Usage: .lirik <song title>',
    category: 'search',
    react: '🎼',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🎼', key: mek.key } });
        if (!q) {
            const usageCaption = headerBox('LYRICS SEARCH') + '\n\n' +
                                 contentBox(['❏ .lirik <song title>', '', 'Example:', '  .lirik Billie Jean']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, usageCaption);
        }

        const data = await performSearch(conn, mek, from, q, 'https://v2.api-varhad.my.id/search/lirik', 'LYRICS SEARCH');
        if (!data) return;
        if (!data.status || !data.result?.result?.length) {
            const noResultCaption = headerBox('LYRICS SEARCH') + '\n\n' +
                                    contentBox([`❌ No lyrics found for "${q}"`]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, noResultCaption);
        }

        const song = data.result.result[0];
        let lyricsText = song.lyrics;
        if (lyricsText.length > 3000) lyricsText = lyricsText.substring(0, 3000) + '\n\n_(truncated)_';
        const lyricsLines = [
            `🎵 ${song.title}`,
            `👤 ${song.artist}`,
            `🔗 ${song.url}`,
            '',           // empty line separator
            lyricsText
        ];
        const resultCaption = headerBox('LYRICS SEARCH') + '\n\n' + contentBox(lyricsLines) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, SEARCH_IMG, resultCaption);
    } catch (e) {
        console.error('[LIRIK ERROR]', e);
        const errCaption = headerBox('LYRICS SEARCH') + '\n\n' + contentBox(['⚠️ An error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, SEARCH_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// 4. PINTEREST SEARCH
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'pinterest',
    alias: ['pinsearch', 'pins'],
    desc: 'Search Pinterest images. Usage: .pinterest <query>',
    category: 'search',
    react: '📌',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '📌', key: mek.key } });
        if (!q) {
            const usageCaption = headerBox('PINTEREST SEARCH') + '\n\n' +
                                 contentBox(['❏ .pinterest <query>', '', 'Example:', '  .pinterest Ghost']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, usageCaption);
        }

        // Pinterest uses 'query' and 'limit' params
        const searchStages = ['sᴇᴀʀᴄʜɪɴɢ *', 'sᴇᴀʀᴄʜɪɴɢ **', 'sᴇᴀʀᴄʜɪɴɢ ***'];
        const searchMsg = await conn.sendMessage(from, { text: searchStages[0] }, { quoted: mek });
        let stageIdx = 0;
        const searchInterval = setInterval(async () => {
            stageIdx = (stageIdx + 1) % searchStages.length;
            try {
                await conn.sendMessage(from, { text: searchStages[stageIdx], edit: searchMsg.key });
            } catch (e) {}
        }, 400);

        let data;
        try {
            const res = await axios.get('https://v2.api-varhad.my.id/search/pinterest', { params: { query: q, limit: 5 } });
            data = res.data;
        } catch (e) {
            clearInterval(searchInterval);
            await conn.sendMessage(from, { delete: searchMsg.key });
            const errCaption = headerBox('PINTEREST SEARCH') + '\n\n' +
                               contentBox(['❌ Could not contact server.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, errCaption);
        }
        clearInterval(searchInterval);
        await conn.sendMessage(from, { delete: searchMsg.key });

        if (!data || !data.status || !data.result?.length) {
            const noResultCaption = headerBox('PINTEREST SEARCH') + '\n\n' +
                                    contentBox([`❌ No images for "${q}"`]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, noResultCaption);
        }

        // Send images silently (no captions)
        for (let i = 0; i < data.result.length; i++) {
            try {
                const imgBuf = await getBuffer(data.result[i]);
                await conn.sendMessage(from, { image: imgBuf, mimetype: 'image/jpeg' }, { quoted: mek });
            } catch (e) {
                // ignore single image failure
            }
            if (i < data.result.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    } catch (e) {
        console.error('[PINTEREST ERROR]', e);
        const errCaption = headerBox('PINTEREST SEARCH') + '\n\n' + contentBox(['⚠️ An error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, SEARCH_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// 5. WIKIPEDIA SEARCH
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'wikipedia',
    alias: ['wiki', 'wikisearch'],
    desc: 'Search Wikipedia. Usage: .wikipedia <query>',
    category: 'search',
    react: '📖',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '📖', key: mek.key } });
        if (!q) {
            const usageCaption = headerBox('WIKIPEDIA SEARCH') + '\n\n' +
                                 contentBox(['❏ .wikipedia <query>', '', 'Example:', '  .wikipedia Who am I']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, usageCaption);
        }

        const data = await performSearch(conn, mek, from, q, 'https://v2.api-varhad.my.id/search/wikipedia', 'WIKIPEDIA SEARCH');
        if (!data) return;
        if (!data.status || !data.result?.length) {
            const noResultCaption = headerBox('WIKIPEDIA SEARCH') + '\n\n' +
                                    contentBox([`❌ No articles for "${q}"`]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, noResultCaption);
        }

        const listLines = data.result.slice(0, 5).map(item => `*${item.title}*\n📝 ${item.description || ''}\n🔗 ${item.url}`);
        const resultCaption = headerBox('WIKIPEDIA SEARCH') + '\n\n' +
                              contentBox([`📝 Query: ${q}`, ...listLines]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, SEARCH_IMG, resultCaption);
    } catch (e) {
        console.error('[WIKIPEDIA ERROR]', e);
        const errCaption = headerBox('WIKIPEDIA SEARCH') + '\n\n' + contentBox(['⚠️ An error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, SEARCH_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// 6. YOUTUBE SEARCH
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'youtubesearch',
    alias: ['ytsearch', 'yts'],
    desc: 'Search YouTube videos. Usage: .youtubesearch <query>',
    category: 'search',
    react: '▶️',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '▶️', key: mek.key } });
        if (!q) {
            const usageCaption = headerBox('YOUTUBE SEARCH') + '\n\n' +
                                 contentBox(['❏ .youtubesearch <query>', '', 'Example:', '  .youtubesearch Alone']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, usageCaption);
        }

        const data = await performSearch(conn, mek, from, q, 'https://v2.api-varhad.my.id/search/youtube', 'YOUTUBE SEARCH');
        if (!data) return;
        if (!data.status || !data.result?.length) {
            const noResultCaption = headerBox('YOUTUBE SEARCH') + '\n\n' +
                                    contentBox([`❌ No videos for "${q}"`]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, SEARCH_IMG, noResultCaption);
        }

        const firstResult = data.result[0];
        const listLines = data.result.slice(0, 5).map(v => `*${v.title}*\n📺 ${v.channel}  ⏱ ${v.duration}\n🔗 ${v.link}`);
        const resultCaption = headerBox('YOUTUBE SEARCH') + '\n\n' +
                              contentBox([`📝 Query: ${q}`, ...listLines]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, firstResult.imageUrl, resultCaption);
    } catch (e) {
        console.error('[YOUTUBESEARCH ERROR]', e);
        const errCaption = headerBox('YOUTUBE SEARCH') + '\n\n' + contentBox(['⚠️ An error occurred.']) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, SEARCH_IMG, errCaption);
    }
});