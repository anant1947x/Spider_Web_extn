/* ============================================================
   Spider Web & Dust — Popup Logic
   Quick settings, site status, and background canvas animation.
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // ── Elements ────────────────────────────────────────────

  const globalToggle = document.getElementById('global-toggle');
  const siteToggle = document.getElementById('site-toggle');
  const daysSlider = document.getElementById('days-slider');
  const daysValue = document.getElementById('days-value');
  const statusDomain = document.getElementById('status-domain');
  const statusDetail = document.getElementById('status-detail');
  const statusBadge = document.getElementById('status-badge');
  const statusIcon = document.getElementById('status-icon');
  const cleanNowBtn = document.getElementById('clean-now-btn');
  const openOptions = document.getElementById('open-options');
  const webDensityBtns = document.querySelectorAll('#web-density .density-btn');
  const dustIntensityBtns = document.querySelectorAll('#dust-intensity .density-btn');

  let currentSettings = null;
  let currentTab = null;
  let currentHostname = null;

  // ── Initialize ──────────────────────────────────────────

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  if (tab.url) {
    try {
      const url = new URL(tab.url);
      currentHostname = url.hostname;
      statusDomain.textContent = currentHostname;
    } catch (e) {
      statusDomain.textContent = 'Invalid URL';
    }
  }

  // Load settings
  const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  currentSettings = settingsResponse.settings;
  applySettingsToUI(currentSettings);

  // Get site status
  if (currentHostname) {
    const statusResponse = await chrome.runtime.sendMessage({
      type: 'GET_SITE_STATUS',
      payload: { hostname: currentHostname }
    });
    updateSiteStatus(statusResponse);
  }

  // Start background animation
  initBackgroundCanvas();

  // ── Apply settings to UI ────────────────────────────────

  function applySettingsToUI(settings) {
    globalToggle.checked = settings.globalEnabled;
    daysSlider.value = settings.inactivityDays;
    daysValue.textContent = `${settings.inactivityDays}d`;

    // Web density buttons
    webDensityBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === settings.webDensity);
    });

    // Dust intensity buttons
    dustIntensityBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === settings.dustIntensity);
    });

    // Site toggle
    if (currentHostname) {
      siteToggle.checked = settings.enabledSites[currentHostname] !== false;
    }

    updateSliderFill();
  }

  function updateSiteStatus(response) {
    if (!response) return;

    if (response.reason === 'stale') {
      statusIcon.textContent = '🕸️';
      statusDetail.textContent = `Last visited ${response.daysSinceVisit} days ago`;
      statusBadge.textContent = `${response.daysSinceVisit}d`;
      statusBadge.className = 'status-badge stale';
      cleanNowBtn.disabled = false;
    } else if (response.reason === 'fresh') {
      statusIcon.textContent = '✅';
      statusDetail.textContent = response.daysSinceVisit > 0
        ? `Visited ${response.daysSinceVisit} day${response.daysSinceVisit > 1 ? 's' : ''} ago`
        : 'Visited today';
      statusBadge.textContent = 'Fresh';
      statusBadge.className = 'status-badge fresh';
      cleanNowBtn.disabled = true;
    } else if (response.reason === 'first_visit') {
      statusIcon.textContent = '🆕';
      statusDetail.textContent = 'First visit recorded!';
      statusBadge.textContent = 'New';
      statusBadge.className = 'status-badge fresh';
      cleanNowBtn.disabled = true;
    } else if (response.reason === 'disabled') {
      statusIcon.textContent = '⏸️';
      statusDetail.textContent = 'Extension is disabled';
      statusBadge.textContent = 'Off';
      statusBadge.className = 'status-badge';
      cleanNowBtn.disabled = true;
    } else if (response.reason === 'site_disabled') {
      statusIcon.textContent = '🚫';
      statusDetail.textContent = 'Disabled for this site';
      statusBadge.textContent = 'Skip';
      statusBadge.className = 'status-badge';
      cleanNowBtn.disabled = true;
    }
  }

  // ── Event Listeners ─────────────────────────────────────

  // Global toggle
  globalToggle.addEventListener('change', async () => {
    await saveSettings({ globalEnabled: globalToggle.checked });
  });

  // Days slider
  daysSlider.addEventListener('input', () => {
    daysValue.textContent = `${daysSlider.value}d`;
    updateSliderFill();
  });

  daysSlider.addEventListener('change', async () => {
    await saveSettings({ inactivityDays: parseInt(daysSlider.value) });
  });

  // Web density
  webDensityBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      webDensityBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await saveSettings({ webDensity: btn.dataset.value });
    });
  });

  // Dust intensity
  dustIntensityBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      dustIntensityBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await saveSettings({ dustIntensity: btn.dataset.value });
    });
  });

  // Site toggle
  siteToggle.addEventListener('change', async () => {
    if (!currentHostname) return;
    const enabledSites = { ...currentSettings.enabledSites };
    enabledSites[currentHostname] = siteToggle.checked;
    await saveSettings({ enabledSites });
  });

  // Clean now
  cleanNowBtn.addEventListener('click', async () => {
    if (!currentTab) return;
    cleanNowBtn.disabled = true;
    cleanNowBtn.querySelector('span:last-child').textContent = 'Cleaning...';

    await chrome.runtime.sendMessage({
      type: 'TRIGGER_CLEAN',
      payload: { tabId: currentTab.id }
    });

    setTimeout(() => {
      cleanNowBtn.querySelector('span:last-child').textContent = 'Clean Now';
      cleanNowBtn.disabled = false;
    }, 2000);
  });

  // Open options
  openOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // ── Save Settings Helper ────────────────────────────────

  async function saveSettings(partial) {
    currentSettings = { ...currentSettings, ...partial };
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: partial
    });
  }

  // ── Slider Fill ─────────────────────────────────────────

  function updateSliderFill() {
    const val = daysSlider.value;
    const min = daysSlider.min;
    const max = daysSlider.max;
    const pct = ((val - min) / (max - min)) * 100;
    daysSlider.style.background = `linear-gradient(to right, #a78bfa ${pct}%, #27272a ${pct}%)`;
  }

  // ── Background Canvas Animation ────────────────────────

  function initBackgroundCanvas() {
    const canvas = document.getElementById('bg-canvas');
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = canvas.clientWidth * 2;
      canvas.height = canvas.clientHeight * 2;
      ctx.scale(2, 2);
    }
    resize();

    const particles = [];
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * canvas.clientWidth,
        y: Math.random() * canvas.clientHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: 1 + Math.random() * 2
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      // Update & draw particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.clientWidth) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.clientHeight) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(167, 139, 250, 0.4)';
        ctx.fill();
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 80) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(167, 139, 250, ${0.15 * (1 - dist / 80)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    }

    draw();
  }
});
