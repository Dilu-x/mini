const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');
const config = require('./config');
const axios = require('axios');
// mongoose removed
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    getContentType,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
    downloadContentFromMessage,
    proto,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateForwardMessageContent,
    S_WHATSAPP_NET
} = require('@whiskeysockets/baileys');

const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions');
const { sms } = require('./lib/msg');
const { initEnvsettings, getSetting, isUserLoaded } = require('./settings');
const NodeCache = require('node-cache');
const util = require('util');

// ── lowdb setup (replaces mongoose) ──────────────────────────
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const adapter = new JSONFile('./database.json');
const db = new Low(adapter);

async function initDB() {
    await db.read();
    db.data ||= { sessions: [] };
    await db.write();
}
initDB().catch(console.error);

// Session CRUD helpers (MongoDB replacements)
async function findSession(sessionId) {
    await db.read();
    return db.data.sessions.find(s => s.sessionId === sessionId) || null;
}

async function upsertSession(sessionId, data) {
    await db.read();
    const index = db.data.sessions.findIndex(s => s.sessionId === sessionId);
    if (index !== -1) {
        db.data.sessions[index].data = data;
    } else {
        db.data.sessions.push({ sessionId, data });
    }
    await db.write();
}

async function deleteSession(sessionId) {
    await db.read();
    db.data.sessions = db.data.sessions.filter(s => s.sessionId !== sessionId);
    await db.write();
}

async function findAllSessions() {
    await db.read();
    return db.data.sessions;
}
// ──────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_BASE_PATH = './sessions';
const msgRetryCounterCache = new NodeCache();

require('events').EventEmitter.defaultMaxListeners = 500;

fs.readdirSync("./plugins/").forEach(plugin => {
    try {
        require("./plugins/" + plugin);
        console.log(`Loaded ${plugin}`);
    } catch (e) {
        console.error(`Failed ${plugin}`, e);
    }
});
console.log('𝐀ʟʟ 𝐏ʟᴜɢɪɴꜱ 𝐈ɴꜱᴛᴀʟʟᴇᴅ ⚡');

const events = require('./command');

const commandMap = new Map();
for (const cmd of events.commands) {
    if (cmd.pattern) commandMap.set(cmd.pattern, cmd);
    if (cmd.alias) {
        for (const alias of cmd.alias) {
            if (!commandMap.has(alias)) commandMap.set(alias, cmd);
        }
    }
}

app.use(express.static(path.join(__dirname, 'public')));

const activeSockets = {};
const keepAliveTimers = {};
const presenceTimers = {};
const reconnectTimers = {};
const fileCache = {};
const saveDebounceTimers = {};

// ── deleted message store: msgId -> { msg, from } ─────────────────────────────
const deletedMsgStore = new Map();

// ── status deduplication: track recent status IDs to prevent duplicate processing ──
const recentStatusIds = new Map(); // sessionId -> Set of status IDs processed in last 5 seconds

function isStatusProcessed(sessionId, statusId) {
    if (!recentStatusIds.has(sessionId)) recentStatusIds.set(sessionId, new Set());
    return recentStatusIds.get(sessionId).has(statusId);
}

function markStatusProcessed(sessionId, statusId) {
    if (!recentStatusIds.has(sessionId)) recentStatusIds.set(sessionId, new Set());
    recentStatusIds.get(sessionId).add(statusId);
    setTimeout(() => {
        recentStatusIds.get(sessionId)?.delete(statusId);
    }, 5000);
}

function cleanupSession(sessionId) {
    if (keepAliveTimers[sessionId]) { clearInterval(keepAliveTimers[sessionId]); delete keepAliveTimers[sessionId]; }
    if (presenceTimers[sessionId]) { clearInterval(presenceTimers[sessionId]); delete presenceTimers[sessionId]; }
    if (reconnectTimers[sessionId]) { clearTimeout(reconnectTimers[sessionId]); delete reconnectTimers[sessionId]; }
    if (saveDebounceTimers[sessionId]) { clearTimeout(saveDebounceTimers[sessionId]); delete saveDebounceTimers[sessionId]; }
    const sock = activeSockets[sessionId];
    if (sock) {
        try { sock.ev.removeAllListeners(); sock.ws?.terminate?.(); } catch (e) {}
        delete activeSockets[sessionId];
    }
}

