// plugins/ACD_MENU.js — Full Custom UI Bot Menu System (Strict Stage Lockdown)
const { cmd, commands } = require('../command');
const { getSetting, isUserLoaded, initEnvsettings } = require('../settings');
const { getBuffer } = require('../lib/functions');
const os = require('os');  // For RAM info

// ══════════════════════════════════════════════════════════════════
// CONFIG — Change these to your own
// ══════════════════════════════════════════════════════════════════
const BOT_NAME    = 'Ѕнιтѕυ 〽️𝓲𝓷𝓲';
const BOT_VERSION = 'v3.0';
const OWNER_NAME  = 'ᴅɪʟsʜᴀ∇';

// ── All Menu Specific Images (All commands have image + reply) ─────
const CAT_IMAGES = {
  main:       'https://shyra.edgeone.app/bot-img.jpg', // Main Menu Image
  alive:      'https://shyra.edgeone.app/bot-img.jpg', // Alive Image
  detail:     'https://shyra.edgeone.app/bot-img.jpg', // Command Details Image
  group:      'https://shyra.edgeone.app/bot-img.jpg',
  main_cat:   'https://shyra.edgeone.app/bot-img.jpg', 
  settings:   'https://shyra.edgeone.app/bot-img.jpg',
  tools:      'https://shyra.edgeone.app/bot-img.jpg',
  download:   'https://shyra.edgeone.app/bot-img.jpg',
  ai:         'https://shyra.edgeone.app/bot-img.jpg',
  fun:        'https://shyra.edgeone.app/bot-img.jpg',
  search:     'https://shyra.edgeone.app/bot-img.jpg',
  anime:      'https://shyra.edgeone.app/bot-img.jpg',
  owner:      'https://shyra.edgeone.app/bot-img.jpg',
  textmaker:  'https://shyra.edgeone.app/bot-img.jpg',
  other:      'https://shyra.edgeone.app/bot-img.jpg'  // Default fallback
};

// ── Category Specific React Emojis ───────────────────────────────
const CAT_REACTS = {
  group:      '👥',
  main:       '🏠',
  settings:   '⚙️',
  tools:      '🔧',
  download:   '⬇️',
  ai:         '🤖',
  fun:        '🎮',
  search:     '🔍',
  anime:      '🎎',
  owner:      '👨🏻‍💻',
  textmaker:  '🗒️',
  other:      '✨'
};

// ── Global Footer Content ────────────────────────────────────────
const GLOBAL_FOOTER = `\n╭─────𓆩★𓆪──────╮\n> ㋛ 𝙿σ𝚆є𝚁є𝙳 𝙱у ᴅɪʟsʜα∇\n╰─────𓆩★𓆪──────╯`;

// ── Pending menu state: userId -> { stage, keys, cats, cmds, catName, prefix } ──
const menuState = new Map();

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════

function groupByCategory() {
  const cats = {};
  for (const c of commands) {
    if (!c.pattern || c.dontAddCommandList) continue;
    const cat = (c.category || 'other').toLowerCase();
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(c);
  }
  return cats;
}

function buildCategoryList(cats) {
  const keys = Object.keys(cats);
  let text = '';
  keys.forEach((cat, i) => {
    const numStr = (i + 1) < 10 ? `*${i + 1}.* ` : `*${i + 1}.*`;
    text += `${numStr}│❯❯◦ ${cat.toUpperCase()} MENU\n`;
  });
  return { text, keys };
}

function buildCmdList(cmds, catName, prefix) {
  let text = `╭──「 ${catName.toUpperCase()} COMMANDS 」\n`;
  cmds.forEach((c, i) => {
    text += `│ ${i + 1}. \`${prefix}${c.pattern}\`\n`;
    if (c.desc) text += `│    ─ _${c.desc}_\n`;
  });
  text += `╰─────────────\n\n`;
  text += `📝 *Reply with a number to see full command details!*\n`;
  text += GLOBAL_FOOTER;
  return text;
}

