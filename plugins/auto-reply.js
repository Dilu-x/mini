// plugins/autoreply.js — Visual Auto-Reply System with Image + Premium Footer
const { cmd } = require('../command');
const { initEnvsettings, getSetting, isUserLoaded } = require('../settings');
const { getBuffer } = require('../lib/functions');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(require('@ffmpeg-installer/ffmpeg').path);

function convertToWebp(inputBuffer) {
  const tmpIn = `/tmp/stk_in_${Date.now()}.jpg`;
  const tmpOut = `/tmp/stk_out_${Date.now()}.webp`;
  fs.writeFileSync(tmpIn, inputBuffer);
  return new Promise((resolve, reject) => {
    ffmpeg(tmpIn)
      .output(tmpOut)
      .videoCodec('libwebp')
      .outputOptions(['-lossless', '1', '-q:v', '70', '-loop', '0', '-an', '-vsync', '0'])
      .on('end', () => {
        const buf = fs.readFileSync(tmpOut);
        try { fs.unlinkSync(tmpIn); } catch (e) {}
        try { fs.unlinkSync(tmpOut); } catch (e) {}
        resolve(buf);
      })
      .on('error', (err) => {
        try { fs.unlinkSync(tmpIn); } catch (e) {}
        try { fs.unlinkSync(tmpOut); } catch (e) {}
        reject(err);
      })
      .run();
  });
}

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
console.log(`[AUTO REPLY] Loaded ${Object.keys(autoreplyData).length} triggers`);

async function ensureLoaded(userId) {
  if (!isUserLoaded(userId)) await initEnvsettings(userId);
}

cmd({
  on: "body",
  dontAddCommandList: true,
  filename: __filename
}, async (conn, mek, m, { sender, body, from, reply, isGroup }) => {
  try {
    console.log(`[AUTO REPLY] body="${(body||'').slice(0,50)}" fromMe=${mek.key?.fromMe} sender=${sender}`);
    if (!body) return;
    if (mek.key?.fromMe) return;
    if (isGroup) return;

    const userMsg = body.toLowerCase().trim();
    if (userMsg === '0') return;

    const ownerJid = (config.OWNER_NUMBERS?.[0] || config.OWNER_NUMBER || '94788724423') + '@s.whatsapp.net';
    await ensureLoaded(ownerJid);

    const autoReplySetting = getSetting(ownerJid, 'AUTO_REPLY');
    if (autoReplySetting !== 'on') return;

    const triggers = Object.keys(autoreplyData);
    const lowerMsg = userMsg;
    for (const trigger of triggers) {
      if (lowerMsg.includes(trigger.toLowerCase())) {
        console.log(`[AUTO REPLY] Match: "${trigger}" → sending response`);
        let response = autoreplyData[trigger];

        // 🔁 Replace dynamic placeholders (Time & Date)
        response = response
          .replace(/\$\{new Date\(\)\.toLocaleTimeString\(\)\}/g, new Date().toLocaleTimeString())
          .replace(/\$\{new Date\(\)\.toLocaleDateString\(\)\}/g, new Date().toLocaleDateString());

        // இறுதி மெசேஜுடன் பிரீமியம் ஃபூட்டரை இணைக்கிறோம்

        // கஸ்டம் இமேஜ் + கேப்ஷன் ரிப்ளை லுக் 
        try {
          const imgBuf = await getBuffer(AUTOREPLY_IMG_URL);
          const webpBuf = await convertToWebp(imgBuf);
          // Send sticker first, then caption text
          await conn.sendMessage(from, { sticker: webpBuf }, { quoted: mek });
          await conn.sendMessage(from, { text: response }, { quoted: mek });
        } catch (imgErr) {
          // இமேஜ் லோட் ஆகவில்லை என்றால் மட்டும் நார்மல் டெக்ஸ்டாக மாறும்
          await conn.sendMessage(from, { text: response }, { quoted: mek });
        }
        return; // ட்ரிகர் மேட்ச் ஆகி மெசேஜ் அனுப்பப்பட்டதும் லூப்பை நிறுத்தவும்
      }
    }
  } catch (e) {
    console.error('[AUTO REPLY ERROR]', e);
  }
});
