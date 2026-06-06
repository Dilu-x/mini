// plugins/ACD_AI.js — Fully personalized AI responses (owner's name)
const { cmd } = require('../command');
const axios = require('axios');
const config = require('../config');
const FOOTER = config.FOOTER || 'Powered by dilsha';
const BOT_NAME = config.OWNER_NAME || 'Dilsha'; // Owner's name

function parseError(error) {
  if (error.response?.status === 404) return 'API endpoint not found!';
  if (error.response?.status === 429) return 'Too many requests! Try again later.';
  if (error.response?.status >= 500) return 'AI service is currently unavailable.';
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) return 'Request timed out! Try again.';
  if (error.code === 'ENOTFOUND') return 'Cannot connect to AI service!';
  return `Error: ${error.message}`;
}

// Format a plain response (no box)
function formatReply(q, answer) {
  return `*Question:* ${q}\n\n*Answer:* ${answer}\n\n> ${FOOTER}`;
}

// Generic AI call (uses owner's name as AI identity)
async function callAI({ conn, mek, from, q, apiUrl, responseKey, fallbackKeys }) {
  if (!q) return null;
  await conn.sendPresenceUpdate('composing', from);
  const personalizedPrompt = `You are a helpful AI assistant named ${BOT_NAME}. Your responses should be friendly and helpful.\nUser says: ${q}`;
  const fullUrl = apiUrl.replace(encodeURIComponent(q), encodeURIComponent(personalizedPrompt));
  const { data } = await axios.get(fullUrl, { timeout: 30000 });
  let answer = data?.[responseKey];
  if (!answer && fallbackKeys) {
    for (const k of fallbackKeys) {
      answer = data?.[k];
      if (answer) break;
    }
  }
  if (!answer) throw new Error('API failed to generate response!');
  if (answer.length > 4000) answer = answer.slice(0, 4000) + '\n\n_(truncated)_';
  return answer.trim();
}

// ---------------- GPT-4 ----------------
cmd({ pattern: 'gpt4', alias: ['gpt', 'chatgpt'], desc: 'Ask GPT-4 AI.', category: 'ai', react: '💭', filename: __filename },
  async (conn, mek, m, { reply, q, from, pushname }) => {
    try {
      if (!q) return reply('❌ Usage: /gpt4 <question>');
      if (q.length > 1000) return reply('📝 Question too long! Max 1000 characters.');
      await conn.sendMessage(from, { react: { text: '💭', key: mek.key } });
      const answer = await callAI({
        conn, mek, from, q,
        apiUrl: `https://meta-api.zone.id/ai/chatgptfree?prompt=${encodeURIComponent(q)}`,
        responseKey: 'answer', fallbackKeys: ['response','message','text','data','content','result']
      });
      await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
      reply(formatReply(q, answer));
    } catch (e) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      reply(`🚫 ${parseError(e)}`);
    }
  });

// ---------------- DEEPSEEK ----------------
cmd({ pattern: 'deepseek', alias: ['ds'], desc: 'Ask DeepSeek AI.', category: 'ai', react: '🤖', filename: __filename },
  async (conn, mek, m, { reply, q, from, pushname }) => {
    try {
      if (!q) return reply('❌ Usage: /deepseek <question>');
      if (q.length > 1000) return reply('📝 Question too long! Max 1000 characters.');
      await conn.sendMessage(from, { react: { text: '🤖', key: mek.key } });
      const answer = await callAI({
        conn, mek, from, q,
        apiUrl: `https://meta-api.zone.id/ai/copilot?message=${encodeURIComponent(q)}`,
        responseKey: 'answer', fallbackKeys: ['result','response','text']
      });
      await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
      reply(formatReply(q, answer));
    } catch (e) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      reply(`🚫 ${parseError(e)}`);
    }
  });

