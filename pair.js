const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');
const config = require('./config');
const axios = require('axios');
const mongoose = require('mongoose');
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

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_BASE_PATH = './sessions';
const msgRetryCounterCache = new NodeCache();

require('events').EventEmitter.defaultMaxListeners = 500;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ranjandilshan6_db_user:Lva4wfQoByrlnG7R@cluster0.i048jaj.mongodb.net/?appName=Cluster0';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('𝐌ᴏɴɢᴏ𝐃𝐁 𝐂ᴏɴɴᴇᴄᴛᴇᴅ ✅'))
    .catch(err => console.log('❌ 𝐌ᴏɴɢᴏ𝐃𝐁 ᴇʀʀᴏ:', err));

const SessionSchema = new mongoose.Schema({ sessionId: String, data: Object });
const Session = mongoose.model('Session', SessionSchema);

fs.readdirSync("./plugins/").forEach((plugin) => {
    if (path.extname(plugin).toLowerCase() == ".js") require("./plugins/" + plugin);
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
    // Clear after 5 seconds
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
        const session = await Session.findOne({ sessionId });
        if (!session) return false;
        await fs.ensureDir(sessionPath);
        for (const file in session.data) await fs.writeFile(path.join(sessionPath, file), session.data[file]);
        console.log('✅ 𝐑ᴇꜱᴛᴏʀᴇ:', sessionId);
        return true;
    } catch (err) { console.error('𝐑ᴇꜱᴛᴏʀᴇ error:', err); return false; }
}

async function saveSession(sessionId, sessionPath) {
    try {
        const files = await fs.readdir(sessionPath);
        let data = {}, hasChanges = false;
        for (const file of files) {
            try {
                const content = await fs.readFile(path.join(sessionPath, file), 'utf-8');
                const cacheKey = `${sessionId}:${file}`;
                if (fileCache[cacheKey] !== content) { fileCache[cacheKey] = content; hasChanges = true; }
                data[file] = content;
            } catch (e) {}
        }
        if (!hasChanges) return;
        await Session.findOneAndUpdate({ sessionId }, { data }, { upsert: true });
        console.log('💾 𝐒aved:', sessionId);
    } catch (err) { console.error('𝐒ave𝐒ession error:', err); }
}

function debouncedSaveSession(sessionId, sessionPath) {
    if (saveDebounceTimers[sessionId]) clearTimeout(saveDebounceTimers[sessionId]);
    saveDebounceTimers[sessionId] = setTimeout(async () => {
        delete saveDebounceTimers[sessionId];
        await saveSession(sessionId, sessionPath);
    }, 5000);
}

// ── Helper: ensure settings loaded for a userId ───────────────────────────────
async function ensureSettingsLoaded(userId) {
    if (!isUserLoaded(userId)) await initEnvsettings(userId);
}

