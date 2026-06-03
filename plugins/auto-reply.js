// plugins/autoreply.js
const { cmd } = require('../command');
const { initEnvsettings, getSetting, isUserLoaded } = require('../settings');
const fs = require('fs');
const path = require('path');

const autoreplyPath = path.join(__dirname, '../all/autoreply.json');
let autoreplyData = {};
try {
  autoreplyData = JSON.parse(fs.readFileSync(autoreplyPath, 'utf8'));
} catch (e) {
  console.error('[AUTO REPLY] Failed to load autoreply.json:', e.message);
}

async function ensureLoaded(userId) {
  if (!isUserLoaded(userId)) await initEnvsettings(userId);
}

cmd({
  on: "body",
  dontAddCommandList: true,
  filename: __filename
}, async (conn, mek, m, { sender, body, reply }) => {
  try {
    if (!body) return;
    await ensureLoaded(sender);

    const autoReply = getSetting(sender, 'AUTO_REPLY');
    if (autoReply !== 'on') return;

    const userMsg = body.toLowerCase().trim();
    for (const trigger in autoreplyData) {
      if (userMsg === trigger.toLowerCase()) {
        let response = autoreplyData[trigger];

        // 🔁 Replace dynamic placeholders
        response = response
          .replace(/\$\{new Date\(\)\.toLocaleTimeString\(\)\}/g, new Date().toLocaleTimeString())
          .replace(/\$\{new Date\(\)\.toLocaleDateString\(\)\}/g, new Date().toLocaleDateString());

        await reply(response);
        return;
      }
    }
  } catch (e) {
    console.error('[AUTO REPLY ERROR]', e);
  }
});