// plugins/ACD_SETTINGS.js
const { cmd } = require('../command');
const { initEnvsettings, getSetting, setSetting, toggleSetting, getFullSettings, isUserLoaded } = require('../settings');
const { getBuffer } = require('../lib/functions'); // for downloading the image

// ════ IMAGE URL (change this to your own banner/logo) ═══════════════════
const SETTINGS_IMG_URL = 'https://i.imgur.com/xyz123.png';

// ── Ensure user settings loaded ─────────────────────────────────────────────
async function ensureLoaded(userId) {
  if (!isUserLoaded(userId)) await initEnvsettings(userId);
}

// ── Pending state for custom inputs (emoji/prefix) ──────────────────────────
const pendingSettings = new Map();

// ── Hierarchical menu definition (1.1, 1.2 … 15.1) ──────────────────────────
const settingsDef = [
  { major: 1,  key: 'AUTO_VIEW_STATUS', label: 'Auto View Status', options: ['on','off'],                    cat: '📌 Auto Features' },
  { major: 2,  key: 'AUTO_LIKE_STATUS', label: 'Auto Like Status', options: ['on','off'],                    cat: '📌 Auto Features' },
  { major: 3,  key: 'AUTO_RECORDING',   label: 'Auto Recording',    options: ['on','off'],                    cat: '📌 Auto Features' },
  { major: 4,  key: 'AUTO_REACT',       label: 'Auto React',        options: ['on','off','emoji'],            cat: '📌 Auto Features' },
  { major: 5,  key: 'ANTI_CALL',        label: 'Anti Call',         options: ['on','off'],                    cat: '🛡️ Anti Features' },
  { major: 6,  key: 'ANTI_DELETE',      label: 'Anti Delete',       options: ['on','off','inbox','same'],     cat: '🛡️ Anti Features' },
  { major: 7,  key: 'ANTI_EDIT',        label: 'Anti Edit',         options: ['on','off'],                    cat: '🛡️ Anti Features' },
  { major: 8,  key: 'ANTI_FAKE',        label: 'Anti Fake',         options: ['on','off'],                    cat: '🛡️ Anti Features' },
  { major: 9,  key: 'STATUS_REACT',     label: 'Status React',      options: ['on','off','emoji'],            cat: '💬 Status & Presence' },
  { major: 10, key: 'PRESENCE_TYPE',    label: 'Presence Type',     options: ['on','off'],                    cat: '💬 Status & Presence' },
  { major: 11, key: 'PRESENCE_FAKE',    label: 'Presence Fake',     options: ['on','off','both'],             cat: '💬 Status & Presence' },
  { major: 12, key: 'WELCOME',          label: 'Welcome Message',   options: ['on','off'],                    cat: '👥 Group Features' },
  { major: 13, key: 'GOODBYE',          label: 'Goodbye Message',   options: ['on','off'],                    cat: '👥 Group Features' },
  { major: 14, key: 'MODE',             label: 'Bot Mode',          options: ['public','private'],             cat: '🔧 Bot Config' },
  { major: 15, key: 'PREFIX', label: 'Set Prefix', options: ['value'], cat: '🔧 Bot Config' },
{ major: 16, key: 'AUTO_REPLY', label: 'Auto Reply', options: ['on','off'], cat: '💬 Auto Reply' }
];

// Flatten into menu items
const flatMenu = [];
const menuMap = {};   // "1.1" → item

settingsDef.forEach(def => {
  def.options.forEach((opt, idx) => {
    const subNum = `${def.major}.${idx + 1}`;
    const needsInput = (opt === 'emoji' || opt === 'value');
    const value = needsInput ? null : opt;
    const labelSuffix = needsInput
      ? (opt === 'emoji' ? ' (custom emoji)' : ' (enter value)')
      : ` ${opt.toUpperCase()}`;
    const item = {
      num: subNum,
      key: def.key,
      value,
      label: def.label + labelSuffix,
      cat: def.cat,
      needsInput,
      optType: opt
    };
    flatMenu.push(item);
    menuMap[subNum] = item;
  });
});

