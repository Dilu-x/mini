// settings.js — Per-user settings cache
const { getAllUserEnv, updateUserEnv, initUserEnvIfMissing } = require('./settingsdb');

// Map: userId -> { KEY: value }
const userCache = new Map();

async function initEnvsettings(userId) {
  await initUserEnvIfMissing(userId);
  const data = await getAllUserEnv(userId);
  userCache.set(userId, data);
  console.log(`⚙️ Settings loaded: ${userId}`);
}

function getSetting(userId, key) {
  const env = userCache.get(userId);
  if (!env) return 'off';
  return env[key] ?? 'off';
}

async function setSetting(userId, key, value) {
  if (!userCache.has(userId)) userCache.set(userId, {});
  userCache.get(userId)[key] = value;
  await updateUserEnv(key, value, userId);
}

async function toggleSetting(userId, key) {
  const cur = getSetting(userId, key);
  const next = (cur === 'on') ? 'off' : 'on';
  await setSetting(userId, key, next);
  return next;
}

function getFullSettings(userId) {
  return userCache.get(userId) || {};
}

function isUserLoaded(userId) {
  return userCache.has(userId);
}

module.exports = { initEnvsettings, getSetting, setSetting, toggleSetting, getFullSettings, isUserLoaded };
