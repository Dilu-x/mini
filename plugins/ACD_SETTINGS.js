// plugins/ACD_SETTINGS.js — Unified Settings Panel (same style as other plugins)
const { cmd } = require('../command');
const { initEnvsettings, getSetting, setSetting, toggleSetting, getFullSettings, isUserLoaded } = require('../settings');
const { getBuffer } = require('../lib/functions');
const config = require('../config');

const BOT_NAME = config.BOT_NAME || 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const FOOTER  = config.footer  || '> sᴇᴛᴛɪɴɢs';

const SETTINGS_IMG = 'https://shyra.edgeone.app/bot-img.jpg';

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

// ── Unified settings reply (image + header + content + footer) ────
async function sendSettingsReply(conn, from, mek, platform, lines) {
    const caption = headerBox(platform) + '\n\n' + contentBox(lines) + '\n\n' + FOOTER;
    await sendWithImage(conn, from, mek, SETTINGS_IMG, caption);
}

async function ensureLoaded(userId) {
    if (!isUserLoaded(userId)) await initEnvsettings(userId);
}

// ── Menu definition unchanged ─────────────────────────────────────
const settingsDef = [
    { major: 1,  key: 'AUTO_VIEW_STATUS', label: 'Auto View Status', options: ['on','off'],                    cat: '📌 Auto Features' },
    { major: 2,  key: 'AUTO_LIKE_STATUS', label: 'Auto Like Status', options: ['on','off'],                    cat: '📌 Auto Features' },
    { major: 3,  key: 'AUTO_RECORDING',   label: 'Auto Recording',    options: ['on','off'],                    cat: '📌 Auto Features' },
    { major: 4,  key: 'AUTO_REACT',       label: 'Auto React',        options: ['on','off','emoji'],            cat: '📌 Auto Features' },
    { major: 5,  key: 'ANTI_CALL',        label: 'Anti Call',         options: ['on','off'],                    cat: '🛡️ Anti Features' },
    { major: 6,  key: 'ANTI_DELETE',      label: 'Anti Delete',       options: ['on','off','inbox','same'],     cat: '🛡️ Anti Features' },
    { major: 7,  key: 'ANTI_EDIT',        label: 'Anti Edit',         options: ['on','off'],                    cat: '🛡️ Anti Features' },
    { major: 8,  key: 'ANTI_FAKE',        label: 'Anti Fake',         options: ['on','off'],                    cat: '🛡️ Anti Features' },
    { major: 9,  key: 'STATUS_REACT',     label: 'Status React',      options: ['on','off','emoji'],            cat: '💬 Status & Presence' },
    { major: 10, key: 'PRESENCE_TYPE',    label: 'Presence Type',     options: ['on','off'],                    cat: '💬 Status & Presence' },
    { major: 11, key: 'PRESENCE_FAKE',    label: 'Presence Fake',     options: ['on','off','both'],             cat: '💬 Status & Presence' },
    { major: 12, key: 'WELCOME',          label: 'Welcome Message',   options: ['on','off'],                    cat: '👥 Group Features' },
    { major: 13, key: 'GOODBYE',          label: 'Goodbye Message',   options: ['on','off'],                    cat: '👥 Group Features' },
    { major: 15, key: 'PREFIX',            label: 'Set Prefix',        options: ['value'],                        cat: '🔧 Bot Config' },
    { major: 16, key: 'AUTO_REPLY',       label: 'Auto Reply',        options: ['on','off'],                    cat: '💬 Auto Reply' },
    { major: 18, key: 'CUSTOM_SONG_FOOTER', label: 'Custom Song Footer', options: ['value'], cat: '🎵 Custom' }
];

const flatMenu = [];
const menuMap = {};

settingsDef.forEach(def => {
    def.options.forEach((opt, idx) => {
        const subNum = `${def.major}.${idx + 1}`;
        const needsInput = (opt === 'emoji' || opt === 'value');
        const value = needsInput ? null : opt;
        const labelSuffix = needsInput
            ? (opt === 'emoji' ? ' (custom emoji)' : ' (enter value)')
            : ` ${opt.toUpperCase()}`;
        const item = {
            num: subNum,
            key: def.key,
            value,
            label: def.label + labelSuffix,
            cat: def.cat,
            needsInput,
            optType: opt
        };
        flatMenu.push(item);
        menuMap[subNum] = item;
    });
});

