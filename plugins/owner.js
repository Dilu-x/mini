const { cmd } = require('../command');
const config = require('../config');   // make sure OWNER_NUMBER & OWNER_NAME are defined here

cmd({
    pattern: "owner",
    react: "✅",
    desc: "Get owner contact",
    category: "main",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const ownerNumber = config.OWNER_NUMBER;
        const ownerName = config.OWNER_NAME;

        await reply(`👑 *Owner:* ${ownerName}\n📞 *Number:* ${ownerNumber}`);

        const vcard = 'BEGIN:VCARD\n' +
                      'VERSION:3.0\n' +
                      `FN:${ownerName}\n` +
                      `TEL;type=CELL;type=VOICE;waid=${ownerNumber.replace('+', '')}:${ownerNumber}\n` +
                      'END:VCARD';

        await conn.sendMessage(from, {
            contacts: {
                displayName: ownerName,
                contacts: [{ vcard }]
            }
        });
    } catch (error) {
        console.error(error);
        reply(`❌ Error: ${error.message}`);
    }
});