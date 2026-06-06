// plugins/autoreply.js — Visual Auto-Reply System with Image + Premium Footer
const { cmd } = require('../command');
const { initEnvsettings, getSetting, isUserLoaded } = require('../settings');
const { getBuffer } = require('../lib/functions');
const fs = require('fs');
const path = require('path');

// ── Image & Footer Configurations ────────────────────────────────
const AUTOREPLY_IMG_URL = 'https://shyra.edgeone.app/bot-img.jpg'; // ஆட்டோ-ரிப்ளை மீடியாவுடன் செல்லும் இமேஜ் லிங்க்
const GLOBAL_FOOTER     = `\n╭─────𓆩★𓆪──────╮\n> ㋛ Ⲣ૦𝚅𝞔Ꮢ𝞔Ｄ 𝗕Ⲩ ＤƖ𐐛𝘚Η𝔸∇\n╰─────𓆩★𓆪──────╯`;

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
}, async (conn, mek, m, { sender, body, from, reply }) => {
  try {
    if (!body) return;
    
    const userMsg = body.toLowerCase().trim();
    // 0 அழுத்தினால் ஆட்டோ-ரிப்ளை சிஸ்டம் முழுமையாக இக்னோர் செய்யும்
    if (userMsg === '0') return;

    await ensureLoaded(sender);

    // செட்டிங்ஸில் AUTO_REPLY ஆன்-ல் இருக்கிறதா என்று பார்க்கிறோம்
    const autoReplySetting = getSetting(sender, 'AUTO_REPLY');
    if (autoReplySetting !== 'on') return;

    for (const trigger in autoreplyData) {
      if (userMsg === trigger.toLowerCase()) {
        let response = autoreplyData[trigger];

        // 🔁 Replace dynamic placeholders (Time & Date)
        response = response
          .replace(/\$\{new Date\(\)\.toLocaleTimeString\(\)\}/g, new Date().toLocaleTimeString())
          .replace(/\$\{new Date\(\)\.toLocaleDateString\(\)\}/g, new Date().toLocaleDateString());

        // இறுதி மெசேஜுடன் பிரீமியம் ஃபூட்டரை இணைக்கிறோம்
        const finalCaption = `${response}\n${GLOBAL_FOOTER}`;

        // கஸ்டம் இமேஜ் + கேப்ஷன் ரிப்ளை லுக் 
        try {
          const imgBuf = await getBuffer(AUTOREPLY_IMG_URL);
          await conn.sendMessage(from, {
            image: imgBuf,
            caption: finalCaption,
            mimetype: 'image/jpeg'
          }, { quoted: mek });
        } catch (imgErr) {
          // இமேஜ் லோட் ஆகவில்லை என்றால் மட்டும் நார்மல் டெக்ஸ்டாக மாறும்
          await conn.sendMessage(from, { text: finalCaption }, { quoted: mek });
        }
        return; // ட்ரிகர் மேட்ச் ஆகி மெசேஜ் அனுப்பப்பட்டதும் லூப்பை நிறுத்தவும்
      }
    }
  } catch (e) {
    console.error('[AUTO REPLY ERROR]', e);
  }
});
