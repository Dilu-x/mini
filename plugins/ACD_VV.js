// plugins/vv.js (மாற்றியமைத்தது)
const { cmd } = require('../command');
const { getContentType } = require('@whiskeysockets/baileys');

cmd({
    pattern: "vv",
    alias: ["viewonce", "antiviewonce", "unview"],
    desc: "Remove view-once flag from replied media",
    category: "tools",
    react: "👀",
    filename: __filename
}, async (conn, mek, m, { sender, reply }) => {
    try {
        // Quoted message-ஐ extract பண்றோம்
        const quotedMsg = m.quoted; // இது இருந்தால் நல்லது
        if (!quotedMsg) {
            // manual extraction from mek
            const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
            if (!contextInfo?.stanzaId) return reply("❌ Reply to a view‑once message!");
            // stanzaId என்பது quoted message-ன் ID. Full message-ஐ store-லிருந்து எடுக்க முடியாது.
            // எனவே m.quoted இல்லாமல் இது complex ஆகும். மாற்றாக sms function fix பண்ணவும்.
            return reply("❌ Reply feature not fully supported yet. Please use `.vv` in a chat with full message context.");
        }

        const msgContent = quotedMsg.message;
        if (!msgContent) return reply("❌ No message found in reply.");
        
        const isViewOnce = msgContent.viewOnceMessage || msgContent.viewOnceMessageV2 || 
                          (msgContent.ephemeralMessage?.message &&
                           (msgContent.ephemeralMessage.message.viewOnceMessage ||
                            msgContent.ephemeralMessage.message.viewOnceMessageV2));
        if (!isViewOnce) return reply("❌ That's not a view‑once message.");

        await conn.readMessages([quotedMsg.key]);
        await conn.copyNForward(m.chat, quotedMsg, false, { readViewOnce: true });
        reply("✅ View‑once removed! Media sent back.");
    } catch (e) {
        console.error('[VV ERROR]', e);
        reply("❌ Failed to remove view‑once. Maybe unsupported media.");
    }
});