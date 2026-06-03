const { cmd } = require('../command');

// ────────────── COMPATIBILITY ──────────────
cmd({
  pattern: "compatibility",
  alias: ["friend", "fcheck"],
  desc: "Calculate compatibility score between two users",
  category: "fun",
  react: "💖",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    if (!m.mentionedJid || m.mentionedJid.length < 2) {
      return reply("Please mention two users.\nUsage: `.compatibility @user1 @user2`");
    }
    let user1 = m.mentionedJid[0];
    let user2 = m.mentionedJid[1];

    const specialNumber = global.config?.DEV ? `${global.config.DEV}@s.whatsapp.net` : null;
    let score = Math.floor(Math.random() * 1000) + 1;
    if (user1 === specialNumber || user2 === specialNumber) score = 1000;

    reply(`💖 Compatibility between @${user1.split('@')[0]} and @${user2.split('@')[0]}: ${score}/1000 💖`, { mentions: [user1, user2] });
  } catch (e) {
    reply(`❌ Error: ${e.message}`);
  }
});

// ────────────── AURA ──────────────────────────
cmd({
  pattern: "aura",
  desc: "Calculate aura score of a user",
  category: "fun",
  react: "💀",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    let user = m.mentionedJid?.[0] || (m.quoted?.sender);
    if (!user) return reply("Please mention or reply to a user.\nUsage: `.aura @user`");
    const specialNumber = global.config?.DEV ? `${global.config.DEV}@s.whatsapp.net` : null;
    let score = (user === specialNumber) ? 999999 : Math.floor(Math.random() * 1000) + 1;
    reply(`💀 Aura of @${user.split('@')[0]}: ${score}/1000 🗿`, { mentions: [user] });
  } catch (e) {
    reply(`❌ Error: ${e.message}`);
  }
});

