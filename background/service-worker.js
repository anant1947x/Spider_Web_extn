/* ============================================================
   Spider Web & Dust — Background Service Worker
   Tracks site visits, calculates staleness, manages settings.
   ============================================================ */

const DEFAULT_SETTINGS = {
  inactivityDays: 7,
  webDensity: 'medium',       // low | medium | high | extreme
  dustIntensity: 'medium',    // low | medium | high
  animationSpeed: 1.0,        // 0.5 – 2.0
  dusterStyle: 'classic',     // classic | feather | vacuum | magic
  soundEnabled: true,
  soundVolume: 0.5,
  theme: 'auto',              // light | dark | auto
  particleColor: '#b8b8b8',
  webColor: '#e0e0e0',
  cleaningMode: 'both',       // manual | auto | both
  spiderEnabled: true,
  enabledSites: {},           // { hostname: boolean }
  globalEnabled: true
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Older installations can be missing newer keys (such as spiderEnabled).
// Merge defaults at every read so they remain usable without discarding a
// user's existing choices, including a deliberately stored inactivityDays: 0.
function normalizeSettings(storedSettings) {
  const stored = isPlainObject(storedSettings) ? storedSettings : {};
  const enabledSites = isPlainObject(stored.enabledSites) ? stored.enabledSites : {};
  const inactivity = Number(stored.inactivityDays);
  const animationSpeed = Number(stored.animationSpeed);
  const soundVolume = Number(stored.soundVolume);
  const validDensity = ['low', 'medium', 'high', 'extreme'];
  const validDust = ['low', 'medium', 'high'];
  const validTheme = ['light', 'dark', 'auto'];
  const validDuster = ['classic', 'feather', 'vacuum', 'magic'];
  const validCleaning = ['manual', 'auto', 'both'];
  const validColor = color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    inactivityDays: Number.isFinite(inactivity)
      ? Math.max(0, Math.min(90, Math.floor(inactivity)))
      : DEFAULT_SETTINGS.inactivityDays,
    webDensity: validDensity.includes(stored.webDensity) ? stored.webDensity : DEFAULT_SETTINGS.webDensity,
    dustIntensity: validDust.includes(stored.dustIntensity) ? stored.dustIntensity : DEFAULT_SETTINGS.dustIntensity,
    animationSpeed: Number.isFinite(animationSpeed)
      ? Math.max(0.5, Math.min(2, animationSpeed))
      : DEFAULT_SETTINGS.animationSpeed,
    dusterStyle: validDuster.includes(stored.dusterStyle) ? stored.dusterStyle : DEFAULT_SETTINGS.dusterStyle,
    soundVolume: Number.isFinite(soundVolume)
      ? Math.max(0, Math.min(1, soundVolume))
      : DEFAULT_SETTINGS.soundVolume,
    theme: validTheme.includes(stored.theme) ? stored.theme : DEFAULT_SETTINGS.theme,
    cleaningMode: validCleaning.includes(stored.cleaningMode) ? stored.cleaningMode : DEFAULT_SETTINGS.cleaningMode,
    particleColor: validColor(stored.particleColor) ? stored.particleColor : DEFAULT_SETTINGS.particleColor,
    webColor: validColor(stored.webColor) ? stored.webColor : DEFAULT_SETTINGS.webColor,
    spiderEnabled: stored.spiderEnabled !== false,
    globalEnabled: stored.globalEnabled !== false,
    enabledSites: { ...enabledSites }
  };
}

function settingsNeedMigration(storedSettings) {
  if (!isPlainObject(storedSettings) || !isPlainObject(storedSettings.enabledSites)) {
    return true;
  }

  return Object.keys(DEFAULT_SETTINGS).some(
    key => !(key in storedSettings) || storedSettings[key] === undefined
  );
}

function getHostname(payload) {
  if (!payload || typeof payload.hostname !== 'string') return '';
  return payload.hostname.trim().toLowerCase();
}

function getTabId(payload, sender) {
  if (Number.isInteger(sender?.tab?.id)) return sender.tab.id;
  return Number.isInteger(payload?.tabId) ? payload.tabId : null;
}

