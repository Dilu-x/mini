// plugins/alive.js
const { cmd } = require('../command');
const os = require('os');
const { runtime } = require('../lib/functions');
const config = require('../config');

cmd({
    pattern: "alive",
    alias: ["status", "online", "a"],
    desc: "Check if bot is alive and running",
    category: "main",
    react: "⚡",
    filename: __filename
}, async (conn, mek, m, { from, sender, reply }) => {
    try {
        const heapUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const totalMem = (os.totalmem() / 1024 / 1024).toFixed(2);
        const uptime = runtime(process.uptime());

        const caption = `
╭━━〔 🤖 *${config.BOT_NAME} STATUS* 〕━━⬣
┃ 🟢 *Bot is Active & Online!*
┃
┃ 👑 *Owner:* ${config.OWNER_NAME}
┃ 🔖 *Version:* ${config.version}
┃ 🛠️ *Prefix:* [ ${config.PREFIX} ]
┃ ⚙️ *Mode:* [ ${config.MODE} ]
┃ 💾 *RAM:* ${heapUsed}MB / ${totalMem}MB
┃ 🖥️ *Host:* ${os.hostname()}
┃ ⏱️ *Uptime:* ${uptime}
╰━━━━━━━━━━━━━━⬣
📝 *${config.DESCRIPTION}*
        `.trim();

        await conn.sendMessage(from, {
            image: { url: config.MENU_IMAGE_URL },
            caption,
            mentions: [sender]   // if you want the sender tagged, keep this
        }, { quoted: mek });

    } catch (e) {
        console.error("Alive Error:", e);
        reply(`❌ *Error:* ${e.message}`);
    }
});