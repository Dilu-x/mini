// plugins/ACD_SETTINGS.js
const { cmd } = require('../command');
const { initEnvsettings, getSetting, setSetting, toggleSetting, getFullSettings, isUserLoaded } = require('../settings');

// ── Ensure user settings loaded ───────────────────────────────────────────────
async function ensureLoaded(userId) {
  if (!isUserLoaded(userId)) await initEnvsettings(userId);
}

// ── Pending state: waiting for user's value reply ─────────────────────────────
// Map: userId -> { key, label, options }
const pendingSettings = new Map();

// ── Settings menu definition ──────────────────────────────────────────────────
const SETTINGS_MENU = [
  {
    section: "1",
    title: "📌 Auto Features",
    items: [
      { num: "1.1", label: "Auto View Status",  key: "AUTO_VIEW_STATUS", options: ["on", "off"] },
      { num: "1.2", label: "Auto Like Status",  key: "AUTO_LIKE_STATUS", options: ["on", "off"] },
      { num: "1.3", label: "Auto Recording",    key: "AUTO_RECORDING",   options: ["on", "off"] },
      { num: "1.4", label: "Auto React (emoji)",key: "AUTO_REACT",       options: ["on", "off", "emoji"] },
    ]
  },
  {
    section: "2",
    title: "🛡️ Anti Features",
    items: [
      { num: "2.1", label: "Anti Call",    key: "ANTI_CALL",   options: ["on", "off"] },
      { num: "2.2", label: "Anti Delete",  key: "ANTI_DELETE", options: ["on", "off", "inbox", "same"] },
      { num: "2.3", label: "Anti Fake",    key: "ANTI_FAKE",   options: ["on", "off"] },
    ]
  },
  {
    section: "3",
    title: "💬 Status & Presence",
    items: [
      { num: "3.1", label: "Status React (emoji)", key: "STATUS_REACT",   options: ["on", "off", "emoji"] },
      { num: "3.2", label: "Presence Type",        key: "PRESENCE_TYPE",  options: ["on", "off"] },
      { num: "3.3", label: "Presence Fake",        key: "PRESENCE_FAKE",  options: ["on", "off", "both"] },
    ]
  },
  {
    section: "4",
    title: "👥 Group Features",
    items: [
      { num: "4.1", label: "Welcome Message", key: "WELCOME", options: ["on", "off"] },
      { num: "4.2", label: "Goodbye Message", key: "GOODBYE", options: ["on", "off"] },
    ]
  },
  {
    section: "5",
    title: "🔧 Bot Config",
    items: [
      { num: "5.1", label: "Set Prefix", key: "PREFIX", options: ["value"] },
    ]
  }
];

// ── Flatten menu for quick lookup by number ───────────────────────────────────
const menuMap = {};
for (const sec of SETTINGS_MENU) {
  for (const item of sec.items) {
    menuMap[item.num] = item;
  }
}

// ── Format current value for display ─────────────────────────────────────────
function fmtVal(v) {
  if (v === 'on')  return '✅ ON';
  if (v === 'off') return '❌ OFF';
  return `✳️  ${v}`;
}

// ── /settings command — show numbered menu ────────────────────────────────────
cmd({
  pattern: "settings",
  desc: "Interactive settings menu",
  category: "settings",
  react: "⚙️",
  filename: __filename
}, async (conn, mek, m, { sender, reply }) => {
  try {
    await ensureLoaded(sender);
    const s = getFullSettings(sender);

    let text = `╔══════════════════════════╗\n`;
    text += `║   ⚙️  *YOUR SETTINGS MENU*   ║\n`;
    text += `╚══════════════════════════╝\n`;
    text += `_Reply with number to change a setting_\n\n`;

    for (const sec of SETTINGS_MENU) {
      text += `*${sec.title}*\n`;
      for (const item of sec.items) {
        const cur = s[item.key] ?? 'off';
        text += `  *${item.num}* — ${item.label}\n`;
        text += `         Current: ${fmtVal(cur)}\n`;
      }
      text += `\n`;
    }

    text += `💡 _Example: Type *2.2* to change Anti Delete_`;
    reply(text);
  } catch (e) { reply(`❌ Error: ${e.message}`); }
});

// ── Body listener — intercept number replies ──────────────────────────────────
cmd({
  on: "body",
  dontAddCommandList: true,
  filename: __filename
}, async (conn, mek, m, { sender, body, reply }) => {
  try {
    const text = body.trim();

    // ── Step 2: user is replying with a value (e.g. "on", "off", "inbox", "😂") ──
    if (pendingSettings.has(sender)) {
      const pending = pendingSettings.get(sender);
      pendingSettings.delete(sender);

      const val = text.toLowerCase();

      // Validate value
      if (pending.options.includes("value")) {
        // Free-form value (prefix, emoji)
        if (!text || /\s/.test(text) || text.length > 10) {
          return reply(`❌ Invalid value. Try again with /settings`);
        }
        await ensureLoaded(sender);
        await setSetting(sender, pending.key, text);
        return reply(`✅ *${pending.label}* updated!\n\nNew value: *${text}*`);
      }

      if (pending.options.includes("emoji") && !["on","off","inbox","same","both"].includes(val)) {
        // Treat as custom emoji value
        await ensureLoaded(sender);
        await setSetting(sender, pending.key, text);
        return reply(`${text} *${pending.label}* set to *${text}*\n\nThis emoji will now be used! ✅`);
      }

      if (!pending.options.includes(val)) {
        const opts = pending.options.join(' | ');
        return reply(`❌ Invalid option *"${text}"*\n\nValid options: *${opts}*\n\nReply again with correct value.`);
      }

      await ensureLoaded(sender);
      await setSetting(sender, pending.key, val);

      const icon = val === 'on' ? '✅' : val === 'off' ? '❌' : '✳️';
      return reply(`${icon} *${pending.label}* set to *${val.toUpperCase()}* successfully!\n\nType /settings to view all settings.`);
    }

    // ── Step 1: user typed a menu number (e.g. "1.1", "2.2") ──
    if (!menuMap[text]) return; // not a menu number, ignore

    const item = menuMap[text];
    await ensureLoaded(sender);
    const cur = getSetting(sender, item.key);

    // Save pending state
    pendingSettings.set(sender, item);

    // Auto-expire pending after 30 seconds
    setTimeout(() => { pendingSettings.delete(sender); }, 30000);

    // Build options text
    let optText = '';
    if (item.options.includes('emoji')) {
      optText = item.options.filter(o => o !== 'emoji').map(o => `*${o}*`).join(' | ');
      optText += ` | *any emoji* (e.g. 🔥 😂 ❤️)`;
    } else if (item.options.includes('value')) {
      optText = `*any value* (e.g. / or ! or .)`;
    } else {
      optText = item.options.map(o => `*${o}*`).join(' | ');
    }

    reply(`⚙️ *${item.label}*\n\nCurrent: ${fmtVal(cur)}\n\nReply with: ${optText}\n\n_You have 30 seconds to reply_`);

  } catch (e) { console.error('[SETTINGS BODY ERROR]', e); }
});


// ═══════════════════════════════════════════════════════════════════════════════
// Individual commands (still work as before)
// ═══════════════════════════════════════════════════════════════════════════════

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
