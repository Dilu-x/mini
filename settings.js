// settings.js — Per-user settings cache
const { getAllUserEnv, updateUserEnv, initUserEnvIfMissing } = require('./settingsdb');
const config = require('./config');

// Map: userId -> { KEY: value }
const userCache = new Map();

async function initEnvsettings(userId) {
  await initUserEnvIfMissing(userId);
  const data = await getAllUserEnv(userId);
  userCache.set(userId, data);
  console.log(`⚙️ Settings loaded: ${userId}`);
}

const settingDefaults = {
    'MODE':             'public',
    'AUTO_RECORDING':   'off',
    'AUTO_VIEW_STATUS': 'off',
    'STATUS_REACT':     'off',
    'PREFIX':           '.',
    'ANTI_CALL':        'on',
    'ANTI_DELETE':      'on',
    'ANTI_EDIT':        'off',
    'AUTO_REACT':       'off',
    'CUSTOM_SONG_FOOTER': '▫️🎵 Check out this group for more songs!',
    'PRESENCE_TYPE':    'on',
    'AUTO_REPLY':       'off',
    'WELCOME':          'off',
    'GOODBYE':          'off'
};

function getSetting(userId, key) {
  const env = userCache.get(userId);
  const defaultValue = settingDefaults[key] || 'off';
  if (!env) return defaultValue;
  return env.hasOwnProperty(key) ? env[key] : defaultValue;
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