// ── Format current value for display ────────────────────────────────────────
function fmtVal(v) {
  if (v === 'on')  return '✅ ON';
  if (v === 'off') return '❌ OFF';
  return `✳️  ${v}`;
}

// ── /settings command – sends an image + interactive menu ───────────────────
cmd({
  pattern: "settings",
  desc: "Interactive settings menu with image",
  category: "settings",
  react: "⚙️",
  filename: __filename
}, async (conn, mek, m, { sender, reply }) => {
  try {
    await ensureLoaded(sender);
    const s = getFullSettings(sender);

    // Build the menu text
    let text = `╔════════════════════════════╗\n`;
    text += `║   ⚙️  *YOUR SETTINGS MENU*    ║\n`;
    text += `╚════════════════════════════╝\n\n`;
    text += `_📝 Reply with a number (e.g. 6.3) to change setting_\n\n`;

    const byCat = {};
    flatMenu.forEach(item => {
      if (!byCat[item.cat]) byCat[item.cat] = [];
      byCat[item.cat].push(item);
    });

    for (const [cat, items] of Object.entries(byCat)) {
      text += `\n${cat}\n`;
      text += `${'─'.repeat(35)}\n`;
      for (const item of items) {
        const cur = s[item.key] ?? (item.key === 'PREFIX' ? '/' : 'off');
        let marker = '';
        if (!item.needsInput && item.value !== null && cur === item.value) {
          marker = '  👈 ACTIVE';
        }
        text += `  *${item.num}* → ${item.label}${marker}\n`;
      }
    }

    text += `\n💡 _Example: Type *6.3* to set Anti Delete to INBOX_`;

    // Send image + caption
    try {
      const imgBuffer = await getBuffer(SETTINGS_IMG_URL);
      await conn.sendMessage(m.chat, {
        image: imgBuffer,
        caption: text,
        mimetype: 'image/png'
      }, { quoted: mek });
    } catch (imgErr) {
      // If image fails, fall back to plain text
      console.error('[SETTINGS IMAGE ERROR]', imgErr.message);
      reply(text);
    }
  } catch (e) { reply(`❌ Error: ${e.message}`); }
});

