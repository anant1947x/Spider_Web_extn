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
  enabledSites: {},           // { hostname: boolean }
  globalEnabled: true
};

// ── Install / Update ──────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const existing = await chrome.storage.local.get('settings');
    if (!existing.settings) {
      await chrome.storage.local.set({ settings: DEFAULT_SETTINGS, visitHistory: {} });
    }
  }
});

// ── Visit Tracking ────────────────────────────────────────────
// IMPORTANT: We must NOT overwrite the timestamp if the site is stale,
// otherwise the content script will never see it as stale.
// Only record first visits and refresh timestamps for fresh (non-stale) sites.

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  // Only track http/https pages
  try {
    const url = new URL(tab.url);
    if (!['http:', 'https:'].includes(url.protocol)) return;

    const hostname = url.hostname;
    const data = await chrome.storage.local.get(['visitHistory', 'settings']);
    const history = data.visitHistory || {};
    const settings = data.settings || DEFAULT_SETTINGS;

    const lastVisit = history[hostname];

    if (!lastVisit) {
      // First visit ever — record it
      history[hostname] = Date.now();
      await chrome.storage.local.set({ visitHistory: history });
    } else {
      // Check if the site is stale
      const daysSince = (Date.now() - lastVisit) / (1000 * 60 * 60 * 24);
      const isStale = daysSince >= (settings.inactivityDays || 7);

      if (!isStale) {
        // Site is fresh — update the timestamp to track continued visits
        history[hostname] = Date.now();
        await chrome.storage.local.set({ visitHistory: history });
      }
      // If stale → DON'T update timestamp.
      // Content script will show webs/dust, and MARK_CLEANED will update when user cleans.
    }
  } catch (e) {
    // Ignore invalid URLs
  }
});

// ── Message Handling ──────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // async response
});

async function handleMessage(message, sender) {
  const { type, payload } = message;

  switch (type) {
    case 'GET_SITE_STATUS': {
      const hostname = payload.hostname;
      const data = await chrome.storage.local.get(['visitHistory', 'settings']);
      const settings = data.settings || DEFAULT_SETTINGS;
      const history = data.visitHistory || {};

      if (!settings.globalEnabled) {
        return { active: false, reason: 'disabled' };
      }

      // Check per-site override
      if (settings.enabledSites[hostname] === false) {
        return { active: false, reason: 'site_disabled' };
      }

      const lastVisit = history[hostname];
      if (!lastVisit) {
        // First visit ever — record it, no webs
        history[hostname] = Date.now();
        await chrome.storage.local.set({ visitHistory: history });
        return { active: false, reason: 'first_visit' };
      }

      const daysSinceVisit = (Date.now() - lastVisit) / (1000 * 60 * 60 * 24);
      const isStale = daysSinceVisit >= settings.inactivityDays;

      if (!isStale) {
        // Fresh site — update the timestamp to track this visit
        history[hostname] = Date.now();
        await chrome.storage.local.set({ visitHistory: history });
      }

      return {
        active: isStale,
        daysSinceVisit: Math.floor(daysSinceVisit),
        threshold: settings.inactivityDays,
        settings: settings,
        reason: isStale ? 'stale' : 'fresh'
      };
    }

    case 'MARK_CLEANED': {
      const hostname = payload.hostname;
      const data = await chrome.storage.local.get('visitHistory');
      const history = data.visitHistory || {};
      history[hostname] = Date.now();
      await chrome.storage.local.set({ visitHistory: history });
      return { success: true };
    }

    case 'GET_SETTINGS': {
      const data = await chrome.storage.local.get('settings');
      return { settings: data.settings || DEFAULT_SETTINGS };
    }

    case 'UPDATE_SETTINGS': {
      const data = await chrome.storage.local.get('settings');
      const current = data.settings || DEFAULT_SETTINGS;
      const updated = { ...current, ...payload };
      await chrome.storage.local.set({ settings: updated });
      return { success: true, settings: updated };
    }

    case 'GET_ALL_SITES': {
      const data = await chrome.storage.local.get(['visitHistory', 'settings']);
      const history = data.visitHistory || {};
      const settings = data.settings || DEFAULT_SETTINGS;

      const sites = Object.entries(history).map(([hostname, lastVisit]) => {
        const daysSince = Math.floor((Date.now() - lastVisit) / (1000 * 60 * 60 * 24));
        return {
          hostname,
          lastVisit,
          lastVisitDate: new Date(lastVisit).toLocaleDateString(),
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