async function getActiveScene(tabId, hostname) {
  if (!Number.isInteger(tabId) || !chrome.storage.session) return null;
  try {
    const data = await chrome.storage.session.get('activeScenes');
    const scenes = isPlainObject(data.activeScenes) ? data.activeScenes : {};
    const scene = scenes[String(tabId)];
    if (!isPlainObject(scene) || scene.hostname !== hostname) return null;
    return scene;
  } catch {
    return null;
  }
}

async function setActiveScene(tabId, scene) {
  if (!Number.isInteger(tabId) || !chrome.storage.session) return;
  try {
    const data = await chrome.storage.session.get('activeScenes');
    const scenes = isPlainObject(data.activeScenes) ? data.activeScenes : {};
    scenes[String(tabId)] = scene;
    await chrome.storage.session.set({ activeScenes: scenes });
  } catch {
    // Scene state only improves popup continuity; core visit tracking remains
    // correct if session storage is unavailable.
  }
}

async function clearActiveScene(tabId, hostname = '') {
  if (!Number.isInteger(tabId) || !chrome.storage.session) return;
  try {
    const data = await chrome.storage.session.get('activeScenes');
    const scenes = isPlainObject(data.activeScenes) ? data.activeScenes : {};
    let changed = false;
    if (hostname) {
      Object.entries(scenes).forEach(([key, scene]) => {
        if (scene?.hostname === hostname) {
          delete scenes[key];
          changed = true;
        }
      });
    } else if (String(tabId) in scenes) {
      delete scenes[String(tabId)];
      changed = true;
    }
    if (!changed) return;
    await chrome.storage.session.set({ activeScenes: scenes });
  } catch {
    // Ignore optional session-state cleanup failures.
  }
}

// ── Install / Update ──────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(['settings', 'visitHistory']);
  const updates = {};

  if (settingsNeedMigration(existing.settings)) {
    updates.settings = normalizeSettings(existing.settings);
  }
  if (!isPlainObject(existing.visitHistory)) {
    updates.visitHistory = {};
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  clearActiveScene(tabId);
});

// ── Visit Tracking ────────────────────────────────────────────
// Content scripts explicitly opt into recording a completed page visit via
// GET_SITE_STATUS({ recordVisit: true }). That one request calculates the
// response from the *previous* timestamp before writing the new one. Popup
// and options-page status reads omit the flag, so they never change history.

// ── Message Handling ──────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // async response
});