// ---------------- COPILOT ----------------
cmd({ pattern: 'copilot', alias: ['mscopilot'], desc: 'Ask Microsoft Copilot.', category: 'ai', react: '📡', filename: __filename },
  async (conn, mek, m, { reply, q, from, pushname }) => {
    try {
      if (!q) return reply('❌ Usage: /copilot <question>');
      if (q.length > 1000) return reply('📝 Question too long! Max 1000 characters.');
      await conn.sendMessage(from, { react: { text: '📡', key: mek.key } });
      const answer = await callAI({
        conn, mek, from, q,
        apiUrl: `https://iamtkm.vercel.app/ai/copilot?apikey=tkm&text=${encodeURIComponent(q)}`,
        responseKey: 'result', fallbackKeys: ['answer','response','text']
      });
      await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
      reply(formatReply(q, answer));
    } catch (e) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      reply(`🚫 ${parseError(e)}`);
    }
  });

// ---------------- BARD ----------------
cmd({ pattern: 'bard', alias: ['googlebard','gemini'], desc: 'Ask Google Bard.', category: 'ai', react: '📥', filename: __filename },
  async (conn, mek, m, { reply, q, from, pushname }) => {
    try {
      if (!q) return reply('❌ Usage: /bard <query>');
      if (q.length > 1000) return reply('📝 Query too long! Max 1000 characters.');
      await conn.sendMessage(from, { react: { text: '📥', key: mek.key } });
      const answer = await callAI({
        conn, mek, from, q,
        apiUrl: `https://apiskeith.top/ai/bard?q=${encodeURIComponent(q)}`,
        responseKey: 'result', fallbackKeys: ['answer','response','text']
      });
      await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
      reply(formatReply(q, answer));
    } catch (e) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      reply(`🚫 ${parseError(e)}`);
    }
  });

// ---------------- PERPLEXITY ----------------
cmd({ pattern: 'perplexity', alias: ['perplex','pplx'], desc: 'Ask Perplexity AI.', category: 'ai', react: '🤔', filename: __filename },
  async (conn, mek, m, { reply, q, from, pushname }) => {
    try {
      if (!q) return reply('❌ Usage: /perplexity <query>');
      if (q.length > 1000) return reply('📝 Query too long! Max 1000 characters.');
      await conn.sendMessage(from, { react: { text: '🤔', key: mek.key } });
      const answer = await callAI({
        conn, mek, from, q,
        apiUrl: `https://apiskeith.top/ai/perplexity?q=${encodeURIComponent(q)}`,
        responseKey: 'result', fallbackKeys: ['answer','response','text']
      });
      await conn.sendMessage(from, { react: { text: '📚', key: mek.key } });
      reply(formatReply(q, answer));
    } catch (e) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      reply(`🚫 ${parseError(e)}`);
    }
  });

// ---------------- BLACKBOX ----------------
cmd({ pattern: 'blackbox', alias: ['bb','bbox'], desc: 'Ask Blackbox AI.', category: 'ai', react: '🖤', filename: __filename },
  async (conn, mek, m, { reply, q, from, pushname }) => {
    try {
      if (!q) return reply('❌ Usage: /blackbox <query>');
      if (q.length > 1000) return reply('📝 Query too long! Max 1000 characters.');
      await conn.sendMessage(from, { react: { text: '📥', key: mek.key } });
      const answer = await callAI({
        conn, mek, from, q,
        apiUrl: `https://apiskeith.top/ai/blackbox?q=${encodeURIComponent(q)}`,
        responseKey: 'result', fallbackKeys: ['answer','response','text']
      });
      await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
      reply(formatReply(q, answer));
    } catch (e) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      reply(`🚫 ${parseError(e)}`);
    }
  });

