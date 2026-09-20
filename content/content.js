/* ============================================================
   Spider Web & Dust — Content Script Entry Point
   Builds one layered, cleanable abandoned-room scene per site.
   ============================================================ */

(function () {
  'use strict';

  if (window.__spiderWebInitialized) return;
  window.__spiderWebInitialized = true;

  const url = window.location.href;
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
      url.startsWith('about:') || url.startsWith('edge://')) {
    return;
  }

  const hostname = window.location.hostname;
  if (!hostname) return;

  let overlay = null;
  let webRenderer = null;
  let dustSystem = null;
  let spiderRenderer = null;
  let soundManager = null;
  let dusterEngine = null;
  let lastDaysSinceVisit = 0;
  let isInitializing = false;

  function parseColor(color) {
    const match = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
  }

  function detectPageTheme() {
    const body = document.body;
    const html = document.documentElement;
    if (!body) return { isDark: false, luminance: 245 };

    const bodyStyle = window.getComputedStyle(body);
    const bodyColor = parseColor(bodyStyle.backgroundColor);
    const htmlColor = parseColor(window.getComputedStyle(html).backgroundColor);
    const transparentBody = bodyStyle.backgroundColor.includes('0, 0, 0, 0');
    const color = (!bodyColor || transparentBody) ? htmlColor : bodyColor;

    if (!color) return { isDark: false, luminance: 245 };
    const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
    return { isDark: luminance < 128, luminance, bgColor: color };
  }

  function getAdaptiveColors(settings) {
    const detected = detectPageTheme();
    const isDark = settings.theme === 'dark'
      ? true
      : settings.theme === 'light'
        ? false
        : detected.isDark;

    const adaptive = isDark
      ? {
          isDark: true,
          webColor: '#e6ded1',
          particleColor: '#c5b7a4',
          dustDark: '#817566',
          dustLight: '#ebe1d2',
          webShadowColor: 'rgba(0, 0, 0, 0.72)',
          webHighlightColor: 'rgba(255, 249, 238, 0.34)'
        }
      : {
          isDark: false,
          webColor: '#725f4d',
          particleColor: '#716252',
          dustDark: '#493c31',
          dustLight: '#a89680',
          webShadowColor: 'rgba(26, 17, 11, 0.66)',
          webHighlightColor: 'rgba(255, 246, 230, 0.28)'
        };

    // Keep automatic contrast for the shipped/default values, but retain a
    // deliberate custom color chosen by the user in Advanced Settings.
    const webColor = String(settings.webColor || '').toLowerCase();
    const particleColor = String(settings.particleColor || '').toLowerCase();
    const defaultWeb = !webColor || ['#e0e0e0', '#c8b89a'].includes(webColor);
    const defaultParticle = !particleColor || ['#b8b8b8', '#9e8e78'].includes(particleColor);

    return {
      ...adaptive,
      webColor: defaultWeb ? adaptive.webColor : settings.webColor,
      particleColor: defaultParticle ? adaptive.particleColor : settings.particleColor
    };
  }

  function scaleByAge(settings, days) {
    const scaled = { ...settings };
    const threshold = Math.max(1, Number(settings.inactivityDays) || 1);
    const ratio = Math.max(1, Math.min(days / threshold, 5));

    // Keep the user's density choice intact. Age enhances the chosen scene
    // rather than silently changing a Low setting into Extreme.
    scaled._ageIntensity = Math.min(1, Math.max(0, (ratio - 1) / 3));
    scaled._ageRatio = ratio;
    return scaled;
  }

  function destroyEffects() {
    if (dusterEngine && dusterEngine.destroy) dusterEngine.destroy();
    if (spiderRenderer && spiderRenderer.destroy) spiderRenderer.destroy();
    if (webRenderer && webRenderer.destroy) webRenderer.destroy();
    if (overlay && overlay.destroy) overlay.destroy();

    document.querySelectorAll('.spw-web-asset, .spw-spider, [data-spw-web]').forEach(el => el.remove());

    overlay = null;
    webRenderer = null;
    dustSystem = null;
    spiderRenderer = null;
    soundManager = null;
    dusterEngine = null;
  }

  function initEffects(rawSettings, daysSinceVisit) {
    if (isInitializing) return;
    isInitializing = true;

    try {
      destroyEffects();

      const adaptiveColors = getAdaptiveColors(rawSettings);
      const settings = scaleByAge({
        ...rawSettings,
        webColor: adaptiveColors.webColor,
        particleColor: adaptiveColors.particleColor,
        _adaptiveColors: adaptiveColors
      }, daysSinceVisit);

      const OverlayCanvas = window.__spiderWebOverlay;
      const WebRenderer = window.__spiderWebRenderer;
      const DustSystem = window.__spiderDustSystem;
      const SpiderRenderer = window.__spiderSpiderRenderer;
      const SoundManagerClass = window.__spiderSoundManager;
      const DusterEngineClass = window.__spiderDusterEngine;

      if (!OverlayCanvas || !WebRenderer || !DustSystem || !SpiderRenderer ||
          !SoundManagerClass || !DusterEngineClass) {
        console.error('[Spider Web & Dust] Required renderer did not load.');
        return;
      }

      overlay = new OverlayCanvas();
      overlay.init();

      webRenderer = new WebRenderer(settings);
      dustSystem = new DustSystem(settings);
      spiderRenderer = new SpiderRenderer(settings);
      soundManager = new SoundManagerClass(settings);
      dusterEngine = new DusterEngineClass(
        settings,
        overlay,
        webRenderer,
        dustSystem,
        soundManager,
        spiderRenderer
      );

      // Canvas order: atmosphere → webs → duster/sparkles.
      overlay.addRenderer(dustSystem);
      overlay.addRenderer(webRenderer);
      overlay.addRenderer(spiderRenderer);
      overlay.addRenderer(dusterEngine);
      overlay.startRenderLoop(settings.animationSpeed);
      dusterEngine.init();

      lastDaysSinceVisit = daysSinceVisit;
      console.info('[Spider Web & Dust] Scene ready:', {
        density: settings.webDensity,
        ageIntensity: settings._ageIntensity,
        webCount: webRenderer.webs.length
      });
    } catch (error) {
      console.error('[Spider Web & Dust] Could not create scene:', error);
      destroyEffects();
    } finally {
      isInitializing = false;
    }
  }

  async function getSiteStatus(recordVisit) {
    return chrome.runtime.sendMessage({
      type: 'GET_SITE_STATUS',
      payload: { hostname, recordVisit: Boolean(recordVisit) }
    });
  }

  async function refreshScene(recordVisit = false) {
    try {
      const response = await getSiteStatus(recordVisit);
      if (!response || !response.active) {
        destroyEffects();
        return response;
      }

      initEffects(response.settings, Number(response.daysSinceVisit) || 0);
      return response;
    } catch (error) {
      if (!chrome.runtime.lastError) {
        console.warn('[Spider Web & Dust] Site status check failed:', error);
      }
      return null;
    }
  }

  function applyChangedSettings(settings) {
    const explicitlyDisabled = !settings.globalEnabled || settings.enabledSites?.[hostname] === false;
    if (explicitlyDisabled) {
      destroyEffects();
      return;
    }

    // The initial stale check records the visit after returning its result.
    // A later setting change must therefore rebuild the active scene from
    // that result instead of re-checking and accidentally treating the same
    // page view as fresh.
    if (overlay) {
      initEffects(settings, lastDaysSinceVisit);
    } else {
      refreshScene(false);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FORCE_CLEAN') {
      if (dusterEngine) dusterEngine.forceClean();
      sendResponse({ success: Boolean(dusterEngine) });
    } else if (message.type === 'SETTINGS_UPDATED') {
      if (message.settings) {
        applyChangedSettings(message.settings);
        sendResponse({ success: true });
      } else {
        refreshScene(false).then(() => sendResponse({ success: true }));
      }
      return true;
    }
    return true;
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local' || !changes.settings) return;
    applyChangedSettings(changes.settings.newValue || {});
  });

  // The first check is intentionally atomic: the worker calculates stale
  // state from the previous visit, then records this visit after replying.
  refreshScene(true);
})();
