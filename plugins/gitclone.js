// plugins/ACD_GITCLONE.js — GitHub Repository Downloader (unified, silent delivery)
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');
const axios = require('axios');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> ɢɪᴛ ᴄʟᴏɴᴇ';

const GIT_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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
// GITCLONE COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: 'gitclone',
    alias: ['gitdl', 'githubdl', 'repodl'],
    desc: 'Download a GitHub repository as ZIP. Usage: .gitclone <GitHub URL>',
    category: 'download',
    react: '📦',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        await conn.sendMessage(from, { react: { text: '📦', key: mek.key } });

        if (!q) {
            const usageCaption = headerBox('GIT CLONE') + '\n\n' +
                                 contentBox([
                                     '❏ .gitclone <GitHub URL>',
                                     '',
                                     'Example:',
                                     '  .gitclone https://github.com/user/repo'
                                 ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, GIT_IMG, usageCaption);
        }

        // Parse GitHub URL
        const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com[\/:]([^\/\n\r]+)\/([^\/\n\r#?]+)(?:[\/]?|[\/]tree[\/]([^\/\n\r]+)?)?/i;
        const match = q.match(githubRegex);
        if (!match) {
            const invalidCaption = headerBox('GIT CLONE') + '\n\n' +
                                   contentBox([
                                       '❌ Invalid GitHub URL.',
                                       'Supported formats:',
                                       '- https://github.com/user/repo',
                                       '- https://github.com/user/repo/tree/branch'
                                   ]) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, GIT_IMG, invalidCaption);
        }

        let [, user, repo, branch] = match;
        repo = repo.replace(/\.git$/, '').replace(/[^a-zA-Z0-9\-_]/g, '');
        branch = branch || 'main';

        // ── Animated fetching while verifying branch ───────────
        const fetchStages = ['F E T C H I N G *', 'F E T C H I N G **', 'F E T C H I N G ***'];
        const fetchMsg = await conn.sendMessage(from, { text: fetchStages[0] }, { quoted: mek });

        let stageIdx = 0;
        const fetchInterval = setInterval(async () => {
            stageIdx = (stageIdx + 1) % fetchStages.length;
            try {
                await conn.sendMessage(from, { text: fetchStages[stageIdx], edit: fetchMsg.key });
            } catch (e) {}
        }, 400);

        // Verify branch existence (fallback to master)
        let validBranch = false;
        try {
            await axios.head(`https://api.github.com/repos/${user}/${repo}/branches/${branch}`);
            validBranch = true;
        } catch {
            try {
                await axios.head(`https://api.github.com/repos/${user}/${repo}/branches/master`);
                branch = 'master';
                validBranch = true;
            } catch {
                // Repository or branch doesn't exist
            }
        }

        if (!validBranch) {
            clearInterval(fetchInterval);
            await conn.sendMessage(from, { delete: fetchMsg.key });
            const notFoundCaption = headerBox('GIT CLONE') + '\n\n' +
                                    contentBox(['❌ Repository or branch not found. Ensure it is public.']) + '\n\n' + FOOTER;
            return await sendWithImage(conn, from, mek, GIT_IMG, notFoundCaption);
        }

        // Stop animation & delete it
        clearInterval(fetchInterval);
        await conn.sendMessage(from, { delete: fetchMsg.key });

        // Build ZIP URL and filename
        const zipUrl = `https://github.com/${user}/${repo}/archive/refs/heads/${branch}.zip`;
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const filename = `${repo}-${branch}-${timestamp}.zip`;

        // ── Send ZIP silently (no caption) ────────────────────
        await conn.sendMessage(from, {
            document: { url: zipUrl },
            fileName: filename,
            mimetype: 'application/zip'
        }, { quoted: mek });

        // No success message – done

    } catch (error) {
        console.error('[GITCLONE ERROR]', error);
        let errorTitle = 'GIT CLONE';
        let errorMsg = error.message;

        if (error.response?.status === 404) {
            errorMsg = 'Repository not found. Ensure it is public.';
        } else if (error.response?.status === 403) {
            errorMsg = 'GitHub API rate limit exceeded. Try again later.';
        } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
            errorMsg = 'Network error. Check your internet connection.';
        }

        const errCaption = headerBox(errorTitle) + '\n\n' +
                           contentBox([errorMsg]) + '\n\n' + FOOTER;
        await sendWithImage(conn, from, mek, GIT_IMG, errCaption);
    }
});