// ---------------- META AI (davidcyriltech) ----------------
cmd({ pattern: 'metaai', alias: ['meta','llama'], desc: 'Ask Meta AI (Llama).', category: 'ai', react: '🤖', filename: __filename },
  async (conn, mek, m, { reply, q, from, pushname }) => {
    try {
      if (!q) return reply('❌ Usage: /metaai <question>');
      if (q.length > 1000) return reply('📝 Question too long! Max 1000 characters.');
      await conn.sendMessage(from, { react: { text: '🤖', key: mek.key } });
      await conn.sendPresenceUpdate('composing', from);
      const personalizedPrompt = `You are a helpful AI assistant named ${BOT_NAME}. Your responses should be friendly and helpful.\nUser says: ${q}`;
      const { data } = await axios.get(
        `https://apis.davidcyriltech.my.id/ai/metaai?text=${encodeURIComponent(personalizedPrompt)}`,
        { timeout: 30000 }
      );
      if (!data.success || !data.response) throw new Error('API failed to generate response!');
      const answer = data.response.trim();
      await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
      reply(formatReply(q, answer));
    } catch (e) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      reply(`🚫 ${parseError(e)}`);
    }
  });

// ---------------- META AI v2 (apiskeith) ----------------
cmd({ pattern: 'metai', alias: ['metav2'], desc: 'Ask Meta AI v2.', category: 'ai', react: '⤵️', filename: __filename },
  async (conn, mek, m, { reply, q, from, pushname }) => {
    try {
      if (!q) return reply('❌ Usage: /metai <query>');
      if (q.length > 1000) return reply('📝 Query too long! Max 1000 characters.');
      await conn.sendMessage(from, { react: { text: '⤵️', key: mek.key } });
      const answer = await callAI({
        conn, mek, from, q,
        apiUrl: `https://apiskeith.top/ai/metai?q=${encodeURIComponent(q)}`,
        responseKey: 'result', fallbackKeys: ['answer','response','text']
      });
      await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
      reply(formatReply(q, answer));
    } catch (e) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      reply(`🚫 ${parseError(e)}`);
    }
  });

// ---------------- ILAMA ----------------
cmd({ pattern: 'ilama', alias: ['llama2'], desc: 'Ask iLama AI.', category: 'ai', react: '🦙', filename: __filename },
  async (conn, mek, m, { reply, q, from, pushname }) => {
    try {
      if (!q) return reply('❌ Usage: /ilama <query>');
      if (q.length > 1000) return reply('📝 Query too long! Max 1000 characters.');
      await conn.sendMessage(from, { react: { text: '📥', key: mek.key } });
      const answer = await callAI({
        conn, mek, from, q,
        apiUrl: `https://apiskeith.top/ai/ilama?q=${encodeURIComponent(q)}`,
        responseKey: 'result', fallbackKeys: ['answer','response','text']
      });
      await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
      reply(formatReply(q, answer));
    } catch (e) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      reply(`🚫 ${parseError(e)}`);
    }
  });

// ---------------- MISTRAL ----------------
cmd({ pattern: 'mistral', alias: ['mist'], desc: 'Ask Mistral AI.', category: 'ai', react: '💫', filename: __filename },
  async (conn, mek, m, { reply, q, from, pushname }) => {
    try {
      if (!q) return reply('❌ Usage: /mistral <query>');
      if (q.length > 1000) return reply('📝 Query too long! Max 1000 characters.');
      await conn.sendMessage(from, { react: { text: '📥', key: mek.key } });
      const answer = await callAI({
        conn, mek, from, q,
        apiUrl: `https://apiskeith.top/ai/mistral?q=${encodeURIComponent(q)}`,
        responseKey: 'result', fallbackKeys: ['answer','response','text']
      });
      await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
      reply(formatReply(q, answer));
    } catch (e) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      reply(`🚫 ${parseError(e)}`);
    }
  });

// ---------------- GROK ----------------
cmd({ pattern: 'grok', alias: ['xai'], desc: 'Ask Grok AI (xAI).', category: 'ai', react: '🤖', filename: __filename },
  async (conn, mek, m, { reply, q, from, pushname }) => {
    try {
      if (!q) return reply('❌ Usage: /grok <question>');
      await conn.sendMessage(from, { react: { text: '🤖', key: mek.key } });
      await conn.sendPresenceUpdate('composing', from);
      const personalizedPrompt = `You are a helpful AI assistant named ${BOT_NAME}. Your responses should be friendly and helpful.\nUser says: ${q}`;
      const { data } = await axios.get(
        `https://apiskeith.vercel.app/ai/grok?q=${encodeURIComponent(personalizedPrompt)}`,
        { timeout: 30000 }
      );
      if (!data?.status || !data?.result) throw new Error('API returned error');
      const answer = data.result;
      await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
      reply(formatReply(q, answer));
    } catch (e) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      reply(`🚫 ${parseError(e)}`);
    }
  });