function buildCmdDetail(c, prefix) {
  let text = `╔══════════════════════╗\n`;
  text += `║  📌 COMMAND DETAILS  ║\n`;
  text += `╚══════════════════════╝\n\n`;
  text += `🔹 *Command:* \`${prefix}${c.pattern}\`\n`;
  if (c.desc)      text += `📝 *Info:* ${c.desc}\n`;
  if (c.category)  text += `📂 *Category:* ${c.category.toUpperCase()}\n`;
  if (c.alias?.length) text += `🔁 *Aliases:* ${c.alias.map(a => `\`${prefix}${a}\``).join(', ')}\n`;
  text += GLOBAL_FOOTER;
  return text;
}

// ══════════════════════════════════════════════════════════════════
// MAIN MENU COMMAND
// ══════════════════════════════════════════════════════════════════
cmd({
  pattern: 'menu',
  alias: ['help', 'cmds', 'commands'],
  desc: 'Interactive bot menu with image',
  category: 'main',
  react: '📁',
  filename: __filename
}, async (conn, mek, m, { sender, from, pushname, prefix, reply }) => {
  try {
    if (!isUserLoaded(sender)) await initEnvsettings(sender);

    const cats = groupByCategory();
    const { text: catList, keys } = buildCategoryList(cats);

    menuState.set(sender, { stage: 'main', keys, cats, prefix });
    setTimeout(() => menuState.delete(sender), 120000); // 2 min timeout

    const uptime = Math.floor(process.uptime());
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const usedMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalMemory = Math.round(os.totalmem() / 1024 / 1024);

    let menuText = ``;
    menuText += `👋 𝙷𝚎𝚢 ${pushname} 𝚆𝚎𝚕𝚌𝚘𝚖𝚎 𝚃𝚘 𝚜𝚑𝚒𝚝𝚜𝚞\n`;
    menuText += `╭━━━〔『BOT』『MENU』〕━✦\n`;
    menuText += `│  👾 \`Bot\`      : ${BOT_NAME}\n`;
    menuText += `│  📞 \`Owner\`    : ${OWNER_NAME}\n`;
    menuText += `│  🌀 \`Uptime\`   : ${hours}h ${minutes}m ${seconds}s\n`;
    menuText += `│  🧠 \`RAM\`      : ${usedMemory}MB / ${totalMemory}MB\n`;
    menuText += `╰────────────╯\n\n`;
    menuText += `╔═══════════════════╗\n`;
    menuText += `    📂  *SELECT A CATEGORY*   \n`;
    menuText += `╚═══════════════════╝\n`;
    menuText += catList;
    menuText += ` ┗━━━━━━━━━━━━✨\n`;
    menuText += `📝 *Reply with the category number.*\n`;
    menuText += GLOBAL_FOOTER;

    try {
      const imgBuf = await getBuffer(CAT_IMAGES['main']);
      await conn.sendMessage(from, {
        image: imgBuf,
        caption: menuText,
        mimetype: 'image/jpeg'
      }, { quoted: mek });
    } catch {
      await conn.sendMessage(from, { text: menuText }, { quoted: mek });
    }

  } catch (e) { reply(`❌ Error: ${e.message}`); }
});

// ══════════════════════════════════════════════════════════════════
// NUMBER REPLY LISTENER — Handles menu navigation (Strict Stage Lockdown)
// ══════════════════════════════════════════════════════════════════
cmd({
  on: 'body',
  dontAddCommandList: true,
  filename: __filename
}, async (conn, mek, m, { sender, body, from, reply, prefix }) => {
  try {
    if (!menuState.has(sender)) return;

    const input = body.trim();
    const state = menuState.get(sender);

    // 0 அழுத்தினால் எந்த ரியாக்‌ஷனும் நடக்காது (முற்றிலும் புறக்கணிக்கப்படும்)
    if (input === '0') return;

    // ── Stage: main → select category ────────────────────────────
    if (state.stage === 'main') {
      const num = parseInt(input);
      if (isNaN(num) || num < 1 || num > state.keys.length) return;

      const catName = state.keys[num - 1];
      const cmds    = state.cats[catName];
      
      // Stage மாறும்: இனி மெயின் மெனு எண்கள் வேலை செய்யாது
      menuState.set(sender, { ...state, stage: 'category', catName, cmds });

      const reactionEmoji = CAT_REACTS[catName.toLowerCase()] || CAT_REACTS['other'];
      await conn.sendMessage(from, { react: { text: reactionEmoji, key: mek.key } });

      const listText = buildCmdList(cmds, catName, state.prefix);
      const catImgUrl = CAT_IMAGES[catName.toLowerCase()] || CAT_IMAGES['other'];

      try {
        const imgBuf = await getBuffer(catImgUrl);
        await conn.sendMessage(from, {
          image: imgBuf,
          caption: listText,
          mimetype: 'image/jpeg'
        }, { quoted: mek });
      } catch {
        reply(listText);
      }
      return;
    }

    // ── Stage: category → select command ─────────────────────────
    if (state.stage === 'category') {
      const num = parseInt(input);
      // ஓபனில் இருக்கும் கேட்டகரியின் கமாண்ட் எண்ணிக்கையை தாண்டி அழுத்தினால் block ஆகும்
      if (isNaN(num) || num < 1 || num > state.cmds.length) return;

      const cmd  = state.cmds[num - 1];
      menuState.set(sender, { ...state, stage: 'detail', cmd });

      await conn.sendMessage(from, { react: { text: '📌', key: mek.key } });

      const detailText = buildCmdDetail(cmd, state.prefix);
      const detailImgUrl = CAT_IMAGES['detail'] || CAT_IMAGES['other'];

      try {
        const imgBuf = await getBuffer(detailImgUrl);
        await conn.sendMessage(from, {
          image: imgBuf,
          caption: detailText,
          mimetype: 'image/jpeg'
        }, { quoted: mek });
      } catch {
        reply(detailText);
      }
      return;
    }

    // ── Stage: detail → Show category list again with Image + Reply ──
    if (state.stage === 'detail') {
      const num = parseInt(input);
      if (isNaN(num)) return;
      
      const listText = buildCmdList(state.cmds, state.catName, state.prefix);
      menuState.set(sender, { ...state, stage: 'category' });

      const catImgUrl = CAT_IMAGES[state.catName.toLowerCase()] || CAT_IMAGES['other'];

      try {
        const imgBuf = await getBuffer(catImgUrl);
        await conn.sendMessage(from, {
          image: imgBuf,
          caption: listText,
          mimetype: 'image/jpeg'
        }, { quoted: mek });
      } catch {
        reply(listText);
      }
      return;
    }

  } catch (e) {
    console.error('[MENU NAV ERROR]', e);
  }
});

