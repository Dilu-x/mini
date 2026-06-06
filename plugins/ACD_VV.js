// plugins/vv.js — Anti View-Once Media Extractor with Premium Footer & Custom Image Support
const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');

// ── Image Configurations (உங்களுக்கு தேவையான இමේஜ் லிங்குகளை இங்கே மாற்றி அமைத்துக் கொள்ளுங்கள்) ──
const VV_IMAGES = {
  success: 'https://shyra.edgeone.app/bot-img.jpg', // மீடியா வெற்றிகரமாக அனுப்பப்படும் போது வரும் இமேஜ்
  error:   'https://shyra.edgeone.app/bot-img.jpg', // எரர் அல்லது வியூ-ஒன்ஸ் இல்லை என்றால் வரும் இமேஜ்
  other:   'https://shyra.edgeone.app/bot-img.jpg'  // Default fallback
};

// ── Global Footer Content ────────────────────────────────────────
const GLOBAL_FOOTER = `\n╭─────𓆩★𓆪──────╮\n> ㋛ Ⲣ૦𝚅𝞔Ꮢ𝞔Ｄ 𝗕Ⲩ ＤƖ𐐛𝘚Η𝔸∇\n╰─────𓆩★𓆪──────╯`;

cmd({
    pattern: "vv",
    alias: ["viewonce", "antiviewonce", "unview"],
    desc: "Remove view-once flag from replied media",
    category: "tools",
    react: "👀",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        // 1. Quoted message இருக்கான்னு செக் பண்றோம்
        if (!m.quoted) {
            let errMsg = `❌ *Reply to a view‑once image or video!*\n` + GLOBAL_FOOTER;
            try {
                const imgBuf = await getBuffer(VV_IMAGES['error']);
                return await conn.sendMessage(from, { image: imgBuf, caption: errMsg }, { quoted: mek });
            } catch {
                return reply(errMsg);
            }
        }

        // 2. View Once மெசேஜ் ஸ்ட்ரக்சரை துல்லியமாக கண்டறிகிறோம்
        let msg = m.quoted.message;
        let type = Object.keys(msg)[0];

        if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
            msg = msg[type].message;
            type = Object.keys(msg)[0];
        } else if (msg?.ephemeralMessage?.message) {
            msg = msg.ephemeralMessage.message;
            type = Object.keys(msg)[0];
            if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
                msg = msg[type].message;
                type = Object.keys(msg)[0];
            }
        } else {
            // வியூ-ஒன்ஸ் இல்லை என்றால் எரர் காட்டும்
            let notVvMsg = `❌ *That's not a view‑once message.*\n` + GLOBAL_FOOTER;
            try {
                const imgBuf = await getBuffer(VV_IMAGES['error']);
                return await conn.sendMessage(from, { image: imgBuf, caption: notVvMsg }, { quoted: mek });
            } catch {
                return reply(notVvMsg);
            }
        }

        // 3. உள்ளே இருப்பது இமேஜ் அல்லது வீடியோவா என்று பார்க்கிறோம்
        if (type !== 'imageMessage' && type !== 'videoMessage') {
            let badTypeMsg = `❌ *Unsupported view-once type! Reply only to image or video.*\n` + GLOBAL_FOOTER;
            try {
                const imgBuf = await getBuffer(VV_IMAGES['error']);
                return await conn.sendMessage(from, { image: imgBuf, caption: badTypeMsg }, { quoted: mek });
            } catch {
                return reply(badTypeMsg);
            }
        }

        // 4. மீடியாவில் இருக்கும் viewOnce ஃபிளாக்கை நீக்குகிறோம்
        msg[type].viewOnce = false;

        // 5. மெசேஜை Read செய்ததாக மாற்றிவிட்டு, பார்வேர்ட் செய்கிறோம்
        await conn.readMessages([m.quoted.key]);
        
        let successText = `✅ *View‑once removed successfully!*\n` + GLOBAL_FOOTER;
        
        // மீடியாவுடன் சேர்த்து உங்களுடைய பிரீமியம் ஃபூட்டரையும் கேப்ஷனாக அனுப்புகிறோம்
        await conn.sendMessage(from, {
            forward: {
                key: m.quoted.key,
                message: { [type]: msg[type] }
            },
            caption: successText
        }, { quoted: mek });

    } catch (e) {
        console.error('[VV ERROR]', e);
        let failMsg = `❌ *Failed to remove view‑once. Maybe unsupported media.*\n` + GLOBAL_FOOTER;
        try {
            const imgBuf = await getBuffer(VV_IMAGES['error']);
            await conn.sendMessage(from, { image: imgBuf, caption: failMsg }, { quoted: mek });
        } catch {
            reply(failMsg);
        }
    }
});
