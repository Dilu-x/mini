// plugins/ACD_VARHAD_TOOLS2.js — Varhad Tools: SSWeb & AxisXL (unified style)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ᴛᴏᴏʟs';

const TOOLS_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ── Shared animated processing helper ─────────────────────────────
async function doProcessing(conn, mek, from, taskFn) {
    const procStages = ['P R O C E S S I N G *', 'P R O C E S S I N G **', 'P R O C E S S I N G ***'];
    const procMsg = await conn.sendMessage(from, { text: procStages[0] }, { quoted: mek });

    let stageIdx = 0;
    const procInterval = setInterval(async () => {
        stageIdx = (stageIdx + 1) % procStages.length;
        try {
            await conn.sendMessage(from, { text: procStages[stageIdx], edit: procMsg.key });
        } catch (e) {}
    }, 400);

    let result;
    try {
        result = await taskFn();
    } catch (e) {
        clearInterval(procInterval);
        await conn.sendMessage(from, { delete: procMsg.key });
        throw e;
    }
    clearInterval(procInterval);
    await conn.sendMessage(from, { delete: procMsg.key });
    return result;
}

// ══════════════════════════════════════════════════════════════════
// 1. SSWEB — Website Screenshot
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'ssweb',
    alias: ['screenshot', 'webshot'],
    desc: 'Take a screenshot of a website. Usage: .ssweb <url>',
    category: 'tools',
    react: '📸',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '📸', key: mek.key } });

        if (!q) {
            const usageCaption = headerBox('WEBSITE SCREENSHOT') + '\n\n' +
                                 contentBox([
                                     '❏ .ssweb <URL>',
                                     '',
                                     'Example:',
                                     '  .ssweb https://lovelyrdp.indevs.in'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, usageCaption);
        }

        const url = q.split(' ')[0].trim();
        if (!url.startsWith('http')) {
            const invalidCaption = headerBox('WEBSITE SCREENSHOT') + '\n\n' +
                                   contentBox(['⚠️ Please provide a valid URL starting with http:// or https://']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, invalidCaption);
        }

        const data = await doProcessing(conn, mek, from, () =>
            axios.get('https://v2.api-varhad.my.id/tools/ssweb', { params: { url } })
        );

        if (!data.data.status || !data.data.result?.thumbnail) {
            const failCaption = headerBox('WEBSITE SCREENSHOT') + '\n\n' +
                                contentBox(['❌ Unable to take screenshot. The website might be unreachable.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, failCaption);
        }

        const imageUrl = data.data.result.thumbnail;
        // Send the screenshot image silently (no caption)
        await conn.sendMessage(from, {
            image: { url: imageUrl },
            mimetype: 'image/jpeg'
        }, { quoted: mek });

    } catch (e) {
        console.error('[SSWEB ERROR]', e);
        const errCaption = headerBox('WEBSITE SCREENSHOT') + '\n\n' +
                           contentBox([e.message]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TOOLS_IMG, errCaption);
    }
});

// ══════════════════════════════════════════════════════════════════
// 2. AXIS / XL NUMBER CHECK
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'axisxl',
    alias: ['cekx1', 'cekx2', 'xlaxis'],
    desc: 'Check Axis/XL number info. Usage: .axisxl <number>',
    category: 'tools',
    react: '📱',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '📱', key: mek.key } });

        if (!q) {
            const usageCaption = headerBox('AXIS/XL CHECK') + '\n\n' +
                                 contentBox([
                                     '❏ .axisxl <phone number>',
                                     '',
                                     'Example:',
                                     '  .axisxl 94764642432'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, usageCaption);
        }

        const number = q.split(' ')[0].trim();
        if (!/^\d+$/.test(number)) {
            const invalidCaption = headerBox('AXIS/XL CHECK') + '\n\n' +
                                   contentBox(['⚠️ Please provide a numeric phone number.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, invalidCaption);
        }

        const data = await doProcessing(conn, mek, from, () =>
            axios.get('https://v2.api-varhad.my.id/tools/axisxl', { params: { number } })
        );

        if (!data.data.status || !data.data.result) {
            const failCaption = headerBox('AXIS/XL CHECK') + '\n\n' +
                                contentBox(['❌ Unable to check the number. API may be down.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, TOOLS_IMG, failCaption);
        }

        const res = data.data.result;
        const infoLines = [];
        if (res.success) {
            infoLines.push(`✅ Success!`);
            infoLines.push(`📱 Number: ${number}`);
            if (res.data) {
                // Pretty print object data
                infoLines.push(`📊 Data:`);
                for (const [key, val] of Object.entries(res.data)) {
                    infoLines.push(`   ${key}: ${val}`);
                }
            }
        } else {
            infoLines.push(`❌ ${res.message || 'Unknown error'}`);
            infoLines.push(`📱 Number: ${number}`);
            if (res.data) {
                infoLines.push(`📊 Details:`);
                for (const [key, val] of Object.entries(res.data)) {
                    infoLines.push(`   ${key}: ${val}`);
                }
            }
        }

        const resultCaption = headerBox('AXIS/XL CHECK') + '\n\n' +
                              contentBox(infoLines) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TOOLS_IMG, resultCaption);

    } catch (e) {
        console.error('[AXISXL ERROR]', e);
        const errCaption = headerBox('AXIS/XL CHECK') + '\n\n' +
                           contentBox([e.message]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, TOOLS_IMG, errCaption);
    }
});