// ══════════════════════════════════════════════════════════════════
// ALIVE COMMAND — Hacker Font Backticks + Image + Reply + Global Footer
// ══════════════════════════════════════════════════════════════════
cmd({
  pattern: 'alive',
  alias: ['status', 'bot'],
  desc: 'Check if bot is alive',
  category: 'main',
  react: '💚',
  filename: __filename
}, async (conn, mek, m, { from, pushname, reply }) => {
  try {
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const min = Math.floor((uptime % 3600) / 60);
    const sec = Math.floor(uptime % 60);
    const totalCmds = commands.filter(c => c.pattern && !c.dontAddCommandList).length;

    let text = `╭━━━〔『BOT』『STATUS』〕━✦\n`;
    text += `│  🟢 \`Status\`   : Online & Running\n`;
    text += `│  🤖 \`Bot\`      : ${BOT_NAME} v${BOT_VERSION}\n`;
    text += `│  👋 \`Owner\`     : ${OWNER_NAME}\n`;
    text += `│  ⏱️ \`Uptime\`   : ${h}h ${min}m ${sec}s\n`;
    text += `│  📊 \`Cmds\`     : ${totalCmds}\n`;
    text += `╰────────────╯\n\n`;
    text += `_💡 Use \`/menu\` to open the interactive UI_\n`;
    text += GLOBAL_FOOTER;

    try {
      const imgBuf = await getBuffer(CAT_IMAGES['alive']);
      await conn.sendMessage(from, {
        image: imgBuf,
        caption: text,
        mimetype: 'image/jpeg'
      }, { quoted: mek });
    } catch {
      reply(text);
    }
  } catch (e) { reply(`❌ Error: ${e.message}`); }
});

// ══════════════════════════════════════════════════════════════════
// HELP COMMAND — Image + Reply + Global Footer
// ══════════════════════════════════════════════════════════════════
cmd({
  pattern: 'how',
  alias: ['usage', 'cmdinfo'],
  desc: 'Get details for a command. Usage: /how <command>',
  category: 'main',
  react: '❓',
  filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
  try {
    if (!q) return reply(`❌ Usage: /how <command name>\nExample: /how ytmp3`);
    const name = q.toLowerCase().replace(/^[^a-z0-9]/g, '');
    const found = commands.find(c =>
      c.pattern === name ||
      (c.alias && c.alias.includes(name))
    );
    if (!found) return reply(`❌ Command *${name}* not found.\nUse \`/menu\` to browse all commands.`);
    
    const detailText = buildCmdDetail(found, prefix);
    const detailImgUrl = CAT_IMAGES['detail'] || CAT_IMAGES['other'];

    try {
      const imgBuf = await getBuffer(detailImgUrl);
      await conn.sendMessage(from, {
        image: imgBuf,
        caption: detailText,
        mimetype: 'image/jpeg'
      }, { quoted: mek });
    } catch {
      reply(detailText);
    }
  } catch (e) { reply(`❌ Error: ${e.message}`); }
});