function fmtVal(v) {
    if (v === 'on')  return '✅ ON';
    if (v === 'off') return '❌ OFF';
    return `✳️  ${v}`;
}

const pendingSettings = new Map();

// ══════════════════════════════════════════════════════════════════
// MAIN /settings COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: "settings",
    desc: "Interactive settings menu with image",
    category: "settings",
    react: "⚙️",
    filename: __filename
}, async (conn, mek, m, { sender, from }) => {
    try {
        await ensureLoaded(sender);
        const s = getFullSettings(sender);

        // Build content lines grouped by category
        const byCat = {};
        flatMenu.forEach(item => {
            if (!byCat[item.cat]) byCat[item.cat] = [];
            byCat[item.cat].push(item);
        });

        const lines = [];
        lines.push('📝 Reply with a number (e.g. 6.3) to change setting');
        lines.push('');

        for (const [cat, items] of Object.entries(byCat)) {
            lines.push(`*${cat}*`);
            for (const item of items) {
                const cur = s[item.key] ?? (item.key === 'PREFIX' ? '/' : 'off');
                let marker = '';
                if (!item.needsInput && item.value !== null && cur === item.value) {
                    marker = '  👈 ACTIVE';
                }
                lines.push(`*${item.num}* → ${item.label}${marker}`);
            }
            lines.push(''); // separator
        }
        lines.push('💡 Example: Type *6.3* to set Anti Delete to INBOX');

        await sendSettingsReply(conn, from, mek, 'SETTINGS', lines);
    } catch (e) {
        await sendSettingsReply(conn, from, mek, 'SETTINGS', [`❌ Error: ${e.message}`]);
    }
});

// ══════════════════════════════════════════════════════════════════
// INTERACTIVE LISTENER — number selection & value submissions
// ══════════════════════════════════════════════════════════════════
cmd({
    on: "body",
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, { sender, body, from }) => {
    try {
        const text = body.trim();
        if (text === '0') return;

        // ── STEP 2: Custom value/emoji submission ──────────────
        if (pendingSettings.has(sender)) {
            const pending = pendingSettings.get(sender);
            pendingSettings.delete(sender);

            const val = text;

            if (pending.optType === 'value') {
                // Different validation per setting key
                if (pending.key === 'PREFIX') {
                    if (!val || /\s/.test(val) || val.length > 5) {
                        return await sendSettingsReply(conn, from, mek, 'SETTINGS', [
                            '❌ *Invalid prefix.*',
                            'Prefix must be 1–5 characters, no spaces.'
                        ]);
                    }
                    await ensureLoaded(sender);
                    await setSetting(sender, pending.key, val);
                    return await sendSettingsReply(conn, from, mek, 'SETTINGS', [
                        `✅ *Prefix updated!*`,
                        `New prefix: *${val}*`
                    ]);
                }

                // CUSTOM_SONG_FOOTER — free text, no validation
                if (pending.key === 'CUSTOM_SONG_FOOTER') {
                    if (!val) {
                        return await sendSettingsReply(conn, from, mek, 'SETTINGS', [
                            '❌ *Please enter a custom footer text.*'
                        ]);
                    }
                    await ensureLoaded(sender);
                    await setSetting(sender, pending.key, val);
                    return await sendSettingsReply(conn, from, mek, 'SETTINGS', [
                        `✅ *Custom Song Footer updated!*`,
                        `New footer: ${val}`
                    ]);
                }

                // Fallback for any other future 'value' type settings
                if (!val) {
                    return await sendSettingsReply(conn, from, mek, 'SETTINGS', [
                        '❌ *Please enter a valid value.*'
                    ]);
                }
                await ensureLoaded(sender);
                await setSetting(sender, pending.key, val);
                return await sendSettingsReply(conn, from, mek, 'SETTINGS', [
                    `✅ *${pending.label} updated!*`,
                    `New value: ${val}`
                ]);
            }

            if (pending.optType === 'emoji') {
                if (!val) return await sendSettingsReply(conn, from, mek, 'SETTINGS', ['❌ *Please reply with a valid emoji or text.*']);
                await ensureLoaded(sender);
                await setSetting(sender, pending.key, val);
                return await sendSettingsReply(conn, from, mek, 'SETTINGS', [
                    `${val} *${pending.label}* set to *${val}*`,
                    'This emoji will now be used! ✅'
                ]);
            }

            return await sendSettingsReply(conn, from, mek, 'SETTINGS', ['❌ *Unexpected pending state. Please use /settings again.*']);
        }

        // ── STEP 1: Direct number option ──────────────────────
        if (!menuMap[text]) return;

        const item = menuMap[text];
        await ensureLoaded(sender);

        // Fixed option (on/off/inbox...)
        if (!item.needsInput && item.value !== null) {
            await setSetting(sender, item.key, item.value);
            const icon = item.value === 'on' ? '✅' : item.value === 'off' ? '❌' : '✳️';
            return await sendSettingsReply(conn, from, mek, 'SETTINGS', [
                `${icon} *${item.label}* activated!`,
                `Current value: ${fmtVal(item.value)}`
            ]);
        }

        // Need custom input
        pendingSettings.set(sender, { ...item });
        setTimeout(() => { pendingSettings.delete(sender); }, 30000);

        const promptLines = [
            `⚙️ *${item.label}*`,
            '',
            `Reply with your desired ${item.optType === 'emoji' ? 'emoji' : 'value'}.`,
            '_⏱️ You have 30 seconds to reply._'
        ];
        await sendSettingsReply(conn, from, mek, 'SETTINGS', promptLines);

    } catch (e) {
        console.error('[SETTINGS BODY ERROR]', e);
    }
});