// ────────────── ROAST ────────────────────────
cmd({
  pattern: "roast",
  desc: "Roast someone 🔥",
  category: "fun",
  react: "🔥",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  let roasts = [
    "Bro, your IQ is lower than a weak WiFi signal!",
    "Dude, your thoughts are like WhatsApp status — disappear after 24 hours!",
    "Why do you think so much? Are you a NASA scientist or what?",
    "Who even are you? Even Google can’t find your name!",
    "Is your brain running on 2G network?",
    "Stop overthinking, bro — your battery will drain fast!",
    "Your thoughts are like a cricket match — stop working when it rains!",
    "You're a VIP — Very Idiotic Person!",
    "Bro, your IQ is weaker than a WiFi signal!",
    "Your thinking is like a WhatsApp status — gone in 24 hours!",
    "Which planet are you from? This world isn’t made for aliens like you!",
    "Your brain seems full, but there's never a result!",
    "Your life is like a WhatsApp status — can be deleted anytime!",
    "Your style is like a WiFi password — no one knows it!",
    "You’re the one who Googles their own life plot twists!",
    "You can’t even run a software update — you're completely lagging!",
    "Thinking with you is slower than a Google search on 2G!",
    "I'm not out of words, just wasn’t in the mood to roast you!",
    "Your personality is like a dead battery — time for a recharge!",
    "Your thinking deserves its own server!",
    "What game are you playing that you keep failing at?",
    "Your jokes are like software updates — keep popping up but never work!",
    "Because of you, even my phone’s storage is full!",
    "You’ve literally become a walking meme!",
    "You think you’re smart, but your brain cells are overloaded!",
    "You made us consider muting the group chat!",
    "People like you always think they’re heroes — but you're actually the villain!",
    "People like you need a rewind and fast-forward button in life!",
    "Every word from your mouth is a new bug!",
    "You couldn't save your own life, but you give advice to others!",
    "You're the biggest virus in your own life!",
    "Are you even human or just a broken app?",
    "Your thoughts need a CPU, but I think yours is dead!",
    "What are you doing — turning into a walking error message?",
    "Your compliments feel fake — everyone knows your real worth!",
    "Your brain is like a broken link — no matter how hard we search, nothing shows up!",
    "Looking at you feels like Netflix crashed because of you!",
    "Your photo is just a screenshot — in real life, you're nothing!",
    "You look like an iPhone, but inside, you're running old Android!",
    "Even Google must hate thoughts like yours!",
    "Use your face to set the mood — maybe someone will notice you!",
    "Your work is like an app that crashes when everyone needs it!",
    "The biggest hack in your life is: 'Don’t expect anything from me!'",
    "You look in the mirror and think everything’s okay!",
    "You’re operating your brain in low power mode!",
    "You have ideas — all as outdated as Windows XP!",
    "Your thinking is like a system error — needs a restart!",
    "Your personality is like an empty hard drive — nothing valuable!",
    "Which planet are you from? This world isn’t for people like you!",
    "Your face says ‘loading’ — but it never completes!",
    "Your brain is like a broken link — never connects!",
    "Even Google’s algorithm gets confused by your logic!",
    "Someone like you with such ideas? I’ve only seen that in sci-fi!",
    "You should get 'Not Found' tattooed on your face — no one finds anything from you!",
    "Your mind is so slow, even Google can’t help you!",
    "You’re a living example of ‘404 Not Found’!",
    "Your brain is like a phone battery — always drained!",
    "You're that guy who forgets his life password!",
    "What you call thinking is actually buffering!",
    "Your decisions are so confusing, even the KBC host would give up!",
    "People like you deserve a dedicated 'Error' page!",
    "Your life received a 'User Not Found' message!",
    "Your words have as much value as a 90s phone camera!",
    "You're always under construction, bro!",
    "Your life has an unknown error — no solution found!",
    "Your face should have a warning sign: ‘Caution: Too Much Stupidity Ahead!’",
    "Every time you speak, it feels like a system crash is near!",
    "You have an idea, but it's still ‘under review’!"
  ];
  let randomRoast = roasts[Math.floor(Math.random() * roasts.length)];
  let mentionedUser = m.mentionedJid?.[0] || (m.quoted?.sender);
  if (!mentionedUser) return reply("Usage: .roast @user (Tag someone to roast them!)");
  let target = `@${mentionedUser.split("@")[0]}`;
  let msg = `${target} :\n *${randomRoast}*\n> This is all for fun, don't take it seriously!`;
  conn.sendMessage(m.chat, { text: msg, mentions: [m.sender, mentionedUser] }, { quoted: mek });
});

// ────────────── 8BALL ───────────────────────
cmd({
  pattern: "8ball",
  desc: "Magic 8-Ball answers",
  category: "fun",
  react: "🎱",
  filename: __filename
}, async (conn, mek, m, { q, reply }) => {
  if (!q) return reply("Ask a yes/no question! Example: .8ball Will I be rich?");
  let responses = [
    "Yes!", "No.", "Maybe...", "Definitely!", "Not sure.",
    "Ask again later.", "I don't think so.", "Absolutely!",
    "No way!", "Looks promising!"
  ];
  let answer = responses[Math.floor(Math.random() * responses.length)];
  reply(`🎱 *Magic 8-Ball says:* ${answer}`);
});