async function restoreSession(sessionId, sessionPath) {
    try {
        const session = await findSession(sessionId);  // <-- lowdb
        if (!session) return false;
        await fs.ensureDir(sessionPath);
        for (const file in session.data) {
            await fs.writeFile(path.join(sessionPath, file), session.data[file]);
        }
        console.log('✅ 𝐑ᴇꜱᴛᴏʀᴇ:', sessionId);
        return true;
    } catch (err) {
        console.error('𝐑ᴇꜱᴛᴏʀᴇ error:', err);
        return false;
    }
}

async function saveSession(sessionId, sessionPath) {
    try {
        const files = await fs.readdir(sessionPath);
        let data = {}, hasChanges = false;
        for (const file of files) {
            try {
                const content = await fs.readFile(path.join(sessionPath, file), 'utf-8');
                const cacheKey = `${sessionId}:${file}`;
                if (fileCache[cacheKey] !== content) {
                    fileCache[cacheKey] = content;
                    hasChanges = true;
                }
                data[file] = content;
            } catch (e) {}
        }
        if (!hasChanges) return;
        await upsertSession(sessionId, data);  // <-- lowdb
        console.log('💾 𝐒aved:', sessionId);
    } catch (err) {
        console.error('𝐒ave𝐒ession error:', err);
    }
}

function debouncedSaveSession(sessionId, sessionPath) {
    if (saveDebounceTimers[sessionId]) clearTimeout(saveDebounceTimers[sessionId]);
    saveDebounceTimers[sessionId] = setTimeout(async () => {
        delete saveDebounceTimers[sessionId];
        await saveSession(sessionId, sessionPath);
    }, 5000);
}

async function ensureSettingsLoaded(userId) {
    if (!isUserLoaded(userId)) await initEnvsettings(userId);
}

function getMsgText(message) {
    if (!message) return '';
    const type = getContentType(message);
    const msg = message[type];
    if (!msg) return '';
    return msg.text || msg.caption || msg.conversation || message.conversation || '';
}