// ══════════════════════════════════════════════════════════════════
// INDIVIDUAL COMMANDS
// ══════════════════════════════════════════════════════════════════

// Anti Delete
cmd({
    pattern: "antidelete",
    desc: "Anti-delete: on | off | inbox | same",
    category: "settings", react: "🗑️", filename: __filename
}, async (conn, mek, m, { sender, args, from }) => {
    try {
        await ensureLoaded(sender);
        const val = args[0]?.toLowerCase();
        const valid = ['on','off','inbox','same'];
        if (!val || !valid.includes(val)) {
            const cur = getSetting(sender, 'ANTI_DELETE');
            return await sendSettingsReply(conn, from, mek, 'ANTI DELETE', [
                `Current: *${cur}*`,
                '',
                'Usage: /antidelete <on | off | inbox | same>',
                '• on — everywhere',
                '• off — disabled',
                '• inbox — private chats only',
                '• same — same chat'
            ]);
        }
        await setSetting(sender, 'ANTI_DELETE', val);
        const icon = {on:'✅',off:'❌',inbox:'📥',same:'💬'};
        await sendSettingsReply(conn, from, mek, 'ANTI DELETE', [`${icon[val]} *Anti Delete* → *${val.toUpperCase()}*`]);
    } catch(e) {
        await sendSettingsReply(conn, from, mek, 'ANTI DELETE', [`❌ ${e.message}`]);
    }
});

// Anti Edit
cmd({
    pattern: "antiedit",
    desc: "Anti-edit: on | off",
    category: "settings", react: "✏️", filename: __filename
}, async (conn, mek, m, { sender, args, from }) => {
    try {
        await ensureLoaded(sender);
        const val = args[0]?.toLowerCase();
        if (val === 'on' || val === 'off') {
            await setSetting(sender, 'ANTI_EDIT', val);
            await sendSettingsReply(conn, from, mek, 'ANTI EDIT', [`${val==='on'?'✅':'❌'} *Anti Edit* → *${val.toUpperCase()}*`]);
        } else {
            const nv = await toggleSetting(sender, 'ANTI_EDIT');
            await sendSettingsReply(conn, from, mek, 'ANTI EDIT', [`${nv==='on'?'✅':'❌'} *Anti Edit* toggled → *${nv.toUpperCase()}*`]);
        }
    } catch(e) {
        await sendSettingsReply(conn, from, mek, 'ANTI EDIT', [`❌ ${e.message}`]);
    }
});

