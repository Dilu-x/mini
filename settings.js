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
    'MODE':             'public',  // public | private
    'AUTO_VIEW_STATUS': 'off',
    'AUTO_LIKE_STATUS': 'off',
    'AUTO_RECORDING':   'off',
    'AUTO_REACT':       'off',   // off | any emoji e.g. 😂
    'PREFIX':           '.',     // any symbol: / . ! # $ etc
    'ANTI_CALL':        'on',    // on | off
    'ANTI_DELETE':      'on',    // on | off | inbox | same
    'ANTI_EDIT':        'off',   // on | off
    'PRESENCE_TYPE':    'on',
    'PRESENCE_FAKE':    'both',
    'AUTO_REPLY': 'off',  // 'on' or 'off'
    'STATUS_REACT':     '❤️',   // off | any emoji
    'ANTI_FAKE':        'off',
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
