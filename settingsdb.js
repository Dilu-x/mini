// settingsdb.js
const axios = require('axios');

const BASE_URL = 'https://shitsu-base-default-rtdb.asia-southeast1.firebasedatabase.app';

function firebaseKey(x) {
  // Firebase keys cannot contain . # $ [ ] / and other special chars.
  // Replace any non-alphanumeric, non-underscore, non-dash with underscore.
  return String(x).replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function updateUserEnv(key, value, userId) {
  if (!userId) throw new Error("User ID missing");
  const uid = firebaseKey(userId);
  const k = firebaseKey(key);
  const res = await axios.put(`${BASE_URL}/${uid}/${k}.json`, JSON.stringify(value), {
    headers: { 'Content-Type': 'application/json' }
  });
  return res.data;
}

async function getUserEnv(key, userId) {
  if (!userId) throw new Error("User ID missing");
  const uid = firebaseKey(userId);
  const k = firebaseKey(key);
  const res = await axios.get(`${BASE_URL}/${uid}/${k}.json`);
  return res.data;
}

async function getAllUserEnv(userId) {
  if (!userId) throw new Error("User ID missing");
  const uid = firebaseKey(userId);
  const res = await axios.get(`${BASE_URL}/${uid}.json`);
  return res.data || {};
}

async function initUserEnvIfMissing(userId) {
  if (!userId) { console.error("❌ User ID is missing"); return; }

  const defaults = {
    MODE:             "public",  // public | private
    AUTO_VIEW_STATUS: "off",
    AUTO_LIKE_STATUS: "off",
    AUTO_RECORDING:   "off",
    AUTO_REACT:       "off",   // off | any emoji e.g. 😂
    PREFIX:           ".",     // any symbol: / . ! # $ etc
    ANTI_CALL:        "on",    // on | off
    ANTI_DELETE:      "on",    // on | off | inbox | same
    ANTI_EDIT:        "off",   // on | off
    PRESENCE_TYPE:    "on",
    PRESENCE_FAKE:    "both",
    STATUS_REACT:     "❤️",   // off | any emoji
    ANTI_FAKE:        "off",
    WELCOME:          "off",
    AUTO_REPLY: "off",
    GOODBYE:          "off",
    CREATE_NB:        userId
  };

  for (const key in defaults) {
    let current = null;
    try {
      current = await getUserEnv(key, userId);
    } catch (e) {
      console.error(`getUserEnv failed for ${userId} ${key}:`, e?.message || e);
      current = null;
    }
    if (current === null || current === undefined) {
      try {
        await updateUserEnv(key, defaults[key], userId);
        console.log(`✅ Init [${userId}] ${key} = ${defaults[key]}`);
      } catch (e) {
        console.error(`Failed to write default for ${userId} ${key}:`, e?.message || e);
      }
    }
  }
}

module.exports = { updateUserEnv, getUserEnv, getAllUserEnv, initUserEnvIfMissing };