// Anti Call
cmd({
    pattern: "anticall",
    desc: "Block calls: on | off",
    category: "settings", react: "📵", filename: __filename
}, async (conn, mek, m, { sender, args, from }) => {
    try {
        await ensureLoaded(sender);
        const val = args[0]?.toLowerCase();
        if (val === 'on' || val === 'off') {
            await setSetting(sender, 'ANTI_CALL', val);
            await sendSettingsReply(conn, from, mek, 'ANTI CALL', [`${val==='on'?'✅':'❌'} *Anti Call* → *${val.toUpperCase()}*`]);
        } else {
            const nv = await toggleSetting(sender, 'ANTI_CALL');
            await sendSettingsReply(conn, from, mek, 'ANTI CALL', [`${nv==='on'?'✅':'❌'} *Anti Call* toggled → *${nv.toUpperCase()}*`]);
        }
    } catch(e) {
        await sendSettingsReply(conn, from, mek, 'ANTI CALL', [`❌ ${e.message}`]);
    }
});

// Status React
cmd({
    pattern: "statusreact",
    desc: "Status react emoji. /statusreact 🔥 or off",
    category: "settings", react: "😍", filename: __filename
}, async (conn, mek, m, { sender, args, from }) => {
    try {
        await ensureLoaded(sender);
        const val = args[0];
        if (!val) {
            const cur = getSetting(sender, 'STATUS_REACT');
            return await sendSettingsReply(conn, from, mek, 'STATUS REACT', [
                `Current: *${cur}*`,
                '',
                'Usage: /statusreact 🔥  or  /statusreact off'
            ]);
        }
        const v = val.toLowerCase() === 'off' ? 'off' : val;
        await setSetting(sender, 'STATUS_REACT', v);
        await sendSettingsReply(conn, from, mek, 'STATUS REACT', [
            v==='off' ? '❌ *Status React* disabled' : `${v} *Status React* → *${v}*`
        ]);
    } catch(e) {
        await sendSettingsReply(conn, from, mek, 'STATUS REACT', [`❌ ${e.message}`]);
    }
});

// Auto React
cmd({
    pattern: "autoreact",
    desc: "Auto react emoji. /autoreact 😂 or off",
    category: "settings", react: "🎭", filename: __filename
}, async (conn, mek, m, { sender, args, from }) => {
    try {
        await ensureLoaded(sender);
        const val = args[0];
        if (!val) {
            const cur = getSetting(sender, 'AUTO_REACT');
            return await sendSettingsReply(conn, from, mek, 'AUTO REACT', [
                `Current: *${cur}*`,
                '',
                'Usage: /autoreact 😂  or  /autoreact off'
            ]);
        }
        const v = val.toLowerCase() === 'off' ? 'off' : val;
        await setSetting(sender, 'AUTO_REACT', v);
        await sendSettingsReply(conn, from, mek, 'AUTO REACT', [
            v==='off' ? '❌ *Auto React* disabled' : `${v} *Auto React* → *${v}*`
        ]);
    } catch(e) {
        await sendSettingsReply(conn, from, mek, 'AUTO REACT', [`❌ ${e.message}`]);
    }
});

// Auto View Status
cmd({
    pattern: "autoviewstatus",
    alias: ["autoview"],
    desc: "Auto view status: on | off",
    category: "settings", react: "👁️", filename: __filename
}, async (conn, mek, m, { sender, args, from }) => {
    try {
        await ensureLoaded(sender);
        const val = args[0]?.toLowerCase();
        if (val === 'on' || val === 'off') {
            await setSetting(sender, 'AUTO_VIEW_STATUS', val);
            await sendSettingsReply(conn, from, mek, 'AUTO VIEW STATUS', [`${val==='on'?'✅':'❌'} *Auto View Status* → *${val.toUpperCase()}*`]);
        } else {
            const nv = await toggleSetting(sender, 'AUTO_VIEW_STATUS');
            await sendSettingsReply(conn, from, mek, 'AUTO VIEW STATUS', [`${nv==='on'?'✅':'❌'} *Auto View Status* toggled → *${nv.toUpperCase()}*`]);
        }
    } catch(e) {
        await sendSettingsReply(conn, from, mek, 'AUTO VIEW STATUS', [`❌ ${e.message}`]);
    }
});

