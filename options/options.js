/* ============================================================
   Spider Web & Dust — Options Page Logic
   Full settings management, site table, live preview, import/export.
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {

  let currentSettings = null;
  let allSites = [];
  let previewCtx = null;
  let previewAnimId = null;

  // ── Navigation ──────────────────────────────────────────

  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.settings-section');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = item.dataset.section;

      navItems.forEach(n => n.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(sectionId).classList.add('active');

      // Initialize preview when Visual section becomes visible
      if (sectionId === 'visual' && !previewCtx) {
        // Small delay to let the section render with proper dimensions
        requestAnimationFrame(() => initPreview());
      }
    });
  });

  // ── Load Settings ───────────────────────────────────────

  const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  currentSettings = response.settings;
  applySettings(currentSettings);

  // Load sites
  loadSites();

  // ── Apply Settings to UI ────────────────────────────────

  function applySettings(s) {
    // General
    document.getElementById('opt-global-enabled').checked = s.globalEnabled;

    const daysSlider = document.getElementById('opt-inactivity-days');
    const daysNum = document.getElementById('opt-inactivity-days-num');
    daysSlider.value = s.inactivityDays;
    daysNum.value = s.inactivityDays;
    updateSliderFill(daysSlider);

    const speedSlider = document.getElementById('opt-animation-speed');
    speedSlider.value = s.animationSpeed;
    document.getElementById('opt-speed-value').textContent = `${s.animationSpeed.toFixed(1)}×`;
    updateSliderFill(speedSlider);

    // Visual
    setOptionGroup('opt-web-density', s.webDensity);
    setOptionGroup('opt-dust-intensity', s.dustIntensity);
    setOptionGroup('opt-theme', s.theme);

    document.getElementById('opt-web-color').value = s.webColor;
    document.getElementById('web-color-label').textContent = s.webColor;
    document.getElementById('opt-dust-color').value = s.particleColor;
    document.getElementById('dust-color-label').textContent = s.particleColor;

    // Cleaning
    setOptionGroup('opt-cleaning-mode', s.cleaningMode);

    const dusterCards = document.querySelectorAll('#opt-duster-style .duster-card');
    dusterCards.forEach(card => {
      card.classList.toggle('active', card.dataset.value === s.dusterStyle);
    });

    document.getElementById('opt-sound-enabled').checked = s.soundEnabled;
    const volSlider = document.getElementById('opt-sound-volume');
    volSlider.value = s.soundVolume;
    updateSliderFill(volSlider);

    // Update volume row visibility
    document.getElementById('volume-row').style.opacity = s.soundEnabled ? '1' : '0.4';
  }

  function setOptionGroup(groupId, value) {
    const btns = document.querySelectorAll(`#${groupId} .option-btn`);
    btns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  // ── Event Listeners ─────────────────────────────────────

  // Global toggle
  document.getElementById('opt-global-enabled').addEventListener('change', (e) => {
    save({ globalEnabled: e.target.checked });
  });

  // Days slider + number input (sync)
  const daysSlider = document.getElementById('opt-inactivity-days');
  const daysNum = document.getElementById('opt-inactivity-days-num');

  daysSlider.addEventListener('input', () => {
    daysNum.value = daysSlider.value;
    updateSliderFill(daysSlider);
  });
  daysSlider.addEventListener('change', () => {
    save({ inactivityDays: parseInt(daysSlider.value) });
  });
  daysNum.addEventListener('change', () => {
    const val = Math.max(1, Math.min(90, parseInt(daysNum.value) || 7));
    daysNum.value = val;
    daysSlider.value = val;
    updateSliderFill(daysSlider);
    save({ inactivityDays: val });
  });

  // Speed slider
  const speedSlider = document.getElementById('opt-animation-speed');
  speedSlider.addEventListener('input', () => {
    document.getElementById('opt-speed-value').textContent = `${parseFloat(speedSlider.value).toFixed(1)}×`;
    updateSliderFill(speedSlider);
  });
  speedSlider.addEventListener('change', () => {
    save({ animationSpeed: parseFloat(speedSlider.value) });
  });

  // Option groups
  setupOptionGroup('opt-web-density', 'webDensity');
  setupOptionGroup('opt-dust-intensity', 'dustIntensity');
  setupOptionGroup('opt-theme', 'theme');
  setupOptionGroup('opt-cleaning-mode', 'cleaningMode');

  function setupOptionGroup(groupId, settingKey) {
    const btns = document.querySelectorAll(`#${groupId} .option-btn`);
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        save({ [settingKey]: btn.dataset.value });
      });
    });
  }

  // Duster style cards
  const dusterCards = document.querySelectorAll('#opt-duster-style .duster-card');
  dusterCards.forEach(card => {
    card.addEventListener('click', () => {
      dusterCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      save({ dusterStyle: card.dataset.value });
    });
  });

  // Color pickers
  document.getElementById('opt-web-color').addEventListener('input', (e) => {
    document.getElementById('web-color-label').textContent = e.target.value;
    save({ webColor: e.target.value });
    updatePreview();
  });

  document.getElementById('opt-dust-color').addEventListener('input', (e) => {
    document.getElementById('dust-color-label').textContent = e.target.value;
    save({ particleColor: e.target.value });
    updatePreview();
  });

  // Sound
  document.getElementById('opt-sound-enabled').addEventListener('change', (e) => {
    save({ soundEnabled: e.target.checked });
    document.getElementById('volume-row').style.opacity = e.target.checked ? '1' : '0.4';
  });

  const volSlider = document.getElementById('opt-sound-volume');
  volSlider.addEventListener('input', () => updateSliderFill(volSlider));
  volSlider.addEventListener('change', () => {
    save({ soundVolume: parseFloat(volSlider.value) });
  });

  // ── Sites Management ───────────────────────────────────

  async function loadSites() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_ALL_SITES' });
    allSites = response.sites || [];
    renderSitesTable(allSites);
  }

  function renderSitesTable(sites) {
    const tbody = document.getElementById('sites-tbody');

    if (sites.length === 0) {
      tbody.innerHTML = `<tr class="loading-row"><td colspan="5">No sites tracked yet. Browse some websites!</td></tr>`;
      return;
    }

    tbody.innerHTML = sites.map(site => `
      <tr data-hostname="${site.hostname}">
        <td><span class="site-domain">${site.hostname}</span></td>
        <td>${site.lastVisitDate}</td>
        <td>${site.daysSince} days</td>
        <td><span class="stale-badge ${site.isStale ? 'stale' : 'fresh'}">${site.isStale ? '🕸️ Dusty' : '✅ Fresh'}</span></td>
        <td>
          <label class="toggle-switch" style="width:36px;height:20px;">
            <input type="checkbox" class="site-toggle" data-hostname="${site.hostname}" ${site.enabled ? 'checked' : ''}>
            <span class="toggle-slider" style="border-radius:20px;"></span>
          </label>
        </td>
      </tr>
    `).join('');

    // Wire up toggles
    tbody.querySelectorAll('.site-toggle').forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        const hostname = e.target.dataset.hostname;
        const enabledSites = { ...currentSettings.enabledSites };
        enabledSites[hostname] = e.target.checked;
        await save({ enabledSites });
      });
    });
  }

  // Site search
  document.getElementById('site-search').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allSites.filter(s => s.hostname.includes(query));
    renderSitesTable(filtered);
  });

  // Bulk actions
  document.getElementById('bulk-enable').addEventListener('click', async () => {
    const enabledSites = {};
    allSites.forEach(s => enabledSites[s.hostname] = true);
    await save({ enabledSites });
    loadSites();
    showToast('All sites enabled');
  });

  document.getElementById('bulk-disable').addEventListener('click', async () => {
    const enabledSites = {};
    allSites.forEach(s => enabledSites[s.hostname] = false);
    await save({ enabledSites });
    loadSites();
    showToast('All sites disabled');
  });

  // ── Import / Export ─────────────────────────────────────

  document.getElementById('export-btn').addEventListener('click', async () => {
    const data = JSON.stringify(currentSettings, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spiderweb-dust-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Settings exported!');
  });

  document.getElementById('import-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      // Validate basic shape
      if (typeof imported !== 'object' || !imported.inactivityDays) {
        throw new Error('Invalid settings file');
      }

      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: imported
      });

      currentSettings = { ...currentSettings, ...imported };
      applySettings(currentSettings);
      showToast('Settings imported successfully!');
    } catch (err) {
      showToast('Failed to import: ' + err.message);
    }

    e.target.value = ''; // Reset file input
  });

  // Reset settings
  document.getElementById('reset-btn').addEventListener('click', async () => {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) return;

    const response = await chrome.runtime.sendMessage({ type: 'RESET_SETTINGS' });
    currentSettings = response.settings;
    applySettings(currentSettings);
    showToast('Settings reset to defaults');
  });

  // Clear history
  document.getElementById('clear-history-btn').addEventListener('click', async () => {
    if (!confirm('Clear all visit history? Webs and dust will reset for all sites.')) return;

    await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
    loadSites();
    showToast('Visit history cleared');
  });

  // ── Save Helper ─────────────────────────────────────────

  async function save(partial) {
    currentSettings = { ...currentSettings, ...partial };
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: partial
    });
    updatePreview();
  }

  // ── Slider Fill ─────────────────────────────────────────

  function updateSliderFill(slider) {
    const val = slider.value;
    const min = slider.min || 0;
    const max = slider.max || 100;
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(to right, #a78bfa ${pct}%, #27272a ${pct}%)`;
  }

  // Init all slider fills
  document.querySelectorAll('.slider').forEach(updateSliderFill);

  // ── Toast ───────────────────────────────────────────────

  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3000);
  }

  // ── Live Preview Canvas ─────────────────────────────────

  function initPreview() {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    // Don't init if the section is hidden (0 dimensions)
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    previewCtx = canvas.getContext('2d');
    previewCtx.scale(dpr, dpr);

    startPreviewLoop(rect.width, rect.height);
  }

  function startPreviewLoop(w, h) {
    const particles = [];
    const webStrands = [];
    let time = 0;

    // Generate preview particles
    function regenParticles() {
      particles.length = 0;
      const counts = { low: 15, medium: 30, high: 50 };
      const count = counts[currentSettings.dustIntensity] || 30;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 1 + Math.random() * 2,
          opacity: 0.2 + Math.random() * 0.4,
          vy: 0.1 + Math.random() * 0.3,
          wobblePhase: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.5 + Math.random() * 1.5
        });
      }
    }

    // Generate preview web strands
    function regenWebs() {
      webStrands.length = 0;
      const counts = { low: 3, medium: 6, high: 10, extreme: 15 };
      const count = counts[currentSettings.webDensity] || 6;

      // Corner web in top-left
      const spokeCount = Math.min(count, 8);
      const size = Math.min(w, h) * 0.35;
      for (let i = 0; i < spokeCount; i++) {
        const angle = (i / (spokeCount - 1)) * (Math.PI / 2);
        webStrands.push({
          type: 'spoke',
          x1: 0, y1: 0,
          x2: Math.cos(angle) * size,
          y2: Math.sin(angle) * size,
          swayPhase: Math.random() * Math.PI * 2
        });
      }

      // Spiral connections
      for (let s = 1; s <= 4; s++) {
        const r = size * (s / 5);
        const pts = [];
        for (let i = 0; i < spokeCount; i++) {
          const angle = (i / (spokeCount - 1)) * (Math.PI / 2);
          pts.push({
            x: Math.cos(angle) * r * (0.9 + Math.random() * 0.2),
            y: Math.sin(angle) * r * (0.9 + Math.random() * 0.2)
          });
        }
        webStrands.push({ type: 'spiral', points: pts, swayPhase: Math.random() * Math.PI * 2 });
      }

      // Some strands
      for (let i = 0; i < Math.max(0, count - 5); i++) {
        webStrands.push({
          type: 'strand',
          x1: Math.random() * w, y1: 0,
          x2: w, y2: Math.random() * h * 0.5,
          midY: Math.random() * 20,
          swayPhase: Math.random() * Math.PI * 2
        });
      }
    }

    regenParticles();
    regenWebs();

    // Store regen functions for updates
    window.__previewRegen = () => { regenParticles(); regenWebs(); };

    function draw() {
      time += 0.016;
      const ctx = previewCtx;
      ctx.clearRect(0, 0, w, h);

      // Draw webs
      const webRgb = hexToRgb(currentSettings.webColor || '#e0e0e0');

      for (const strand of webStrands) {
        const sway = Math.sin(time * 0.8 + strand.swayPhase) * 1.5;

        if (strand.type === 'spoke') {
          ctx.beginPath();
          ctx.moveTo(strand.x1, strand.y1);
          ctx.lineTo(strand.x2 + sway, strand.y2 + sway * 0.5);
          ctx.strokeStyle = `rgba(${webRgb.r},${webRgb.g},${webRgb.b},0.3)`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        } else if (strand.type === 'spiral') {
          ctx.beginPath();
          ctx.moveTo(strand.points[0].x + sway, strand.points[0].y);
          for (let i = 1; i < strand.points.length; i++) {
            ctx.lineTo(strand.points[i].x + sway, strand.points[i].y + sway * 0.3);
          }
          ctx.strokeStyle = `rgba(${webRgb.r},${webRgb.g},${webRgb.b},0.2)`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        } else if (strand.type === 'strand') {
          ctx.beginPath();
          ctx.moveTo(strand.x1, strand.y1);
          ctx.quadraticCurveTo(
            (strand.x1 + strand.x2) / 2 + sway,
            (strand.y1 + strand.y2) / 2 + strand.midY + sway,
            strand.x2, strand.y2
          );
          ctx.strokeStyle = `rgba(${webRgb.r},${webRgb.g},${webRgb.b},0.2)`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      // Draw dust
      const dustRgb = hexToRgb(currentSettings.particleColor || '#b8b8b8');

      for (const p of particles) {
        const wobble = Math.sin(time * p.wobbleSpeed + p.wobblePhase) * 0.5;
        p.x += wobble * 0.3;
        p.y += p.vy;

        if (p.y > h + 5) { p.y = -5; p.x = Math.random() * w; }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dustRgb.r},${dustRgb.g},${dustRgb.b},${p.opacity})`;
        ctx.fill();
      }

      previewAnimId = requestAnimationFrame(draw);
    }

    if (previewAnimId) cancelAnimationFrame(previewAnimId);
    draw();
  }

  function updatePreview() {
    if (window.__previewRegen) {
      window.__previewRegen();
    }
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 200, g: 200, b: 200 };
  }
});