async function handleMessage(message, sender) {
  const { type, payload = {} } = message || {};

  switch (type) {
    case 'GET_SITE_STATUS': {
      const hostname = getHostname(payload);
      const data = await chrome.storage.local.get(['visitHistory', 'settings']);
      const settings = normalizeSettings(data.settings);
      const history = isPlainObject(data.visitHistory) ? data.visitHistory : {};

      if (!hostname) {
        return {
          active: false,
          isStale: false,
          daysSinceVisit: 0,
          lastVisit: null,
          threshold: settings.inactivityDays,
          settings,
          reason: 'invalid_site'
        };
      }

      const tabId = getTabId(payload, sender);

      // Capture all status data before a possible visit write. This lets a
      // newly opened stale site render its effects even though the visit is
      // immediately recorded for subsequent page loads.
      const now = Date.now();
      const storedLastVisit = Number(history[hostname]);
      const hasPriorVisit = Number.isFinite(storedLastVisit) && storedLastVisit > 0;
      const elapsedMs = hasPriorVisit ? Math.max(0, now - storedLastVisit) : 0;
      const daysSinceVisit = Math.floor(elapsedMs / DAY_MS);
      const isStale = hasPriorVisit
        ? elapsedMs >= settings.inactivityDays * DAY_MS
        : settings.inactivityDays <= 0;

      let reason;
      if (!settings.globalEnabled) {
        reason = 'disabled';
      } else if (settings.enabledSites[hostname] === false) {
        reason = 'site_disabled';
      } else if (!hasPriorVisit) {
        reason = isStale ? 'stale' : 'first_visit';
      } else {
        reason = isStale ? 'stale' : 'fresh';
      }

      // A stale page records its fresh visit immediately after this check.
      // Keep the tab-scoped scene state so reopening the popup during that
      // same dusty page view still offers "Clean Now".
      const activeScene = await getActiveScene(tabId, hostname);
      if (reason !== 'disabled' && reason !== 'site_disabled' && activeScene) {
        return {
          active: true,
          isStale: true,
          daysSinceVisit: Number(activeScene.daysSinceVisit) || 0,
          lastVisit: Number(activeScene.lastVisit) || null,
          threshold: settings.inactivityDays,
          settings,
          reason: 'stale',
          sceneActive: true
        };
      }

      // Only the content-script page-load path opts into this write. It is
      // intentionally after the calculations above so the response reflects
      // the prior visit, not the timestamp we are about to save.
      if (payload.recordVisit === true && !activeScene) {
        history[hostname] = now;
        await chrome.storage.local.set({ visitHistory: history });
        if (reason === 'stale') {
          await setActiveScene(tabId, {
            hostname,
            daysSinceVisit,
            lastVisit: hasPriorVisit ? storedLastVisit : null,
            createdAt: now
          });
        }
      }

      return {
        active: reason === 'stale',
        isStale,
        daysSinceVisit,
        lastVisit: hasPriorVisit ? storedLastVisit : null,
        threshold: settings.inactivityDays,
        settings,
        reason
      };
    }

    case 'MARK_CLEANED': {
      const hostname = getHostname(payload);
      if (!hostname) return { success: false, error: 'Invalid hostname' };

      const data = await chrome.storage.local.get('visitHistory');
      const history = isPlainObject(data.visitHistory) ? data.visitHistory : {};
      history[hostname] = Date.now();
      await chrome.storage.local.set({ visitHistory: history });
      await clearActiveScene(getTabId(payload, sender), hostname);
      return { success: true };
    }

    case 'GET_SETTINGS': {
      const data = await chrome.storage.local.get('settings');
      return { settings: normalizeSettings(data.settings) };
    }

    case 'UPDATE_SETTINGS': {
      const data = await chrome.storage.local.get('settings');
      const current = normalizeSettings(data.settings);
      const updates = isPlainObject(payload) ? payload : {};
      const updated = normalizeSettings({ ...current, ...updates });
      await chrome.storage.local.set({ settings: updated });
      return { success: true, settings: updated };
    }

    case 'GET_ALL_SITES': {
      const data = await chrome.storage.local.get(['visitHistory', 'settings']);
      const history = isPlainObject(data.visitHistory) ? data.visitHistory : {};
      const settings = normalizeSettings(data.settings);

      const sites = Object.entries(history).flatMap(([hostname, lastVisit]) => {
        const timestamp = Number(lastVisit);
        if (!Number.isFinite(timestamp) || timestamp <= 0) return [];

        const daysSince = Math.floor(Math.max(0, Date.now() - timestamp) / DAY_MS);
        return {
          hostname,
          lastVisit: timestamp,
          lastVisitDate: new Date(timestamp).toLocaleDateString(),
          daysSince,
          isStale: daysSince >= settings.inactivityDays,
          enabled: settings.enabledSites[hostname] !== false
        };
      });

      sites.sort((a, b) => b.daysSince - a.daysSince);
      return { sites };
    }

    case 'RESET_SETTINGS': {
      await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
      return { success: true, settings: DEFAULT_SETTINGS };
    }

    case 'CLEAR_HISTORY': {
      await chrome.storage.local.set({ visitHistory: {} });
      return { success: true };
    }

    case 'TRIGGER_CLEAN': {
      // Send message to the content script of the specified tab
      if (payload.tabId) {
        try {
          await chrome.tabs.sendMessage(payload.tabId, { type: 'FORCE_CLEAN' });
        } catch (e) {
          // Tab might not have content script
        }
      }
      return { success: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}