// Auto Like Status
cmd({
    pattern: "autelikestatus",
    alias: ["autolike"],
    desc: "Auto like status: on | off",
    category: "settings", react: "❤️", filename: __filename
}, async (conn, mek, m, { sender, args, from }) => {
    try {
        await ensureLoaded(sender);
        const val = args[0]?.toLowerCase();
        if (val === 'on' || val === 'off') {
            await setSetting(sender, 'AUTO_LIKE_STATUS', val);
            await sendSettingsReply(conn, from, mek, 'AUTO LIKE STATUS', [`${val==='on'?'✅':'❌'} *Auto Like Status* → *${val.toUpperCase()}*`]);
        } else {
            const nv = await toggleSetting(sender, 'AUTO_LIKE_STATUS');
            await sendSettingsReply(conn, from, mek, 'AUTO LIKE STATUS', [`${nv==='on'?'✅':'❌'} *Auto Like Status* toggled → *${nv.toUpperCase()}*`]);
        }
    } catch(e) {
        await sendSettingsReply(conn, from, mek, 'AUTO LIKE STATUS', [`❌ ${e.message}`]);
    }
});

// Auto Recording
cmd({
    pattern: "autorecording",
    alias: ["autorec"],
    desc: "Auto recording indicator: on | off",
    category: "settings", react: "🎙️", filename: __filename
}, async (conn, mek, m, { sender, args, from }) => {
    try {
        await ensureLoaded(sender);
        const val = args[0]?.toLowerCase();
        if (val === 'on' || val === 'off') {
            await setSetting(sender, 'AUTO_RECORDING', val);
            await sendSettingsReply(conn, from, mek, 'AUTO RECORDING', [`${val==='on'?'✅':'❌'} *Auto Recording* → *${val.toUpperCase()}*`]);
        } else {
            const nv = await toggleSetting(sender, 'AUTO_RECORDING');
            await sendSettingsReply(conn, from, mek, 'AUTO RECORDING', [`${nv==='on'?'✅':'❌'} *Auto Recording* toggled → *${nv.toUpperCase()}*`]);
        }
    } catch(e) {
        await sendSettingsReply(conn, from, mek, 'AUTO RECORDING', [`❌ ${e.message}`]);
    }
});

// Anti Fake
cmd({
    pattern: "antifake",
    desc: "Block fake numbers: on | off",
    category: "settings", react: "🚫", filename: __filename
}, async (conn, mek, m, { sender, args, from }) => {
    try {
        await ensureLoaded(sender);
        const val = args[0]?.toLowerCase();
        if (val === 'on' || val === 'off') {
            await setSetting(sender, 'ANTI_FAKE', val);
            await sendSettingsReply(conn, from, mek, 'ANTI FAKE', [`${val==='on'?'✅':'❌'} *Anti Fake* → *${val.toUpperCase()}*`]);
        } else {
            const nv = await toggleSetting(sender, 'ANTI_FAKE');
            await sendSettingsReply(conn, from, mek, 'ANTI FAKE', [`${nv==='on'?'✅':'❌'} *Anti Fake* toggled → *${nv.toUpperCase()}*`]);
        }
    } catch(e) {
        await sendSettingsReply(conn, from, mek, 'ANTI FAKE', [`❌ ${e.message}`]);
    }
});

