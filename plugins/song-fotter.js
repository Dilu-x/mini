// plugins/ACD_SETFOOTER.js — Set custom song footer
const { cmd } = require('../command');
const { setSetting } = require('../settings');

cmd({
    pattern: 'setfooter',
    desc: 'Set your custom song footer text',
    category: 'settings',
    react: '📝',
    filename: __filename
}, async (conn, mek, m, { reply, q, sender }) => {
    if (!q) return reply('❌ Usage: .setfooter <your custom text>');
    await setSetting(sender, 'CUSTOM_SONG_FOOTER', q);
    reply(`✅ Your song footer has been set to:\n\n${q}`);
});