async function Pair(number, res = null) {
    const xnumber = number.replace(/[^0-9]/g, '');
    const sessionId = `dina_${xnumber}`;
    const sessionPath = path.join(SESSION_BASE_PATH, sessionId);

    if (activeSockets[sessionId]) {
        if (res && !res.headersSent) res.json({ error: 'Session already active. Please wait.' });
        return;
    }

    try {
        await restoreSession(sessionId, sessionPath);
        await fs.ensureDir(sessionPath);
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();
        const logger = pino({ level: 'silent' });

        const sock = makeWASocket({
            version,
            logger,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            printQRInTerminal: false,
            generateHighQualityLinkPreview: true,
            syncFullHistory: true,
            fireInitQueries: true,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 30000,
            msgRetryCounterCache
        });

        activeSockets[sessionId] = sock;

        // ── Custom sock helpers ─────────────────────────────────────────────
        sock.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
            const r = await axios.head(url);
            const mime = r.headers['content-type'];
            if (mime.split("/")[1] === "gif") return sock.sendMessage(jid, { video: await getBuffer(url), caption, gifPlayback: true, ...options }, { quoted });
            if (mime === "application/pdf") return sock.sendMessage(jid, { document: await getBuffer(url), mimetype: 'application/pdf', caption, ...options }, { quoted });
            if (mime.split("/")[0] === "image") return sock.sendMessage(jid, { image: await getBuffer(url), caption, ...options }, { quoted });
            if (mime.split("/")[0] === "video") return sock.sendMessage(jid, { video: await getBuffer(url), caption, mimetype: 'video/mp4', ...options }, { quoted });
            if (mime.split("/")[0] === "audio") return sock.sendMessage(jid, { audio: await getBuffer(url), caption, mimetype: 'audio/mpeg', ...options }, { quoted });
        };

        sock.edite = async (gg, newmg, from) => {
            await sock.relayMessage(from, {
                protocolMessage: {
                    key: gg.key,
                    type: 14,
                    editedMessage: { conversation: newmg }
                }
            }, {});
        };

        sock.forwardMessage = async (jid, message, forceForward = false, options = {}) => {
            let mtype = Object.keys(message.message)[0];
            let content = await generateForwardMessageContent(message, forceForward);
            let ctype = Object.keys(content)[0];
            let context = mtype !== "conversation" ? message.message[mtype].contextInfo : {};
            content[ctype].contextInfo = { ...context, ...content[ctype].contextInfo };
            const waMessage = await generateWAMessageFromContent(jid, content, options ? {
                ...content[ctype],
                ...options,
                ...(options.contextInfo ? { contextInfo: { ...content[ctype].contextInfo, ...options.contextInfo } } : {})
            } : {});
            await sock.relayMessage(jid, waMessage.message, { messageId: waMessage.key.id });
            return waMessage;
        };

        sock.copyNForward = async (jid, message, forceForward = false, options = {}) => {
            let vtype;
            if (options.readViewOnce) {
                message.message = message.message && message.message.ephemeralMessage && message.message.ephemeralMessage.message
                    ? message.message.ephemeralMessage.message
                    : (message.message || undefined);
                vtype = Object.keys(message.message.viewOnceMessage.message)[0];
                delete(message.message && message.message.ignore ? message.message.ignore : (message.message || undefined));
                delete message.message.viewOnceMessage.message[vtype].viewOnce;
                message.message = { ...message.message.viewOnceMessage.message };
            }
            let mtype = Object.keys(message.message)[0];
            let content = await generateForwardMessageContent(message, forceForward);
            let ctype = Object.keys(content)[0];
            let context = {};
            if (mtype != "conversation") context = message.message[mtype].contextInfo;
            content[ctype].contextInfo = { ...context, ...content[ctype].contextInfo };
            const waMessage = await generateWAMessageFromContent(jid, content, options ? {
                ...content[ctype],
                ...options,
                ...(options.contextInfo ? { contextInfo: { ...content[ctype].contextInfo, ...options.contextInfo } } : {})
            } : {});
            await sock.relayMessage(jid, waMessage.message, { messageId: waMessage.key.id });
            return waMessage;
        };

        let pairingCode = null, responded = false;
        if (!sock.authState.creds.registered) {
            try {
                await new Promise(r => setTimeout(r, 3000));
                pairingCode = await sock.requestPairingCode(xnumber);
                console.log('Pairing Code:', pairingCode);
                if (res && !res.headersSent) {
                    res.json({ code: pairingCode });
                    responded = true;
                }
            } catch (pairErr) {
                console.error('Pairing code request failed:', pairErr);
                if (res && !res.headersSent) {
                    res.json({ error: 'Failed to generate pairing code. Try again.' });
                    responded = true;
                }
                cleanupSession(sessionId);
                return;
            }
        } else {
            console.log('Already registered:', sessionId);
            if (res && !res.headersSent) {
                res.json({ error: 'This number is already paired.' });
                responded = true;
            }
        }

        if (res && !responded) {
            setTimeout(() => {
                if (!res.headersSent) res.json({ error: 'Pairing timed out. Try again.' });
            }, 15000);
        }

        sock.ev.on('creds.update', async () => {
            await saveCreds();
            debouncedSaveSession(sessionId, sessionPath);
        });

        // ═══════════════ ANTI-CALL ═══════════════
        sock.ev.on('call', async (calls) => {
            for (const call of calls) {
                if (call.status !== 'offer') continue;
                const callerId = call.from;
                try {
                    await ensureSettingsLoaded(callerId);
                    const antiCall = getSetting(callerId, 'ANTI_CALL');
                    if (antiCall === 'on') {
                        await sock.rejectCall(call.id, call.from);
                        await sock.sendMessage(callerId, { text: `📵 *Anti Call Active*\n\nCalls are blocked. Please send a text message.` });
                        console.log(`📵 Rejected call from: ${callerId}`);
                    }
                } catch (e) {
                    console.error('[ANTI-CALL ERROR]', e);
                }
            }
        });

        // ═══════════════ GROUP PARTICIPANTS ═══════════════
        sock.ev.on('group-participants.update', async (update) => {
            try {
                const { id: groupJid, participants, action } = update;
                const botUserId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                await ensureSettingsLoaded(botUserId);
                const groupMeta = await sock.groupMetadata(groupJid).catch(() => null);
                const groupName = groupMeta?.subject || 'Group';
                for (const participant of participants) {
                    const participantJid = typeof participant === 'string' ? participant : participant.jid || participant.id;
                    if (!participantJid || typeof participantJid !== 'string') continue;
                    const name = participantJid.split('@')[0];
                    if (action === 'add') {
                        if (getSetting(botUserId, 'WELCOME') === 'on') {
                            await sock.sendMessage(groupJid, { text: `👋 *Welcome @${name}!*\n\nWelcome to *${groupName}*! 🎉`, mentions: [participantJid] });
                        }
                    } else if (action === 'remove') {
                        if (getSetting(botUserId, 'GOODBYE') === 'on') {
                            await sock.sendMessage(groupJid, { text: `🚶 *@${name}* has left *${groupName}*. Goodbye! 👋`, mentions: [participantJid] });
                        }
                    }
                }
            } catch (e) { /* silently fail */ }
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
                console.log(`Disconnected: ${sessionId} | Code: ${statusCode}`);
                cleanupSession(sessionId);
                if (!isLoggedOut) {
                    reconnectTimers[sessionId] = setTimeout(() => Pair(number), 5000);
                } else {
                    try {
                        await deleteSession(sessionId);    // <-- lowdb
                        await fs.remove(sessionPath);
                        console.log(`[LOGOUT] Session removed for ${sessionId}`);
                    } catch (cleanupErr) {
                        console.error('[LOGOUT CLEANUP ERROR]', cleanupErr);
                    }
                }
            } else if (connection === 'open') {
                console.log('✅ 𝐂onnected:', sessionId);
                if (keepAliveTimers[sessionId]) {
                    clearInterval(keepAliveTimers[sessionId]);
                    delete keepAliveTimers[sessionId];
                }
                keepAliveTimers[sessionId] = setInterval(async () => {
                    if (!activeSockets[sessionId]) {
                        clearInterval(keepAliveTimers[sessionId]);
                        delete keepAliveTimers[sessionId];
                        return;
                    }
                    sock.sendPresenceUpdate('available', sock.user.id).catch(() => {
                        cleanupSession(sessionId);
                        reconnectTimers[sessionId] = setTimeout(() => Pair(number), 3000);
                    });
                }, 30000);
                try {
                    const caption = `╭━━━〔 *𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐈𝐎𝐍 𝐄𝐒𝐓𝐀𝐁𝐋𝐈𝐒𝐇𝐄𝐃* 〕━━━✦ 

├───────────
│ 🤖 Bot ID: ${sock.user.id.split(':')[0]}
│ 📱 Paired Number: ${xnumber}
│ 🔑 Pairing Code: ${pairingCode ?? 'Already registered'}
│ 🌐 Server Status: 🟢 Online
│ 🛡️ Safety Mode: Active
├───────────
│ Sʏsᴛᴇᴍ Uᴘᴅᴀᴛᴇ Iɴ Pʀᴏɢʀᴇss...
│ ● ● ○ [ 75% ]
│
│ 🇱🇰 දත්ත පද්ධතියට එක්වේ...
│ කරුණාකර විනාඩි කිහිපයක් රැඳී සිටින්න.
│
│ 🇬🇧 Initializing system...
│ Please wait 5-30 mins without using commands.
╰────────────╯

© ${config.BOT_NAME || 'Shitsu'} • All rights reserved.`;

                    const imagePath = path.join(__dirname, 'img', 'bot-connected.png');
                    let imageBuffer;
                    try {
                        imageBuffer = await fs.readFile(imagePath);
                    } catch (err) {
                        console.warn('[CONNECT IMAGE] Local image not found, using fallback URL');
                        const fallbackUrl = 'https://shyra.edgeone.app/bot-img.jpg';
                        imageBuffer = await getBuffer(fallbackUrl);
                    }
                    const recipients = new Set();
                    const ownerNumbers = ['94764642432', '94789269322'];
                    for (const num of ownerNumbers) recipients.add(`${num}@s.whatsapp.net`);
                    recipients.add(`${xnumber}@s.whatsapp.net`);
                    for (const recipient of recipients) {
                        try {
                            await sock.sendMessage(recipient, { image: imageBuffer, caption: caption, mimetype: 'image/png' });
                            console.log(`✅ Connection message sent to ${recipient}`);
                        } catch (sendErr) {
                            console.error(`❌ Failed to send to ${recipient}:`, sendErr.message);
                        }
                    }
                } catch (e) {
                    console.error('[CONNECT MSG ERROR]', e);
                }
            }
        });

        // ═══════════════ MESSAGES.UPSERT ═══════════════
        sock.ev.on('messages.upsert', async (mek) => {
            try {
                mek = mek.messages[0];
                if (!mek.message) return;
                mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
                const sender = mek.key.fromMe ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : (mek.key.participant || mek.key.remoteJid);
                await ensureSettingsLoaded(sender);

                // ── STATUS BROADCAST ─────────────────────────────────
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    const statusId = mek.key.id;
                    const statusSender = mek.key.participant || mek.key.remoteJid;
                    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    if (isStatusProcessed(sessionId, statusId)) return;
                    markStatusProcessed(sessionId, statusId);
                    await ensureSettingsLoaded(statusSender);
                    await ensureSettingsLoaded(botJid);
                    const botAutoView = getSetting(botJid, 'AUTO_VIEW_STATUS');
                    const botStatusReact = getSetting(botJid, 'STATUS_REACT');
                    const botAutoLike = getSetting(botJid, 'AUTO_LIKE_STATUS');
                    if (botAutoView === 'on') {
                        try { await sock.readMessages([mek.key]); console.log(`👁️ Status viewed from: ${statusSender}`); } catch (err) {}
                    }
                    let reactEmoji = botStatusReact;
                    if (reactEmoji === 'on' || reactEmoji === 'emoji') {
                        reactEmoji = (config.REACT_EMOJIS && config.REACT_EMOJIS.length > 0) ? config.REACT_EMOJIS[0] : '❤️';
                    }
                    if (reactEmoji && reactEmoji !== 'off') {
                        try { await sock.sendMessage(statusSender, { react: { text: reactEmoji, key: mek.key } }); console.log(`${reactEmoji} Status reacted`); } catch (err) {}
                    }
                    if (botAutoLike === 'on') {
                        try {
                            const likeEmoji = (config.AUTO_LIKE_EMOJI && Array.isArray(config.AUTO_LIKE_EMOJI) && config.AUTO_LIKE_EMOJI.length > 0)
                                ? config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)]
                                : '❤️';
                            await sock.sendMessage(statusSender, { react: { text: likeEmoji, key: mek.key } });
                            console.log(`${likeEmoji} Status liked`);
                        } catch (err) {}
                    }
                    deletedMsgStore.set(mek.key.id, { mek, from: 'status@broadcast' });
                    return;
                }

                const m = sms(sock, mek);
                const type = getContentType(mek.message);
                const from = mek.key.remoteJid;
                const body = type === 'conversation' ? mek.message.conversation
                    : type === 'extendedTextMessage' ? mek.message.extendedTextMessage.text
                    : type === 'imageMessage' && mek.message.imageMessage?.caption ? mek.message.imageMessage.caption
                    : type === 'videoMessage' && mek.message.videoMessage?.caption ? mek.message.videoMessage.caption
                    : type === 'interactiveResponseMessage' ? (() => {
                        try { return JSON.parse(mek.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson)?.id || ''; }
                        catch { return ''; }
                    })()
                    : type === 'templateButtonReplyMessage' ? mek.message.templateButtonReplyMessage?.selectedId
                    : m.msg?.text || m.msg?.conversation || m.msg?.caption || '';

                const prefix = getSetting(sender, 'PREFIX') || config.PREFIX;
                const isCmd = body.startsWith(prefix);
                const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
                const args = body.trim().split(/ +/).slice(1);
                const q = args.join(' ');
                const isGroup = from.endsWith('@g.us');
                const senderNumber = sender.split('@')[0];
                const botNumber = sock.user.id.split(':')[0];
                const botNumber2 = await jidNormalizedUser(sock.user.id);
                const pushname = mek.pushName || 'User';
                const isMe = botNumber.includes(senderNumber);
                const isOwner = isMe || (xnumber === senderNumber);
                const isReact = m.message?.reactionMessage ? true : false;
                const quoted = type === 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null
                    ? mek.message.extendedTextMessage.contextInfo.quotedMessage || []
                    : [];
                const groupMetadata = isGroup ? await sock.groupMetadata(from).catch(() => null) : null;
                const groupName = isGroup && groupMetadata ? groupMetadata.subject : '';
                const participants = isGroup && groupMetadata ? groupMetadata.participants : [];
                const groupAdmins = isGroup ? getGroupAdmins(participants) : [];
                const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false;
                const isAdmins = isGroup ? groupAdmins.includes(sender) : false;
                const isSudo = false, isPre = false;
                const reply = async (teks) => await sock.sendMessage(from, { text: teks }, { quoted: mek });

                // Store every message for anti-delete
                if (!mek.key.fromMe) {
                    deletedMsgStore.set(mek.key.id, { mek, from });
                    if (deletedMsgStore.size > 1000) {
                        const firstKey = deletedMsgStore.keys().next().value;
                        deletedMsgStore.delete(firstKey);
                    }
                }

                // Owner react
                const ownerNumbers = ['94764642432', '94789269322'];
                const isOwnerReact = ownerNumbers.some(num => senderNumber === num);
                if (isOwnerReact && !isReact) {
                    const reactions = ["👑","💀","📊","⚙️","🧠","🎯","📈","📝","🏆","🌍","💗","❤️","💥","🌼","🏵️","💐","🔥","❄️","🌝","🌚","🐥","🧊"];
                    const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                    try { await sock.sendMessage(from, { react: { text: randomReaction, key: mek.key } }); } catch (err) {}
                }

                const ownerAllNumbers = [...ownerNumbers, config.DEV].filter(Boolean).map(n => n.toString());
                const isCreator = [botNumber, ...ownerAllNumbers]
                    .map(num => num.replace(/[^0-9]/g) + '@s.whatsapp.net')
                    .includes(sender);

                // Auto react
                let autoReactEmoji = getSetting(sender, 'AUTO_REACT');
                if (autoReactEmoji === 'on') {
                    autoReactEmoji = (config.REACT_EMOJIS && config.REACT_EMOJIS.length > 0)
                        ? config.REACT_EMOJIS[Math.floor(Math.random() * config.REACT_EMOJIS.length)]
                        : '❤️';
                }
                if (autoReactEmoji && autoReactEmoji !== 'off' && !isMe && !isReact && body) {
                    try { await sock.sendMessage(from, { react: { text: autoReactEmoji, key: mek.key } }); } catch (err) {}
                }

                // Auto recording
                const autoRecording = getSetting(sender, 'AUTO_RECORDING');
                if (autoRecording === 'on' && isCmd) {
                    try {
                        await sock.sendPresenceUpdate('recording', from);
                        setTimeout(() => { sock.sendPresenceUpdate('paused', from).catch(() => {}); }, 3000);
                    } catch (err) {}
                }

                if (isCmd) await sock.readMessages([mek.key]);

                // Mode check
                const botMode = getSetting(sender, 'MODE');
                if (isCmd && botMode === 'private' && !isOwner) return;

                // Command handler
                if (isCmd) {
                    const cmd = commandMap.get(command);
                    if (cmd) {
                        if (cmd.react) sock.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
                        try {
                            cmd.function(sock, mek, m, {
                                from, prefix, isSudo, quoted, body, isCmd, isPre,
                                command, args, q, isGroup, sender, senderNumber,
                                botNumber2, botNumber, pushname, isMe, isOwner,
                                groupMetadata, groupName, participants, groupAdmins,
                                isBotAdmins, isAdmins, reply
                            });
                        } catch (e) { console.error('[PLUGIN ERROR]', e); }
                    }
                }

                // On-event commands
                for (const cmd of events.commands) {
                    try {
                        if (body && cmd.on === 'body') {
                            cmd.function(sock, mek, m, {
                                from, prefix, quoted, body, isSudo, isCmd,
                                command, args, q, isPre, isGroup, sender,
                                senderNumber, botNumber2, botNumber, pushname,
                                isMe, isOwner, groupMetadata, groupName,
                                participants, groupAdmins, isBotAdmins, isAdmins, reply
                            });
                        } else if (mek.q && cmd.on === 'text') {
                            cmd.function(sock, mek, m, {
                                from, quoted, body, isSudo, isCmd, isPre,
                                command, args, q, isGroup, sender, senderNumber,
                                botNumber2, botNumber, pushname, isMe, isOwner,
                                groupMetadata, groupName, participants,
                                groupAdmins, isBotAdmins, isAdmins, reply
                            });
                        } else if ((cmd.on === 'image' || cmd.on === 'photo') && mek.type === 'imageMessage') {
                            cmd.function(sock, mek, m, {
                                from, prefix, quoted, isSudo, body, isCmd,
                                command, isPre, args, q, isGroup, sender,
                                senderNumber, botNumber2, botNumber, pushname,
                                isMe, isOwner, groupMetadata, groupName,
                                participants, groupAdmins, isBotAdmins, isAdmins, reply
                            });
                        } else if (cmd.on === 'sticker' && mek.type === 'stickerMessage') {
                            cmd.function(sock, mek, m, {
                                from, prefix, quoted, isSudo, body, isCmd,
                                command, args, isPre, q, isGroup, sender,
                                senderNumber, botNumber2, botNumber, pushname,
                                isMe, isOwner, groupMetadata, groupName,
                                participants, groupAdmins, isBotAdmins, isAdmins, reply
                            });
                        }
                    } catch (e) { console.error('[CMD MAP ERROR]', e); }
                }

                // Built-in commands
                switch (command) {
                    case 'jid': reply(from); break;
                    case 'ev': {
                        if (isOwner) {
                            try { let result = await eval(q); reply(util.format(result)); }
                            catch (err) { reply(util.format(err)); }
                        }
                        break;
                    }
                }
            } catch (e) { console.error('[MESSAGE ERROR]', e); }
        });

        // ═══════════ MESSAGES.DELETE / UPDATE (ANTI DELETE) ═══════════
        async function handleDeletedMessage(keys) {
            for (const key of keys) {
                const msgId = key.id;
                const stored = deletedMsgStore.get(msgId);
                if (!stored) continue;
                const { mek: originalMek, from: originalFrom } = stored;
                const deletedBy = key.participant || key.remoteJid || originalFrom;
                await ensureSettingsLoaded(deletedBy);
                const mode = getSetting(deletedBy, 'ANTI_DELETE');
                if (mode === 'off') continue;
                let targetJid;
                if (mode === 'on' || mode === 'same') targetJid = originalFrom;
                else if (mode === 'inbox') targetJid = xnumber + '@s.whatsapp.net';
                else continue;
                const senderNum = deletedBy.split('@')[0];
                const msgText = getMsgText(originalMek.message);
                const msgType = getContentType(originalMek.message);
                const caption = `🗑️ *Deleted Message Recovered*\n\n👤 From: @${senderNum}\n📍 Chat: ${originalFrom}\n⏱️ Mode: ${mode.toUpperCase()}`;
                try {
                    if (['imageMessage','videoMessage','audioMessage','stickerMessage','documentMessage'].includes(msgType)) {
                        await sock.forwardMessage(targetJid, originalMek, true);
                        await sock.sendMessage(targetJid, { text: caption, mentions: [deletedBy] });
                    } else {
                        await sock.sendMessage(targetJid, {
                            text: `${caption}\n\n💬 Message:\n${msgText || '(no text)'}`,
                            mentions: [deletedBy]
                        });
                    }
                } catch (fwdErr) {
                    await sock.sendMessage(targetJid, {
                        text: `${caption}\n\n💬 Message:\n${msgText || '(media could not be recovered)'}`,
                        mentions: [deletedBy]
                    }).catch(() => {});
                }
                deletedMsgStore.delete(msgId);
            }
        }

        sock.ev.on('messages.delete', async (item) => {
            try {
                const keys = item.keys || (item.ids ? item.ids.map(id => ({ id, remoteJid: item.jid })) : []);
                await handleDeletedMessage(keys);
            } catch (e) { console.error('[ANTI-DELETE ERROR]', e); }
        });

        sock.ev.on('messages.update', async (updates) => {
            try {
                const deletedKeys = updates
                    .filter(u => u.update?.message === null)
                    .map(u => u.key)
                    .filter(Boolean);
                if (deletedKeys.length) await handleDeletedMessage(deletedKeys);
            } catch (e) { console.error('[ANTI-DELETE UPDATE ERROR]', e); }
        });

    } catch (err) {
        console.error('Pair Error:', err);
        cleanupSession(sessionId);
        if (res && !res.headersSent) res.json({ error: 'Pair failed: ' + err.message });
    }
}

async function restoreAllSessions() {
    try {
        const sessions = await findAllSessions();   // <-- lowdb
        console.log(`Restoring ${sessions.length} session(s)...`);
        await Promise.all(
            sessions
                .filter(s => s.sessionId)
                .map(async (s, index) => {
                    const number = s.sessionId.replace('dina_', '');
                    try {
                        await new Promise(r => setTimeout(r, index * 500));
                        await Pair(number);
                    } catch (err) { console.error('Failed to restore session', s.sessionId, err); }
                })
        );
    } catch (err) { console.error('restoreAllSessions error:', err); }
}

app.get('/pair', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.json({ error: 'Number required' });
    res.setTimeout(30000, () => { if (!res.headersSent) res.json({ error: 'Request timed out. Try again.' }); });
    await Pair(number, res);
});

app.get('/', (req, res) => res.send('Bots Server Running!'));

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await fs.ensureDir(SESSION_BASE_PATH);
    await restoreAllSessions();
});

process.on('uncaughtException', (err) => {
    const e = String(err);
    if (e.includes('Socket connection timeout')) return;
    if (e.includes('rate-overlimit')) return;
    if (e.includes('Connection Closed')) return;
    if (e.includes('Value not found')) return;
    console.log('Caught exception:', err);
});