// Welcome
cmd({
    pattern: "welcome",
    desc: "Group welcome message: on | off",
    category: "settings", react: "👋", filename: __filename
}, async (conn, mek, m, { sender, args, from }) => {
    try {
        await ensureLoaded(sender);
        const val = args[0]?.toLowerCase();
        if (val === 'on' || val === 'off') {
            await setSetting(sender, 'WELCOME', val);
            await sendSettingsReply(conn, from, mek, 'WELCOME', [`${val==='on'?'✅':'❌'} *Welcome* → *${val.toUpperCase()}*`]);
        } else {
            const nv = await toggleSetting(sender, 'WELCOME');
            await sendSettingsReply(conn, from, mek, 'WELCOME', [`${nv==='on'?'✅':'❌'} *Welcome* toggled → *${nv.toUpperCase()}*`]);
        }
    } catch(e) {
        await sendSettingsReply(conn, from, mek, 'WELCOME', [`❌ ${e.message}`]);
    }
});

// Goodbye
cmd({
    pattern: "goodbye",
    desc: "Group goodbye message: on | off",
    category: "settings", react: "🚶", filename: __filename
}, async (conn, mek, m, { sender, args, from }) => {
    try {
        await ensureLoaded(sender);
        const val = args[0]?.toLowerCase();
        if (val === 'on' || val === 'off') {
            await setSetting(sender, 'GOODBYE', val);
            await sendSettingsReply(conn, from, mek, 'GOODBYE', [`${val==='on'?'✅':'❌'} *Goodbye* → *${val.toUpperCase()}*`]);
        } else {
            const nv = await toggleSetting(sender, 'GOODBYE');
            await sendSettingsReply(conn, from, mek, 'GOODBYE', [`${nv==='on'?'✅':'❌'} *Goodbye* toggled → *${nv.toUpperCase()}*`]);
        }
    } catch(e) {
        await sendSettingsReply(conn, from, mek, 'GOODBYE', [`❌ ${e.message}`]);
    }
});

// Set Prefix
cmd({
    pattern: "setprefix",
    desc: "Change command prefix. /setprefix !",
    category: "settings", react: "🔧", filename: __filename
}, async (conn, mek, m, { sender, args, from }) => {
    try {
        await ensureLoaded(sender);
        const newPrefix = args[0];
        if (!newPrefix) {
            const cur = getSetting(sender, 'PREFIX');
            return await sendSettingsReply(conn, from, mek, 'SET PREFIX', [
                `Current: *${cur}*`,
                '',
                'Usage: /setprefix <symbol>',
                'Examples: /setprefix !  /setprefix .  /setprefix #'
            ]);
        }
        if (newPrefix.length > 5) return await sendSettingsReply(conn, from, mek, 'SET PREFIX', ['❌ *Prefix too long.* Use 1–5 characters.']);
        if (/\s/.test(newPrefix)) return await sendSettingsReply(conn, from, mek, 'SET PREFIX', ['❌ *Prefix cannot contain spaces.*']);
        await setSetting(sender, 'PREFIX', newPrefix);
        await sendSettingsReply(conn, from, mek, 'SET PREFIX', [
            `✅ *Prefix updated!*`,
            `New prefix: *${newPrefix}*`,
            `Now use: *${newPrefix}ping*`
        ]);
    } catch(e) {
        await sendSettingsReply(conn, from, mek, 'SET PREFIX', [`❌ ${e.message}`]);
    }
});

// Mode — now global from config.js
cmd({
    pattern: "mode",
    desc: "Check/set bot mode (global) — edit config.js",
    category: "settings", react: "🔒", filename: __filename
}, async (conn, mek, m, { sender, args, from }) => {
    try {
        const cfg = require('../config');
        const currentMode = cfg.MODE || 'private';
        await sendSettingsReply(conn, from, mek, 'BOT MODE', [
            `🌐 *Bot Mode is now global*`,
            `Current mode: *${currentMode.toUpperCase()}*`,
            '',
            '⚠️ Mode can only be changed in config.js',
            'Edit the MODE value in config.js then restart.',
            '',
            '• public  — Everyone can use commands',
            '• private — Only owner can use commands'
        ]);
    } catch(e) {
        await sendSettingsReply(conn, from, mek, 'BOT MODE', [`❌ ${e.message}`]);
    }
});