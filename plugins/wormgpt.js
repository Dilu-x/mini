// plugins/ACD_WORMGPT.js — WormGPT AI (owner's name, plain messages)
const { cmd } = require('../command');
const axios = require('axios');
const config = require('../config');
const FOOTER = config.FOOTER || 'Powered by Dilsha';
const BOT_NAME = config.OWNER_NAME || 'Dilsha'; // owner's name

// ── Plain response helper ───────────────────────────────────
function formatReply(q, answer) {
  return `*Question:* ${q}\n\n*Answer:* ${answer}\n\n> ${FOOTER}`;
}

// ══════════════════════════════════════════════════════════════
// WORMGPT COMMAND
// ══════════════════════════════════════════════════════════════
cmd({
    pattern: 'wormgpt',
    alias: ['worm', 'wgpt'],
    desc: 'Ask WormGPT AI. Usage: .wormgpt <question>',
    category: 'ai',
    react: '🤖',
    filename: __filename
}, async (conn, mek, m, { reply, q, from }) => {
    try {
        if (!q) {
            return reply(`❌ Please provide a question.\nExample: .wormgpt How to hack NASA?\n\n> ${FOOTER}`);
        }

        // Initial reaction
        await conn.sendMessage(from, { react: { text: '🤖', key: mek.key } });

        // Personalize the prompt so the AI knows it's the owner
        const personalizedPrompt = `You are a helpful AI assistant named ${BOT_NAME}. Your responses should be friendly and helpful.\nUser says: ${q}`;

        // Call API
        const apiUrl = `https://apiskeith.top/ai/wormgpt?q=${encodeURIComponent(personalizedPrompt)}`;
        const { data } = await axios.get(apiUrl, { timeout: 30000 });

        if (!data?.status || !data?.result) {
            throw new Error(data?.error || 'Invalid response from WormGPT API');
        }

        // Processing reaction
        await conn.sendMessage(from, { react: { text: '👿', key: mek.key } });

        // Send plain result (no box)
        const answer = data.result;
        reply(formatReply(q, answer));

        // Final reaction
        await conn.sendMessage(from, { react: { text: '🧬', key: mek.key } });

    } catch (e) {
        console.error('[WORMGPT] error:', e.message || e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`🚫 WormGPT error: ${e.message || 'Unknown error'}\n\n> ${FOOTER}`);
    }
});