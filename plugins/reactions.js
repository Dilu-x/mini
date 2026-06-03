// plugins/reactions.js
const { cmd } = require('../command');
const { fetchGif, gifToVideo } = require('../lib/fetchGif');
const axios = require('axios');
const config = require('../config');

// Helper to build reaction message
function buildMessage(senderName, mentioned, isGroup, commandName, actionText) {
    if (mentioned) {
        return `${senderName} ${actionText} @${mentioned.split("@")[0]}`;
    } else if (isGroup) {
        return `${senderName} is ${commandName}ing everyone!`;
    } else {
        return `> ${config.DESCRIPTION}`;
    }
}

// Helper to send the GIF
async function sendReactionGif(conn, mek, m, senderName, mentionedUser, message, apiUrl, reactEmoji) {
    let res = await axios.get(apiUrl);
    let gifUrl = res.data.url;
    let gifBuffer = await fetchGif(gifUrl);
    let videoBuffer = await gifToVideo(gifBuffer);
    await conn.sendMessage(
        m.chat,
        {
            video: videoBuffer,
            caption: message,
            gifPlayback: true,
            mentions: [m.sender, mentionedUser].filter(Boolean)
        },
        { quoted: mek }
    );
}

cmd({ pattern: "cry", category: "reaction", react: "😢" },
    async (conn, mek, m, { reply }) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "cry", "is crying over");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/cry");
    });

cmd({ pattern: "cuddle", category: "reaction", react: "🤗" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "cuddle", "cuddled");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/cuddle");
    });

cmd({ pattern: "bully", category: "reaction", react: "😈" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "bully", "is bullying");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/bully");
    });

cmd({ pattern: "hug", category: "reaction", react: "🤗" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "hug", "hugged");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/hug");
    });

cmd({ pattern: "awoo", category: "reaction", react: "🐺" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "awoo", "awoos at");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/awoo");
    });

cmd({ pattern: "lick", category: "reaction", react: "👅" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let senderName = `@${m.sender.split("@")[0]}`;
        let message = mentionedUser ? `${senderName} licked @${mentionedUser.split("@")[0]}` : `${senderName} licked themselves!`;
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/lick");
    });

cmd({ pattern: "pat", category: "reaction", react: "🫂" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "pat", "patted");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/pat");
    });

cmd({ pattern: "smug", category: "reaction", react: "😏" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "smug", "is smug at");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/smug");
    });

cmd({ pattern: "bonk", category: "reaction", react: "🔨" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "bonk", "bonked");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/bonk");
    });

cmd({ pattern: "yeet", category: "reaction", react: "💨" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "yeet", "yeeted");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/yeet");
    });

cmd({ pattern: "blush", category: "reaction", react: "😊" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "blush", "is blushing at");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/blush");
    });

cmd({ pattern: "handhold", category: "reaction", react: "🤝" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "handhold", "is holding hands with");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/handhold");
    });

cmd({ pattern: "highfive", category: "reaction", react: "✋" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "highfive", "gave a high-five to");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/highfive");
    });

cmd({ pattern: "nom", category: "reaction", react: "🍽️" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "nom", "is nomming");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/nom");
    });

cmd({ pattern: "wave", category: "reaction", react: "👋" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "wave", "waved at");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/wave");
    });

cmd({ pattern: "smile", category: "reaction", react: "😁" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "smile", "smiled at");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/smile");
    });

cmd({ pattern: "wink", category: "reaction", react: "😉" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "wink", "winked at");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/wink");
    });

cmd({ pattern: "happy", category: "reaction", react: "😊" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "happy", "is happy with");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/happy");
    });

cmd({ pattern: "glomp", category: "reaction", react: "🤗" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "glomp", "glomped");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/glomp");
    });

cmd({ pattern: "bite", category: "reaction", react: "🦷" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "bite", "bit");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/bite");
    });

cmd({ pattern: "poke", category: "reaction", react: "👉" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "poke", "poked");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/poke");
    });

cmd({ pattern: "cringe", category: "reaction", react: "😬" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "cringe", "thinks is cringe");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/cringe");
    });

cmd({ pattern: "dance", category: "reaction", react: "💃" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = buildMessage(`@${m.sender.split("@")[0]}`, mentionedUser, m.isGroup, "dance", "danced with");
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/dance");
    });

cmd({ pattern: "kill", category: "reaction", react: "🔪" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = mentionedUser
            ? `@${m.sender.split("@")[0]} killed @${mentionedUser.split("@")[0]}`
            : m.isGroup
            ? `@${m.sender.split("@")[0]} killed everyone`
            : `> ${config.DESCRIPTION}`;
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/kill");
    });

cmd({ pattern: "slap", category: "reaction", react: "✊" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = mentionedUser
            ? `@${m.sender.split("@")[0]} slapped @${mentionedUser.split("@")[0]}`
            : m.isGroup
            ? `@${m.sender.split("@")[0]} slapped everyone`
            : `> ${config.DESCRIPTION}`;
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/slap");
    });

cmd({ pattern: "kiss", category: "reaction", react: "💋" },
    async (conn, mek, m) => {
        let mentionedUser = m.mentionedJid?.[0] || m.quoted?.sender;
        let message = mentionedUser
            ? `@${m.sender.split("@")[0]} kissed @${mentionedUser.split("@")[0]}`
            : m.isGroup
            ? `@${m.sender.split("@")[0]} kissed everyone`
            : `> ${config.DESCRIPTION}`;
        await sendReactionGif(conn, mek, m, m.sender, mentionedUser, message, "https://api.waifu.pics/sfw/kiss");
    });