// ── Body listener – handle number replies (1.1, 6.3 etc.) ──────────────────
cmd({
  on: "body",
  dontAddCommandList: true,
  filename: __filename
}, async (conn, mek, m, { sender, body, reply }) => {
  try {
    const text = body.trim();

    // Step 2: user is replying with a custom value (pending)
    if (pendingSettings.has(sender)) {
      const pending = pendingSettings.get(sender);
      pendingSettings.delete(sender);

      const val = text;

      if (pending.optType === 'value') {   // Set Prefix
        if (!val || /\s/.test(val) || val.length > 5) {
          return reply(`❌ Invalid value. Prefix must be 1–5 characters, no spaces. Try again with /settings`);
        }
        await ensureLoaded(sender);
        await setSetting(sender, pending.key, val);
        return reply(`✅ *Prefix updated!*\n\nNew prefix: *${val}*\nNow use: *${val}ping*, *${val}settings*, etc.`);
      }

      if (pending.optType === 'emoji') {   // Custom emoji
        if (!val) return reply(`❌ Please reply with a valid emoji or text.`);
        await ensureLoaded(sender);
        await setSetting(sender, pending.key, val);
        return reply(`${val} *${pending.label}* set to *${val}*\n\nThis emoji will now be used! ✅`);
      }

      return reply(`❌ Unexpected pending state. Please use /settings again.`);
    }

    // Step 1: user typed a menu number (e.g. "6.3")
    if (!menuMap[text]) return;   // not a menu number, ignore

    const item = menuMap[text];
    await ensureLoaded(sender);

    // If fixed value, apply directly
    if (!item.needsInput && item.value !== null) {
      await setSetting(sender, item.key, item.value);
      const icon = item.value === 'on' ? '✅' : item.value === 'off' ? '❌' : '✳️';
      return reply(`${icon} *${item.label}* activated!\n\nCurrent value: ${fmtVal(item.value)}`);
    }

    // Custom input required
    pendingSettings.set(sender, { ...item });
    setTimeout(() => { pendingSettings.delete(sender); }, 30000);

    let prompt = `⚙️ *${item.label}*\n\n`;
    prompt += `Reply with your desired ${item.optType === 'emoji' ? 'emoji' : 'value'}.\n`;
    prompt += `_You have 30 seconds to reply._`;
    reply(prompt);

  } catch (e) { console.error('[SETTINGS BODY ERROR]', e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// Individual commands (still work as before)
// ═══════════════════════════════════════════════════════════════════════════

cmd({
  pattern: "antidelete",
  desc: "Anti-delete: on | off | inbox | same",
  category: "settings", react: "🗑️", filename: __filename
}, async (conn, mek, m, { sender, args, reply }) => {
  try {
    await ensureLoaded(sender);
    const val = args[0]?.toLowerCase();
    const valid = ['on','off','inbox','same'];
    if (!val || !valid.includes(val)) {
      const cur = getSetting(sender, 'ANTI_DELETE');
      return reply(`*🗑️ Anti Delete* — Current: *${cur}*\n\nUsage: /antidelete <on | off | inbox | same>\n• *on* — everywhere\n• *off* — disabled\n• *inbox* — private chats only\n• *same* — same chat`);
    }
    await setSetting(sender, 'ANTI_DELETE', val);
    const icon = {on:'✅',off:'❌',inbox:'📥',same:'💬'};
    reply(`${icon[val]} *Anti Delete* → *${val.toUpperCase()}*`);
  } catch(e) { reply(`❌ Error: ${e.message}`); }
});

cmd({
  pattern: "antiedit",
  desc: "Anti-edit: on | off",
  category: "settings", react: "✏️", filename: __filename
}, async (conn, mek, m, { sender, args, reply }) => {
  try {
    await ensureLoaded(sender);
    const val = args[0]?.toLowerCase();
    if (val === 'on' || val === 'off') {
      await setSetting(sender, 'ANTI_EDIT', val);
      reply(`${val==='on'?'✅':'❌'} *Anti Edit* → *${val.toUpperCase()}*`);
    } else {
      const nv = await toggleSetting(sender, 'ANTI_EDIT');
      reply(`${nv==='on'?'✅':'❌'} *Anti Edit* toggled → *${nv.toUpperCase()}*`);
    }
  } catch(e) { reply(`❌ Error: ${e.message}`); }
});

cmd({
  pattern: "anticall",
  desc: "Block calls: on | off",
  category: "settings", react: "📵", filename: __filename
}, async (conn, mek, m, { sender, args, reply }) => {
  try {
    await ensureLoaded(sender);
    const val = args[0]?.toLowerCase();
    if (val === 'on' || val === 'off') {
      await setSetting(sender, 'ANTI_CALL', val);
      reply(`${val==='on'?'✅':'❌'} *Anti Call* → *${val.toUpperCase()}*`);
    } else {
      const nv = await toggleSetting(sender, 'ANTI_CALL');
      reply(`${nv==='on'?'✅':'❌'} *Anti Call* toggled → *${nv.toUpperCase()}*`);
    }
  } catch(e) { reply(`❌ Error: ${e.message}`); }
});

cmd({
  pattern: "statusreact",
  desc: "Status react emoji. /statusreact 🔥 or off",
  category: "settings", react: "😍", filename: __filename
}, async (conn, mek, m, { sender, args, reply }) => {
  try {
    await ensureLoaded(sender);
    const val = args[0];
    if (!val) {
      const cur = getSetting(sender, 'STATUS_REACT');
      return reply(`*😍 Status React* — Current: *${cur}*\n\nUsage: /statusreact 🔥  or  /statusreact off`);
    }
    const v = val.toLowerCase() === 'off' ? 'off' : val;
    await setSetting(sender, 'STATUS_REACT', v);
    reply(v==='off' ? `❌ *Status React* disabled` : `${v} *Status React* → *${v}*`);
  } catch(e) { reply(`❌ Error: ${e.message}`); }
});

cmd({
  pattern: "autoreact",
  desc: "Auto react emoji. /autoreact 😂 or off",
  category: "settings", react: "🎭", filename: __filename
}, async (conn, mek, m, { sender, args, reply }) => {
  try {
    await ensureLoaded(sender);
    const val = args[0];
    if (!val) {
      const cur = getSetting(sender, 'AUTO_REACT');
      return reply(`*🎭 Auto React* — Current: *${cur}*\n\nUsage: /autoreact 😂  or  /autoreact off`);
    }
    const v = val.toLowerCase() === 'off' ? 'off' : val;
    await setSetting(sender, 'AUTO_REACT', v);
    reply(v==='off' ? `❌ *Auto React* disabled` : `${v} *Auto React* → *${v}*`);
  } catch(e) { reply(`❌ Error: ${e.message}`); }
});

cmd({
  pattern: "autoviewstatus",
  alias: ["autoview"],
  desc: "Auto view status: on | off",
  category: "settings", react: "👁️", filename: __filename
}, async (conn, mek, m, { sender, args, reply }) => {
  try {
    await ensureLoaded(sender);
    const val = args[0]?.toLowerCase();
    if (val === 'on' || val === 'off') {
      await setSetting(sender, 'AUTO_VIEW_STATUS', val);
      reply(`${val==='on'?'✅':'❌'} *Auto View Status* → *${val.toUpperCase()}*`);
    } else {
      const nv = await toggleSetting(sender, 'AUTO_VIEW_STATUS');
      reply(`${nv==='on'?'✅':'❌'} *Auto View Status* toggled → *${nv.toUpperCase()}*`);
    }
  } catch(e) { reply(`❌ Error: ${e.message}`); }
});

cmd({
  pattern: "autolikestatus",
  alias: ["autolike"],
  desc: "Auto like status: on | off",
  category: "settings", react: "❤️", filename: __filename
}, async (conn, mek, m, { sender, args, reply }) => {
  try {
    await ensureLoaded(sender);
    const val = args[0]?.toLowerCase();
    if (val === 'on' || val === 'off') {
      await setSetting(sender, 'AUTO_LIKE_STATUS', val);
      reply(`${val==='on'?'✅':'❌'} *Auto Like Status* → *${val.toUpperCase()}*`);
    } else {
      const nv = await toggleSetting(sender, 'AUTO_LIKE_STATUS');
      reply(`${nv==='on'?'✅':'❌'} *Auto Like Status* toggled → *${nv.toUpperCase()}*`);
    }
  } catch(e) { reply(`❌ Error: ${e.message}`); }
});

cmd({
  pattern: "autorecording",
  alias: ["autorec"],
  desc: "Auto recording indicator: on | off",
  category: "settings", react: "🎙️", filename: __filename
}, async (conn, mek, m, { sender, args, reply }) => {
  try {
    await ensureLoaded(sender);
    const val = args[0]?.toLowerCase();
    if (val === 'on' || val === 'off') {
      await setSetting(sender, 'AUTO_RECORDING', val);
      reply(`${val==='on'?'✅':'❌'} *Auto Recording* → *${val.toUpperCase()}*`);
    } else {
      const nv = await toggleSetting(sender, 'AUTO_RECORDING');
      reply(`${nv==='on'?'✅':'❌'} *Auto Recording* toggled → *${nv.toUpperCase()}*`);
    }
  } catch(e) { reply(`❌ Error: ${e.message}`); }
});

cmd({
  pattern: "antifake",
  desc: "Block fake numbers: on | off",
  category: "settings", react: "🚫", filename: __filename
}, async (conn, mek, m, { sender, args, reply }) => {
  try {
    await ensureLoaded(sender);
    const val = args[0]?.toLowerCase();
    if (val === 'on' || val === 'off') {
      await setSetting(sender, 'ANTI_FAKE', val);
      reply(`${val==='on'?'✅':'❌'} *Anti Fake* → *${val.toUpperCase()}*`);
    } else {
      const nv = await toggleSetting(sender, 'ANTI_FAKE');
      reply(`${nv==='on'?'✅':'❌'} *Anti Fake* toggled → *${nv.toUpperCase()}*`);
    }
  } catch(e) { reply(`❌ Error: ${e.message}`); }
});

cmd({
  pattern: "welcome",
  desc: "Group welcome message: on | off",
  category: "settings", react: "👋", filename: __filename
}, async (conn, mek, m, { sender, args, reply }) => {
  try {
    await ensureLoaded(sender);
    const val = args[0]?.toLowerCase();
    if (val === 'on' || val === 'off') {
      await setSetting(sender, 'WELCOME', val);
      reply(`${val==='on'?'✅':'❌'} *Welcome Message* → *${val.toUpperCase()}*`);
    } else {
      const nv = await toggleSetting(sender, 'WELCOME');
      reply(`${nv==='on'?'✅':'❌'} *Welcome Message* toggled → *${nv.toUpperCase()}*`);
    }
  } catch(e) { reply(`❌ Error: ${e.message}`); }
});

cmd({
  pattern: "goodbye",
  desc: "Group goodbye message: on | off",
  category: "settings", react: "🚶", filename: __filename
}, async (conn, mek, m, { sender, args, reply }) => {
  try {
    await ensureLoaded(sender);
    const val = args[0]?.toLowerCase();
    if (val === 'on' || val === 'off') {
      await setSetting(sender, 'GOODBYE', val);
      reply(`${val==='on'?'✅':'❌'} *Goodbye Message* → *${val.toUpperCase()}*`);
    } else {
      const nv = await toggleSetting(sender, 'GOODBYE');
      reply(`${nv==='on'?'✅':'❌'} *Goodbye Message* toggled → *${nv.toUpperCase()}*`);
    }
  } catch(e) { reply(`❌ Error: ${e.message}`); }
});

cmd({
  pattern: "setprefix",
  desc: "Change command prefix. /setprefix !",
  category: "settings", react: "🔧", filename: __filename
}, async (conn, mek, m, { sender, args, reply }) => {
  try {
    await ensureLoaded(sender);
    const newPrefix = args[0];
    if (!newPrefix) {
      const cur = getSetting(sender, 'PREFIX');
      return reply(`*🔧 Set Prefix*\n\nCurrent: *${cur}*\n\nUsage: /setprefix <symbol>\nExamples: /setprefix !  /setprefix .  /setprefix #`);
    }
    if (newPrefix.length > 5) return reply(`❌ Prefix too long. Use 1–5 characters.`);
    if (/\s/.test(newPrefix)) return reply(`❌ Prefix cannot contain spaces.`);
    await setSetting(sender, 'PREFIX', newPrefix);
    reply(`✅ *Prefix updated!*\n\nNew prefix: *${newPrefix}*\nNow use: *${newPrefix}ping*, *${newPrefix}settings*, etc.`);
  } catch(e) { reply(`❌ Error: ${e.message}`); }
});

cmd({
  pattern: "mode",
  desc: "Set bot mode: public or private. /mode public",
  category: "settings", react: "🔒", filename: __filename
}, async (conn, mek, m, { sender, args, reply }) => {
  try {
    await ensureLoaded(sender);
    const mode = args[0]?.toLowerCase();
    const valid = ['public', 'private'];
    if (!mode || !valid.includes(mode)) {
      const cur = getSetting(sender, 'MODE');
      return reply(`*🔒 Bot Mode*\n\nCurrent: *${cur}*\n\nUsage: /mode <public | private>\n• *public* — Responds to everyone\n• *private* — Responds to owner only`);
    }
    await setSetting(sender, 'MODE', mode);
    const icon = mode === 'public' ? '🌐' : '🔒';
    reply(`${icon} *Bot mode set to ${mode.toUpperCase()}*`);
  } catch(e) { reply(`❌ Error: ${e.message}`); }
});