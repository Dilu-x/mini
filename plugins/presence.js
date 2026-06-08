// plugins/presence.js — Always Online/Offline toggle per user
const { cmd } = require('../command');
const { setSetting, getSetting } = require('../settings');

cmd({
    pattern: "presence",
    desc: "Toggle always online/offline. Usage: .presence on | off",
    category: "settings",
    react: "🟢",
    filename: __filename
}, async (conn, mek, m, { reply, args, sender, from }) => {
    try {
        const val = args[0]?.toLowerCase();
        
        if (!val || !['on', 'off'].includes(val)) {
            const cur = getSetting(sender, 'PRESENCE_TYPE') || 'on';
            return reply(`┏━━━━━━━━━━━━━━✦
┃ *Presence Settings*
┃
┃ Current: ${cur === 'on' ? '🟢 Online' : '🔴 Offline'}
┃
┃ Usage:
┃   .presence on  — Always show online
┃   .presence off — Appear offline
┗━━━━━━━━━━━━━━✦

> © Presence Control`);
        }

        await setSetting(sender, 'PRESENCE_TYPE', val);
        
        const icon = val === 'on' ? '🟢' : '🔴';
        const label = val === 'on' ? 'Always Online' : 'Always Offline';
        
        await conn.sendMessage(from, {
            text: `┏━━━━━━━━━━━━━━✦
┃ *Presence Updated*
┃
┃ ${icon} ${label} activated!
┃
┃ Bot will ${val === 'on' ? 'appear online' : 'appear offline'} when chatting with you.
┗━━━━━━━━━━━━━━✦

> © Presence Control`
        }, { quoted: mek });
        
    } catch (e) {
        console.error('[PRESENCE ERROR]', e);
        reply(`❌ *Error:* ${e.message}`);
    }
});