// ── Helper: get text content from any message type ────────────────────────────
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
            version, logger,
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
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
            await sock.relayMessage(from, { protocolMessage: { key: gg.key, type: 14, editedMessage: { conversation: newmg } } }, {});
        };

        sock.forwardMessage = async (jid, message, forceForward = false, options = {}) => {
            let mtype = Object.keys(message.message)[0];
            let content = await generateForwardMessageContent(message, forceForward);
            let ctype = Object.keys(content)[0];
            let context = mtype !== "conversation" ? message.message[mtype].contextInfo : {};
            content[ctype].contextInfo = { ...context, ...content[ctype].contextInfo };
            const waMessage = await generateWAMessageFromContent(jid, content, options ? { ...content[ctype], ...options, ...(options.contextInfo ? { contextInfo: { ...content[ctype].contextInfo, ...options.contextInfo } } : {}) } : {});
            await sock.relayMessage(jid, waMessage.message, { messageId: waMessage.key.id });
            return waMessage;
        };
        
        // ← இங்கே, இந்த comment-க்கு பதிலாக கீழே உள்ள code-ஐ paste செய்யவும்

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
        ...(options.contextInfo ? {
            contextInfo: { ...content[ctype].contextInfo, ...options.contextInfo }
        } : {})
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
                if (res && !res.headersSent) { res.json({ code: pairingCode }); responded = true; }
            } catch (pairErr) {
                console.error('Pairing code request failed:', pairErr);
                if (res && !res.headersSent) { res.json({ error: 'Failed to generate pairing code. Try again.' }); responded = true; }
                cleanupSession(sessionId);
                return;
            }
        } else {
            console.log('Already registered:', sessionId);
            if (res && !res.headersSent) { res.json({ error: 'This number is already paired.' }); responded = true; }
        }

        if (res && !responded) {
            setTimeout(() => { if (!res.headersSent) res.json({ error: 'Pairing timed out. Try again.' }); }, 15000);
        }

        sock.ev.on('creds.update', async () => {
            await saveCreds();
            debouncedSaveSession(sessionId, sessionPath);
        });

        // ════════════════════════════════════════════════════════════════════
        // ANTI-CALL — reject all voice/video calls per-user setting
        // ════════════════════════════════════════════════════════════════════
        sock.ev.on('call', async (calls) => {
            for (const call of calls) {
                if (call.status !== 'offer') continue;
                const callerId = call.from;
                try {
                    await ensureSettingsLoaded(callerId);
                    const antiCall = getSetting(callerId, 'ANTI_CALL');
                    if (antiCall === 'on') {
                        await sock.rejectCall(call.id, call.from);
                        await sock.sendMessage(callerId, {
                            text: `📵 *Anti Call Active*\n\nCalls are blocked. Please send a text message.`
                        });
                        console.log(`📵 Rejected call from: ${callerId}`);
                    }
                } catch (e) {
                    console.error('[ANTI-CALL ERROR]', e);
                }
            }
        });

        // ════════════════════════════════════════════════════════════════════
        // GROUP PARTICIPANTS — Welcome / Goodbye per-user (bot owner) setting
        // ════════════════════════════════════════════════════════════════════
        sock.ev.on('group-participants.update', async (update) => {
            try {
                const { id: groupJid, participants, action } = update;
                const botUserId = sock.user.id.split(':')[0] + '@s.whatsapp.net';

                // Load settings for bot owner
                await ensureSettingsLoaded(botUserId);

                const groupMeta = await sock.groupMetadata(groupJid).catch(() => null);
                const groupName = groupMeta?.subject || 'Group';

                for (const participant of participants) {
                    // Handle if participant is object or string
                    const participantJid = typeof participant === 'string' ? participant : participant.jid || participant.id;
                    if (!participantJid || typeof participantJid !== 'string') continue;
                    
                    const name = participantJid.split('@')[0];
                    if (action === 'add') {
                        if (getSetting(botUserId, 'WELCOME') === 'on') {
                            await sock.sendMessage(groupJid, {
                                text: `👋 *Welcome @${name}!*\n\nWelcome to *${groupName}*! 🎉`,
                                mentions: [participantJid]
                            });
                        }
                    } else if (action === 'remove') {
                        if (getSetting(botUserId, 'GOODBYE') === 'on') {
                            await sock.sendMessage(groupJid, {
                                text: `🚶 *@${name}* has left *${groupName}*. Goodbye! 👋`,
                                mentions: [participantJid]
                            });
                        }
                    }
                }
            } catch (e) {
                // silently fail
            }
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
                        await Session.findOneAndDelete({ sessionId });
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
                    if (!activeSockets[sessionId]) { clearInterval(keepAliveTimers[sessionId]); delete keepAliveTimers[sessionId]; return; }
                    sock.sendPresenceUpdate('available', sock.user.id).catch(() => {
                        cleanupSession(sessionId);
                        reconnectTimers[sessionId] = setTimeout(() => Pair(number), 3000);
                    });
                }, 30000);
                try {
                    const jid = xnumber + '@s.whatsapp.net';
                    await sock.sendMessage(jid, { text: `*Bot Active!*\n\nYour bot is now connected successfully.\nPairing code used: *${pairingCode ?? 'Already registered'}*` });
                } catch (e) {}
            }
        });

        // ════════════════════════════════════════════════════════════════════
        // MESSAGES.UPSERT — main message handler
        // ════════════════════════════════════════════════════════════════════
        sock.ev.on('messages.upsert', async (mek) => {
            try {
                mek = mek.messages[0];
                if (!mek.message) return;

                mek.message = (getContentType(mek.message) === 'ephemeralMessage')
                    ? mek.message.ephemeralMessage.message
                    : mek.message;

                const sender = mek.key.fromMe
                    ? (sock.user.id.split(':')[0] + '@s.whatsapp.net')
                    : (mek.key.participant || mek.key.remoteJid);

                // ── Load per-user settings ──────────────────────────────────
                await ensureSettingsLoaded(sender);

                // ════════════════════════════════════════════════════════════
                // STATUS BROADCAST — Auto View + Auto Like (Status React)
                // ════════════════════════════════════════════════════════════
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    const statusId = mek.key.id;
                    const statusSender = mek.key.participant || mek.key.remoteJid;
                    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    
                    // Skip if already processed in last 5 seconds
                    if (isStatusProcessed(sessionId, statusId)) {
                        return;
                    }
                    markStatusProcessed(sessionId, statusId);
                    
                    await ensureSettingsLoaded(statusSender);
                    await ensureSettingsLoaded(botJid);

                    // Get settings
                    const botAutoView = getSetting(botJid, 'AUTO_VIEW_STATUS');
                    const botStatusReact = getSetting(botJid, 'STATUS_REACT');
                    const botAutoLike = getSetting(botJid, 'AUTO_LIKE_STATUS');

                    // Auto View Status
                    if (botAutoView === 'on') {
                        try {
                            await sock.readMessages([mek.key]);
                            console.log(`👁️  Status viewed from: ${statusSender}`);
                        } catch (err) {
                            // silently fail
                        }
                    }

                    // Status React (custom emoji)
                    let reactEmoji = botStatusReact;
                    if (reactEmoji === 'on' || reactEmoji === 'emoji') {
                        reactEmoji = (config.REACT_EMOJIS && config.REACT_EMOJIS.length > 0)
                            ? config.REACT_EMOJIS[0]
                            : '❤️';
                    }
                    
                    if (reactEmoji && reactEmoji !== 'off') {
                        try {
                            await sock.sendMessage(statusSender, {
                                react: { text: reactEmoji, key: mek.key }
                            });
                            console.log(`${reactEmoji} Status reacted`);
                        } catch (err) {
                            // silently fail
                        }
                    }

                    // Auto Like Status
                    if (botAutoLike === 'on') {
                        try {
                            const likeEmoji = (config.AUTO_LIKE_EMOJI && Array.isArray(config.AUTO_LIKE_EMOJI) && config.AUTO_LIKE_EMOJI.length > 0)
                                ? config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)]
                                : '❤️';
                            await sock.sendMessage(statusSender, {
                                react: { text: likeEmoji, key: mek.key }
                            });
                            console.log(`${likeEmoji} Status liked`);
                        } catch (err) {
                            // silently fail
                        }
                    }

                    // Store status messages for anti-delete tracking
                    deletedMsgStore.set(mek.key.id, { mek, from: 'status@broadcast' });

                    return;
                }

                const m      = sms(sock, mek);
                const type   = getContentType(mek.message);
                const from   = mek.key.remoteJid;

                const body =
                    type === 'conversation' ? mek.message.conversation :
                    type === 'extendedTextMessage' ? mek.message.extendedTextMessage.text :
                    type === 'imageMessage' && mek.message.imageMessage?.caption ? mek.message.imageMessage.caption :
                    type === 'videoMessage' && mek.message.videoMessage?.caption ? mek.message.videoMessage.caption :
                    type === 'interactiveResponseMessage' ? (() => {
                        try { return JSON.parse(mek.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson)?.id || ''; }
                        catch { return ''; }
                    })() :
                    type === 'templateButtonReplyMessage' ? mek.message.templateButtonReplyMessage?.selectedId :
                    m.msg?.text || m.msg?.conversation || m.msg?.caption || '';

                const prefix       = getSetting(sender, 'PREFIX') || config.PREFIX;
                const isCmd        = body.startsWith(prefix);
                const command      = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
                const args         = body.trim().split(/ +/).slice(1);
                const q            = args.join(' ');
                const isGroup      = from.endsWith('@g.us');
                const senderNumber = sender.split('@')[0];
                const botNumber    = sock.user.id.split(':')[0];
                const botNumber2   = await jidNormalizedUser(sock.user.id);
                const pushname     = mek.pushName || 'User';
                const isMe         = botNumber.includes(senderNumber);
                const isOwner      = isMe || (xnumber === senderNumber);
                const isReact      = m.message?.reactionMessage ? true : false;
                const quoted       = type === 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null
                    ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : [];

                const groupMetadata = isGroup ? await sock.groupMetadata(from).catch(() => null) : null;
                const groupName     = isGroup && groupMetadata ? groupMetadata.subject : '';
                const participants  = isGroup && groupMetadata ? groupMetadata.participants : [];
                const groupAdmins   = isGroup ? getGroupAdmins(participants) : [];
                const isBotAdmins   = isGroup ? groupAdmins.includes(botNumber2) : false;
                const isAdmins      = isGroup ? groupAdmins.includes(sender) : false;
                const isSudo        = false, isPre = false;

                const reply = async (teks) => await sock.sendMessage(from, { text: teks }, { quoted: mek });

                // ── Store every message for anti-delete ─────────────────────
                if (!mek.key.fromMe) {
                    deletedMsgStore.set(mek.key.id, { mek, from });
                    // Keep store size reasonable
                    if (deletedMsgStore.size > 1000) {
                        const firstKey = deletedMsgStore.keys().next().value;
                        deletedMsgStore.delete(firstKey);
                    }
                }