// ---------------- SPEECHWRITER ----------------
cmd({ pattern: 'speechwriter', alias: ['speech','writer'], desc: 'Generate a speech.', category: 'ai', react: '🎤', filename: __filename },
  async (conn, mek, m, { reply, q, from, pushname }) => {
    try {
      if (!q) return reply('❌ Usage: /speechwriter <topic>');
      if (q.length > 200) return reply('📝 Topic too long! Max 200 characters.');
      await conn.sendMessage(from, { react: { text: '📥', key: mek.key } });
      await conn.sendPresenceUpdate('composing', from);
      const apiUrl = `https://apiskeith.top/ai/speechwriter?topic=${encodeURIComponent(q)}&length=short&type=dedication&tone=serious`;
      const { data } = await axios.get(apiUrl, { timeout: 30000 });
      if (!data?.status || !data?.result?.data?.data?.speech) throw new Error('Invalid response from Speechwriter API!');
      const speech = data.result.data.data.speech.trim();
      await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
      reply(formatReply(q, speech));  // plain response
    } catch (e) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      reply(`🚫 ${parseError(e)}`);
    }
  });

// ---------------- CHAT (GPT-5) ----------------
const chatHistory = new Map();
cmd({ pattern: 'chat', alias: ['ask','ai'], desc: 'Chat with AI assistant.', category: 'ai', react: '💬', filename: __filename },
  async (conn, mek, m, { reply, q, from, pushname }) => {
    try {
      if (!q) return reply('❌ Usage: /chat <message>');
      await conn.sendMessage(from, { react: { text: '💬', key: mek.key } });
      await conn.sendPresenceUpdate('composing', from);
      const personalizedPrompt = `You are a helpful AI assistant named ${BOT_NAME}. Your responses should be friendly and helpful.\nUser says: ${q}`;
      const { data } = await axios.get(
        `https://iamtkm.vercel.app/ai/gpt5?apikey=tkm&text=${encodeURIComponent(personalizedPrompt)}`,
        { timeout: 30000 }
      );
      const answer = data?.result;
      if (!answer) throw new Error('No response from AI');
      chatHistory.set(from, q);
      await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
      reply(formatReply(q, answer));
    } catch (e) {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
      reply(`🚫 ${parseError(e)}`);
    }
  });

// ---------------- REMOVE BACKGROUND ----------------
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
cmd({ pattern: 'removebg', alias: ['rmbg','nobg'], desc: 'Remove image background.', category: 'ai', react: '✂️', filename: __filename },
  async (conn, mek, m, { reply, args, from, pushname }) => {
    try {
      let imageUrl = null;
      if (args[0] && args[0].startsWith('http')) {
        imageUrl = args[0];
      } else {
        const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imgMsg = quoted?.imageMessage || mek.message?.imageMessage;
        if (imgMsg) {
          const stream = await downloadContentFromMessage(imgMsg, 'image');
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          const buf = Buffer.concat(chunks);
          const base64 = buf.toString('base64');
          imageUrl = `data:image/jpeg;base64,${base64}`;
        }
      }
      if (!imageUrl) return reply('✂️ Usage: reply to an image with /removebg, or /removebg <image_url>');
      reply('⏳ Removing background, please wait...');
      const apiUrl = `https://api.siputzx.my.id/api/iloveimg/removebg?image=${encodeURIComponent(imageUrl)}`;
      const response = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 45000 });
      if (!response.data) throw new Error('Failed to process image');
      let caption = `✅ Background removed successfully!\n\n> ${FOOTER}`;
      await conn.sendMessage(from, { image: Buffer.from(response.data), caption }, { quoted: mek });
    } catch (e) { reply(`🚫 ${parseError(e)}`); }
  });