// ────────────── COMPLIMENT ─────────────────
cmd({
  pattern: "compliment",
  desc: "Give a nice compliment",
  category: "fun",
  react: "😊",
  filename: __filename
}, async (conn, mek, m, { reply }) => {
  let compliments = [
    "You're amazing just the way you are! 💖",
    "You light up every room you walk into! 🌟",
    "Your smile is contagious! 😊",
    "You're a genius in your own way! 🧠",
    "You bring happiness to everyone around you! 🥰",
    "You're like a human sunshine! ☀️",
    "Your kindness makes the world a better place! ❤️",
    "You're unique and irreplaceable! ✨",
    "You're a great listener and a wonderful friend! 🤗",
    "Your positive vibes are truly inspiring! 💫",
    "You're stronger than you think! 💪",
    "Your creativity is beyond amazing! 🎨",
    "You make life more fun and interesting! 🎉",
    "Your energy is uplifting to everyone around you! 🔥",
    "You're a true leader, even if you don’t realize it! 🏆",
    "Your words have the power to make people smile! 😊",
    "You're so talented, and the world needs your skills! 🎭",
    "You're a walking masterpiece of awesomeness! 🎨",
    "You're proof that kindness still exists in the world! 💕",
    "You make even the hardest days feel a little brighter! ☀️"
  ];
  let randomCompliment = compliments[Math.floor(Math.random() * compliments.length)];
  let sender = `@${m.sender.split("@")[0]}`;
  let mentionedUser = m.mentionedJid?.[0] || (m.quoted?.sender);
  let target = mentionedUser ? `@${mentionedUser.split("@")[0]}` : "";
  let message = mentionedUser
    ? `${sender} complimented ${target}:\n😊 *${randomCompliment}*`
    : `${sender}, you forgot to tag someone! But hey, here's a compliment for you:\n😊 *${randomCompliment}*`;
  conn.sendMessage(m.chat, { text: message, mentions: [m.sender, mentionedUser].filter(Boolean) }, { quoted: mek });
});

// ────────────── LOVETEST ───────────────────
cmd({
  pattern: "lovetest",
  desc: "Check love compatibility between two users",
  category: "fun",
  react: "❤️",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  if (!m.mentionedJid || m.mentionedJid.length < 2)
    return reply("Tag two users! Example: .lovetest @user1 @user2");
  let user1 = m.mentionedJid[0];
  let user2 = m.mentionedJid[1];
  let lovePercent = Math.floor(Math.random() * 100) + 1;
  let messages = [
    { range: [90, 100], text: "💖 *A match made in heaven!* True love exists!" },
    { range: [75, 89], text: "😍 *Strong connection!* This love is deep and meaningful." },
    { range: [50, 74], text: "😊 *Good compatibility!* You both can make it work." },
    { range: [30, 49], text: "🤔 *It’s complicated!* Needs effort, but possible!" },
    { range: [10, 29], text: "😅 *Not the best match!* Maybe try being just friends?" },
    { range: [1, 9], text: "💔 *Uh-oh!* This love is as real as a Bollywood breakup!" }
  ];
  let loveMessage = messages.find(m => lovePercent >= m.range[0] && lovePercent <= m.range[1]).text;
  let text = `💘 *Love Compatibility Test* 💘\n\n❤️ *@${user1.split("@")[0]}* + *@${user2.split("@")[0]}* = *${lovePercent}%*\n${loveMessage}`;
  conn.sendMessage(m.chat, { text, mentions: [user1, user2] }, { quoted: mek });
});

// ────────────── EMOJI TEXT ─────────────────
cmd({
  pattern: "emoji",
  desc: "Convert text into emoji letters",
  category: "fun",
  react: "🙂",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    let text = args.join(" ");
    if (!text) return reply("Please provide some text to convert!");
    let emojiMapping = {
      "a": "🅰️", "b": "🅱️", "c": "🇨️", "d": "🇩️", "e": "🇪️",
      "f": "🇫️", "g": "🇬️", "h": "🇭️", "i": "🇮️", "j": "🇯️",
      "k": "🇰️", "l": "🇱️", "m": "🇲️", "n": "🇳️", "o": "🅾️",
      "p": "🇵️", "q": "🇶️", "r": "🇷️", "s": "🇸️", "t": "🇹️",
      "u": "🇺️", "v": "🇻️", "w": "🇼️", "x": "🇽️", "y": "🇾️",
      "z": "🇿️",
      "0": "0️⃣", "1": "1️⃣", "2": "2️⃣", "3": "3️⃣", "4": "4️⃣",
      "5": "5️⃣", "6": "6️⃣", "7": "7️⃣", "8": "8️⃣", "9": "9️⃣",
      " ": "␣"
    };
    let emojiText = text.toLowerCase().split("").map(c => emojiMapping[c] || c).join("");
    conn.sendMessage(m.chat, { text: emojiText }, { quoted: mek });
  } catch (e) {
    reply(`Error: ${e.message}`);
  }
});