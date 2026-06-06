// plugins/ACD_MAIN.js — Main Commands with Premium UI Footer & Custom Image Support
const { cmd, commands } = require('../command');
const { getBuffer } = require('../lib/functions');

// ── Image Configurations (Consistent with ACD_MENU and ACD_VV styling) ──
const MAIN_IMAGES = {
  ping:    'https://shyra.edgeone.app/bot-img.jpg', // Ping/Pong command interface image
  info:    'https://shyra.edgeone.app/bot-img.jpg', // Bot info presentation image
  error:   'https://shyra.edgeone.app/bot-img.jpg', // Error fallback image
  other:   'https://shyra.edgeone.app/bot-img.jpg'  // Default fallback
};

// ── Hardcoded UI Brand Elements (Directly matching ACD_MENU.js) ──
const BOT_NAME    = 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const BOT_VERSION = 'v3.0';
const OWNER_NAME  = 'ᴅɪʟsʜᴀ∇';

// ── Global Footer Content ────────────────────────────────────────
const GLOBAL_FOOTER = `\n╭─────𓆩★𓆪──────╮\n> ㋛ Ⲣ૦𝚅𝞔Ꮢ𝞔Ｄ 𝗕Ⲩ ＤƖ𐐛𝘚Η𝔸∇\n╰─────𓆩★𓆪──────╯`;

// ══════════════════════════════════════════════════════════════════
// PING COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: "ping",
    desc: "Check bot response time.",
    category: "main",
    react: "🏓",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const start = Date.now();
        
        // Initial premium latency testing layout
        let testingText = `╭────「 🏓 PING 」\n│ ⏳ _Testing response speed..._\n╰───────────────────\n` + GLOBAL_FOOTER;
        let testMsg;
        
        try {
            const imgBuf = await getBuffer(MAIN_IMAGES['ping']);
            testMsg = await conn.sendMessage(from, { image: imgBuf, caption: testingText }, { quoted: mek });
        } catch {
            testMsg = await reply(testingText);
        }
        
        const ping = Date.now() - start;
        
        // Finalized Pong performance block matching your unique system frames
        let text = `╭━━━〔『PONG』『SPEED』〕━✦\n`;
        text += `├───────────\n`;
        text += `│  📍 \`Latency\`  : ${ping}ms\n`;
        text += `│  ⚡ \`Status\`   : Supercharged\n`;
        text += `╰────────────╯\n`;
        text += GLOBAL_FOOTER;

        // Clean up initial test layout and push final performance status
        if (testMsg?.key) await conn.sendMessage(from, { delete: testMsg.key });

        try {
            const imgBuf = await getBuffer(MAIN_IMAGES['ping']);
            await conn.sendMessage(from, {
                image: imgBuf,
                caption: text,
                mimetype: 'image/jpeg'
            }, { quoted: mek });
        } catch {
            await reply(text);
        }
    } catch (e) { 
        console.error('[PING ERROR]', e);
        reply(`❌ Error: ${e.message}`); 
    }
});

// ══════════════════════════════════════════════════════════════════
// BOTINFO COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
    pattern: "botinfo",
    alias: ["info"],
    desc: "Show bot information.",
    category: "main",
    react: "ℹ️",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const total = commands.filter(c => c.pattern && !c.dontAddCommandList).length;
        const usedMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        
        let text = `╭━━━〔『BOT』『INFO』〕━✦\n`;
        text += `├───────────\n`;
        text += `│  👾 \`Name\`     : ${BOT_NAME}\n`;
        text += `│  🔖 \`Version\`  : ${BOT_VERSION}\n`;
        text += `│  📞 \`Owner\`    : ${OWNER_NAME}\n`;
        text += `│  📦 \`Cmds\`     : ${total}\n`;
        text += `│  ⚡ \`Runtime\`  : Node.js ${process.version}\n`;
        text += `│  🧠 \`RAM\`      : ${usedMemory} MB\n`;
        text += `╰────────────╯\n`;
        text += GLOBAL_FOOTER;

        try {
            const imgBuf = await getBuffer(MAIN_IMAGES['info']);
            await conn.sendMessage(from, {
                image: imgBuf,
                caption: text,
                mimetype: 'image/jpeg'
            }, { quoted: mek });
        } catch {
            reply(text);
        }
    } catch (e) { 
        console.error('[BOTINFO ERROR]', e);
        reply(`❌ Error: ${e.message}`); 
    }
});