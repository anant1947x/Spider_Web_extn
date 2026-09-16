/* ============================================================
   Spider Web & Dust — Content Script Entry Point
   Orchestrates overlay, renderers, and cleaning interaction.
   ============================================================ */

(function () {
  'use strict';

  // Avoid double-injection
  if (window.__spiderWebInitialized) return;
  window.__spiderWebInitialized = true;

  // Don't run on extension pages
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
  let soundManager = null;
  let dusterEngine = null;

  // ── Check site status with background ───────────────────

  console.log('[Spider Web & Dust] Content script running on:', hostname);

  chrome.runtime.sendMessage(
    { type: 'GET_SITE_STATUS', payload: { hostname } },
    (response) => {
      if (chrome.runtime.lastError) {
        console.log('[Spider Web & Dust] Error:', chrome.runtime.lastError.message);
        return;
      }
      console.log('[Spider Web & Dust] Site status:', response);

      if (!response || !response.active) {
        console.log('[Spider Web & Dust] Site is fresh or disabled, no effects.');
        return;
      }

      console.log('[Spider Web & Dust] Site is STALE! Initializing effects...');
      initEffects(response.settings, response.daysSinceVisit);
    }
  );

  // ── Initialize all effects ──────────────────────────────

  function initEffects(settings, daysSinceVisit) {
    try {
      // Scale effects based on how long the site has been unvisited
      const scaledSettings = scaleByAge(settings, daysSinceVisit);
      console.log('[Spider Web & Dust] Scaled settings:', scaledSettings);

      // Check that classes are available
      const OverlayCanvas = window.__spiderWebOverlay;
      const WebRenderer = window.__spiderWebRenderer;
      const DustSystem = window.__spiderDustSystem;
      const SoundManagerClass = window.__spiderSoundManager;
      const DusterEngineClass = window.__spiderDusterEngine;

      if (!OverlayCanvas || !WebRenderer || !DustSystem || !SoundManagerClass || !DusterEngineClass) {
        console.error('[Spider Web & Dust] Missing classes!', {
          OverlayCanvas: !!OverlayCanvas,
          WebRenderer: !!WebRenderer,
          DustSystem: !!DustSystem,
          SoundManager: !!SoundManagerClass,
          DusterEngine: !!DusterEngineClass
        });
        return;
      }

      // Create overlay
      overlay = new OverlayCanvas();
      overlay.init();
      console.log('[Spider Web & Dust] Overlay created:', overlay.width, 'x', overlay.height);

      // Create renderers
      webRenderer = new WebRenderer(scaledSettings);
      dustSystem = new DustSystem(scaledSettings);
      soundManager = new SoundManagerClass(scaledSettings);
      dusterEngine = new DusterEngineClass(scaledSettings, overlay, webRenderer, dustSystem, soundManager);

      // Register renderers (order matters: dust behind webs, sparkles on top)
      overlay.addRenderer(dustSystem);
      overlay.addRenderer(webRenderer);
      overlay.addRenderer(dusterEngine);
      console.log('[Spider Web & Dust] Renderers registered. Webs:', webRenderer.webs.length, 'Dust particles:', dustSystem.particles.length);

      // Start render loop
      overlay.startRenderLoop(settings.animationSpeed);
      console.log('[Spider Web & Dust] Render loop started at speed:', settings.animationSpeed);

      // Init duster (creates clean button)
      dusterEngine.init();
      console.log('[Spider Web & Dust] ✅ All effects initialized successfully!');
    } catch (err) {
      console.error('[Spider Web & Dust] ❌ Error initializing effects:', err);
    }
  }

  // ── Graduated scaling based on staleness ────────────────

  function scaleByAge(settings, days) {
    const scaled = { ...settings };
    const threshold = settings.inactivityDays;
    const ratio = Math.min(days / threshold, 5); // Cap at 5x threshold

    // Scale up density: 1x at threshold, maxes out at 3x threshold
    if (ratio >= 3) {
      scaled.webDensity = 'extreme';
      scaled.dustIntensity = 'high';
    } else if (ratio >= 2) {
      const densityLevels = ['low', 'medium', 'high', 'extreme'];
      const currentIdx = densityLevels.indexOf(settings.webDensity);
      scaled.webDensity = densityLevels[Math.min(currentIdx + 1, 3)];

      const dustLevels = ['low', 'medium', 'high'];
      const dustIdx = dustLevels.indexOf(settings.dustIntensity);
      scaled.dustIntensity = dustLevels[Math.min(dustIdx + 1, 2)];
    }

    return scaled;
  }

  // ── Listen for messages from popup/background ───────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FORCE_CLEAN') {
      if (dusterEngine) {
        dusterEngine.forceClean();
      }
      sendResponse({ success: true });
    } else if (message.type === 'SETTINGS_UPDATED') {
      // Could reload effects with new settings
      // For now, changes take effect on next page load
      sendResponse({ success: true });
    }
    return true;
  });

  // ── Listen for storage changes ──────────────────────────

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;
    if (changes.settings) {
      const newSettings = changes.settings.newValue;
      if (soundManager) soundManager.updateSettings(newSettings);
      // Other live updates could be added here
    }
  });

})();
