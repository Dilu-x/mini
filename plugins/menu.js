// plugins/menu.js
const { cmd } = require('../command');
const events = require('../command'); // commands list
const config = require('../config');
const fs = require('fs');

cmd({
    pattern: "menu",
    react: "🤖",
    alias: ["allmenu"],
    desc: "Get command list",
    category: "main",
    filename: __filename
}, async (conn, mek, m, { from, quoted, pushname, reply }) => {
    try {
        const commands = events.commands;
        let menu = {
            download: '', group: '', fun: '', owner: '',
            ai: '', anime: '', convert: '', reaction: '',
            main: '', other: ''
        };

        for (let cmd of commands) {
            if (cmd.pattern && !cmd.dontAddCommandList && menu.hasOwnProperty(cmd.category)) {
                menu[cmd.category] += `│ ⬡ ${cmd.pattern}\n`;
            }
        }

        let madeMenu = `
╭─❍ *${config.BOT_NAME} MENU*
│ 👤 User: ${pushname || mek.pushName}
│ 🌐 Mode: [${config.MODE}]
│ ✨ Prefix: [${config.PREFIX}]
│ 📦 Total Commands: ${commands.length}
│ 📌 Version: ${config.version} BETA
╰─────────────✦

┌───『 🛠️ Admin Commands 』
${menu.group || '│ (No commands found)'}
${menu.main || ''}
${menu.other || ''}
└─────────────✦

┌───『 📥 Downloader Commands 』
${menu.download || '│ (No commands found)'}
└─────────────✦

┌───『 🧑‍💻 Owner Commands 』
${menu.owner || '│ (No commands found)'}
└─────────────✦

┌───『 🧠 AI Commands 』
${menu.ai || '│ (No commands found)'}
└─────────────✦

┌───『 ✨ Logo/Anime Commands 』
${menu.anime || '│ (No commands found)'}
└─────────────✦

┌───『 🔄 Convert Commands 』
${menu.convert || '│ (No commands found)'}
└─────────────✦

┌───『 🎭 Reaction Commands 』
${menu.reaction || '│ (No commands found)'}
└─────────────✦

┌───『 🎉 Fun Commands 』
${menu.fun || '│ (No commands found)'}
└─────────────✦

> ${config.DESCRIPTION}
`;

        await conn.sendMessage(from, {
            image: { url: config.MENU_IMAGE_URL },
            caption: madeMenu
        }, { quoted: mek });

        // Send menu audio if file exists
        if (fs.existsSync('./all/menu.m4a')) {
            await conn.sendMessage(from, {
                audio: fs.readFileSync('./all/menu.m4a'),
                mimetype: 'audio/mp4',
                ptt: true
            }, { quoted: mek });
        }
    } catch (e) {
        console.error(e);
        reply(`${e}`);
    }
});