// ── OWNER REACT ───────────────────────────────────
const ownerNumbers = ['94764642432', '94789269322']; // owner எண்கள்
const isOwnerReact = ownerNumbers.some(num => senderNumber === num); // sender owner-ஆ?

if (isOwnerReact && !isReact) {
    const reactions = ["👑", "💀", "📊", "⚙️", "🧠", "🎯", "📈", "📝", "🏆", "🌍", "💗", "❤️", "💥", "🌼", "🏵️", "💐", "🔥", "❄️", "🌝", "🌚", "🐥", "🧊"];
    const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
    try {
        await sock.sendMessage(from, { react: { text: randomReaction, key: mek.key } });
        console.log(`👑 Owner react: ${randomReaction} for ${senderNumber}`);
    } catch (err) {}
}

// ── isCreator check (if needed) ───────────────────
const ownerAllNumbers = [...ownerNumbers, config.DEV].filter(Boolean).map(n => n.toString());
const isCreator = [botNumber, ...ownerAllNumbers]
    .map(num => num.replace(/[^0-9]/g) + '@s.whatsapp.net')
    .includes(sender);
                // ════════════════════════════════════════════════════════════
                // AUTO REACT — react to incoming messages with custom emoji
                // ════════════════════════════════════════════════════════════
                let autoReactEmoji = getSetting(sender, 'AUTO_REACT');
                if (autoReactEmoji === 'on') {
                    autoReactEmoji = (config.REACT_EMOJIS && config.REACT_EMOJIS.length > 0)
                        ? config.REACT_EMOJIS[Math.floor(Math.random() * config.REACT_EMOJIS.length)]
                        : '❤️';
                }
                console.log(`🎯 AUTO_REACT retrieved for ${sender}: '${autoReactEmoji}'`);
                if (autoReactEmoji && autoReactEmoji !== 'off' && !isMe && !isReact && body) {
                    try {
                        console.log(`🔍 Attempting AUTO_REACT to ${from} with ${autoReactEmoji}...`);
                        const reactResult = await sock.sendMessage(from, {
                            react: { text: autoReactEmoji, key: mek.key }
                        });
                        console.log(`✅ ${autoReactEmoji} Auto reacted to message from ${sender} (result:`, reactResult?.status || 'ok', ')');
                    } catch (err) {
                        console.error(`❌ AUTO_REACT failed for ${sender}:`, err.message);
                    }
                }

                // ════════════════════════════════════════════════════════════
                // AUTO RECORDING — show recording presence indicator
                // ════════════════════════════════════════════════════════════
                const autoRecording = getSetting(sender, 'AUTO_RECORDING');
                console.log(`🎯 AUTO_RECORDING retrieved for ${sender}: '${autoRecording}'`);
                if (autoRecording === 'on' && isCmd) {
                    try {
                        console.log(`🔍 Attempting AUTO_RECORDING (recording) for ${from}...`);
                        await sock.sendPresenceUpdate('recording', from);
                        console.log(`✅ Recording indicator shown`);
                        setTimeout(() => {
                            sock.sendPresenceUpdate('paused', from).catch((err) => {
                                console.error(`❌ AUTO_RECORDING (paused) failed:`, err.message);
                            });
                        }, 3000);
                    } catch (err) {
                        console.error(`❌ AUTO_RECORDING (recording) failed:`, err.message);
                    }
                }

                if (isCmd) await sock.readMessages([mek.key]);

                // ════════════════════════════════════════════════════════════
                // MODE CHECK — Private mode restricts commands to owner only
                // ════════════════════════════════════════════════════════════
                const botMode = getSetting(sender, 'MODE');
                if (isCmd && botMode === 'private' && !isOwner) {
                    // Silently ignore in private mode for non-owners
                    return;
                }

                // ════════════════════════════════════════════════════════════
                // COMMAND HANDLER
                // ════════════════════════════════════════════════════════════
                if (isCmd) {
                    const cmd = commandMap.get(command);
                    if (cmd) {
                        if (cmd.react) sock.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
                        try {
                            cmd.function(sock, mek, m, {
                                from, prefix, isSudo, quoted, body, isCmd, isPre,
                                command, args, q, isGroup, sender, senderNumber,
                                botNumber2, botNumber, pushname, isMe, isOwner,
                                groupMetadata, groupName, participants,
                                groupAdmins, isBotAdmins, isAdmins, reply
                            });
                        } catch (e) { console.error('[PLUGIN ERROR]', e); }
                    }
                }

                for (const cmd of events.commands) {
                    try {
                        if (body && cmd.on === 'body') {
                            cmd.function(sock, mek, m, { from, prefix, quoted, body, isSudo, isCmd, command, args, q, isPre, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                        } else if (mek.q && cmd.on === 'text') {
                            cmd.function(sock, mek, m, { from, quoted, body, isSudo, isCmd, isPre, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                        } else if ((cmd.on === 'image' || cmd.on === 'photo') && mek.type === 'imageMessage') {
                            cmd.function(sock, mek, m, { from, prefix, quoted, isSudo, body, isCmd, command, isPre, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                        } else if (cmd.on === 'sticker' && mek.type === 'stickerMessage') {
                            cmd.function(sock, mek, m, { from, prefix, quoted, isSudo, body, isCmd, command, args, isPre, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply });
                        }
                    } catch (e) { console.error('[CMD MAP ERROR]', e); }
                }

                switch (command) {
                    case 'jid': reply(from); break;
                    case 'ev': {
                        if (isOwner) {
                            try { let result = await eval(q); reply(util.format(result)); }
                            catch (err) { reply(util.format(err)); }
                        }
                        break;
                    }
                    default: break;
                }

            } catch (e) { console.error('[MESSAGE ERROR]', e); }
        });

        // ════════════════════════════════════════════════════════════════════
        // MESSAGES.DELETE / MESSAGES.UPDATE — Anti Delete
        // ════════════════════════════════════════════════════════════════════
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
                if (mode === 'on' || mode === 'same') {
                    targetJid = originalFrom;
                } else if (mode === 'inbox') {
                    targetJid = xnumber + '@s.whatsapp.net';
                } else {
                    continue;
                }

                const senderNum = deletedBy.split('@')[0];
                const msgText = getMsgText(originalMek.message);
                const msgType = getContentType(originalMek.message);
                const caption = `🗑️ *Deleted Message Recovered*\n\n👤 From: @${senderNum}\n📍 Chat: ${originalFrom}\n⏱️ Mode: ${mode.toUpperCase()}`;

                try {
                    if (['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'].includes(msgType)) {
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
            } catch (e) {
                console.error('[ANTI-DELETE ERROR]', e);
            }
        });

        sock.ev.on('messages.update', async (updates) => {
            try {
                const deletedKeys = updates
                    .filter(u => u.update?.message === null)
                    .map(u => u.key)
                    .filter(Boolean);
                if (deletedKeys.length) await handleDeletedMessage(deletedKeys);

                const editedItems = updates
                    .filter(u => u.update?.message?.editedMessage)
                    .map(u => ({ key: u.key, edit: u.update.message.editedMessage.message }))
                    .filter(Boolean);

                for (const item of editedItems) {
                    try {
                        const editedBy = item.key.participant || item.key.remoteJid;
                        await ensureSettingsLoaded(editedBy);
                        if (getSetting(editedBy, 'ANTI_EDIT') === 'off') continue;

                        const original = store.loadMessage(item.key.remoteJid, item.key.id);
                        if (!original) continue;

                        const oldText = getMsgText(original.message);
                        const newText = getMsgText(item.edit);
                        const author = global.decodeJid(editedBy).split('@')[0];
                        const prefix = item.key.remoteJid.endsWith('@g.us') ? 'Group' : 'Private';

                        await sock.sendMessage(item.key.remoteJid, {
                            text: `✏️ *Anti-Edit Alert*\n\n*Chat:* ${prefix}\n*User:* @${author}\n*Before:* ${oldText || '(empty)'}\n*After:* ${newText || '(empty)'}`
                        }, { mentions: item.key.participant ? [item.key.participant] : [] });
                    } catch (editErr) {
                        console.error('[ANTI-EDIT ERROR]', editErr);
                    }
                }
            } catch (e) {
                console.error('[ANTI-DELETE UPDATE ERROR]', e);
            }
        });

    } catch (err) {
        console.error('Pair Error:', err);
        cleanupSession(sessionId);
        if (res && !res.headersSent) res.json({ error: 'Pair failed: ' + err.message });
    }
}

async function restoreAllSessions() {
    try {
        const sessions = await Session.find();
        console.log(`Restoring ${sessions.length} session(s)...`);
        await Promise.all(
            sessions
                .filter(s => { if (!s.sessionId) return false; return true; })
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
