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
    MODE:             "public",
    AUTO_RECORDING:   "off",
    AUTO_VIEW_STATUS: "off",
    STATUS_REACT:     "off",
    PREFIX:           ".",
    ANTI_CALL:        "on",
    ANTI_DELETE:      "on",
    ANTI_EDIT:        "off",
    PRESENCE_TYPE:    "on",
    WELCOME:          "off",
    AUTO_REPLY:       "off",
    AUTO_REACT:       "off",
    CUSTOM_SONG_FOOTER: '▫️🎵 Check out this group for more songs!',
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
