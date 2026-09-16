/* ============================================================
   Spider Web & Dust — Duster Engine
   Handles manual wipe + auto-clean interactions with sparkles.
   ============================================================ */

class DusterEngine {
  constructor(settings, overlay, webRenderer, dustSystem, soundManager) {
    this.settings = settings;
    this.overlay = overlay;
    this.webRenderer = webRenderer;
    this.dustSystem = dustSystem;
    this.soundManager = soundManager;

    this.isCleaningMode = false;
    this.isAutoCleaning = false;
    this.sparkles = [];
    this.cleanTrail = [];  // sparkle trail behind duster
    this.autoCleanProgress = 0;
    this.autoCleanPhase = 0; // 0: sweep right, 1: sweep down
    this.cleanButton = null;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.cleanRadius = 60;
    this.whooshCooldown = 0;

    // Auto-clean duster position
    this.autoDuster = { x: 0, y: 0, visible: false };

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onClick = this._onClick.bind(this);
  }

  init() {
    this.createCleanButton();
  }

  createCleanButton() {
    // Floating clean button
    this.cleanButton = document.createElement('div');
    this.cleanButton.id = 'spiderweb-clean-btn';
    this.cleanButton.innerHTML = `
      <div class="spw-btn-inner">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C12 2 8 6 8 10C8 12 9 14 9 14L6 20C6 20 5 22 7 22H17C19 22 18 20 18 20L15 14C15 14 16 12 16 10C16 6 12 2 12 2Z" fill="currentColor" opacity="0.9"/>
          <path d="M10 14H14L12 10L10 14Z" fill="rgba(255,255,255,0.3)"/>
          <circle cx="12" cy="7" r="1.5" fill="rgba(255,255,255,0.4)"/>
        </svg>
        <span>Clean</span>
      </div>
    `;

    this.cleanButton.addEventListener('click', () => {
      const mode = this.settings.cleaningMode;
      if (mode === 'manual' || mode === 'both') {
        this.startManualCleaning();
      } else if (mode === 'auto') {
        this.startAutoClean();
      }
    });

    // Add mode toggle if "both"
    if (this.settings.cleaningMode === 'both') {
      const autoBtn = document.createElement('div');
      autoBtn.id = 'spiderweb-auto-btn';
      autoBtn.innerHTML = `
        <div class="spw-btn-inner spw-auto">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" fill="currentColor"/>
          </svg>
          <span>Auto</span>
        </div>
      `;
      autoBtn.addEventListener('click', () => this.startAutoClean());
      document.documentElement.appendChild(autoBtn);
    }

    document.documentElement.appendChild(this.cleanButton);
  }

  startManualCleaning() {
    if (this.isCleaningMode) return;
    this.isCleaningMode = true;
    this.soundManager.init();

    // Enable pointer events on overlay
    this.overlay.enablePointerEvents();

    // Set duster cursor
    const cursorSvg = this.getDusterCursor();
    this.overlay.setCursor(`url("data:image/svg+xml,${encodeURIComponent(cursorSvg)}") 16 16, crosshair`);

    // Add event listeners to overlay container
    const container = this.overlay.container;
    container.addEventListener('mousemove', this._onMouseMove);
    container.addEventListener('mousedown', this._onMouseDown);

    // Hide clean button
    if (this.cleanButton) this.cleanButton.classList.add('spw-hidden');
    const autoBtn = document.getElementById('spiderweb-auto-btn');
    if (autoBtn) autoBtn.classList.add('spw-hidden');

    // Add instruction tooltip
    this.showTooltip('🧹 Drag to clean! Click anywhere to finish.');
  }

  stopManualCleaning() {
    this.isCleaningMode = false;

    this.overlay.disablePointerEvents();
    this.overlay.setCursor('default');

    const container = this.overlay.container;
    container.removeEventListener('mousemove', this._onMouseMove);
    container.removeEventListener('mousedown', this._onMouseDown);

    this.hideTooltip();
    this.checkCleaningComplete();
  }

  _onMouseMove(e) {
    if (!this.isCleaningMode) return;

    const x = e.clientX;
    const y = e.clientY;

    // Clean area under cursor
    this.webRenderer.cleanArea(x, y, this.cleanRadius);
    this.dustSystem.cleanArea(x, y, this.cleanRadius);

    // Add sparkle trail
    if (Math.random() < 0.4) {
      this.addSparkle(x + (Math.random() - 0.5) * this.cleanRadius,
                      y + (Math.random() - 0.5) * this.cleanRadius);
    }

    // Play sounds
    this.whooshCooldown -= 1;
    const dx = x - this.lastMouseX;
    const dy = y - this.lastMouseY;
    const speed = Math.sqrt(dx * dx + dy * dy);

    if (speed > 5 && this.whooshCooldown <= 0) {
      this.soundManager.playWhoosh();
      this.whooshCooldown = 15;
    }

    if (Math.random() < 0.05) {
      this.soundManager.playWebSnap();
    }

    this.lastMouseX = x;
    this.lastMouseY = y;
  }

  _onMouseDown(e) {
    // Click to exit manual cleaning mode
    if (this.isCleaningMode) {
      // Small delay to allow the click to register cleaning
      setTimeout(() => this.stopManualCleaning(), 100);
    }
  }

  startAutoClean() {
    if (this.isAutoCleaning) return;
    this.isAutoCleaning = true;
    this.autoCleanProgress = 0;
    this.autoCleanPhase = 0;
    this.soundManager.init();

    this.autoDuster = {
      x: -50,
      y: this.overlay.height * 0.3,
      visible: true
    };

    // Hide buttons
    if (this.cleanButton) this.cleanButton.classList.add('spw-hidden');
    const autoBtn = document.getElementById('spiderweb-auto-btn');
    if (autoBtn) autoBtn.classList.add('spw-hidden');

    this.showTooltip('✨ Auto-cleaning in progress...');
  }

  update(delta, currentTime) {
    // Update sparkles
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      s.life -= delta * 2;
      s.y -= delta * 30;
      s.x += s.vx * delta;
      s.size *= 0.97;
      s.rotation += s.rotSpeed * delta;

      if (s.life <= 0) {
        this.sparkles.splice(i, 1);
      }
    }

    // Auto-clean animation
    if (this.isAutoCleaning) {
      this.updateAutoClean(delta);
    }
  }

  updateAutoClean(delta) {
    const speed = 350 * delta; // pixels per frame
    const w = this.overlay.width;
    const h = this.overlay.height;

    if (this.autoCleanPhase === 0) {
      // Sweep right
      this.autoDuster.x += speed;
      this.autoDuster.y = h * 0.3 + Math.sin(this.autoDuster.x * 0.02) * 30;

      // Clean as we go
      this.webRenderer.cleanArea(this.autoDuster.x, this.autoDuster.y, 120);
      this.dustSystem.cleanArea(this.autoDuster.x, this.autoDuster.y, 120);

      // Also clean above and below
      this.webRenderer.cleanArea(this.autoDuster.x, this.autoDuster.y - 100, 80);
      this.dustSystem.cleanArea(this.autoDuster.x, this.autoDuster.y - 100, 80);
      this.webRenderer.cleanArea(this.autoDuster.x, this.autoDuster.y + 100, 80);
      this.dustSystem.cleanArea(this.autoDuster.x, this.autoDuster.y + 100, 80);

      // Add sparkles
      if (Math.random() < 0.6) {
        this.addSparkle(
          this.autoDuster.x + (Math.random() - 0.5) * 80,
          this.autoDuster.y + (Math.random() - 0.5) * 80
        );
      }

      // Sound
      this.whooshCooldown -= 1;
      if (this.whooshCooldown <= 0) {
        this.soundManager.playWhoosh();
        this.whooshCooldown = 20;
      }

      if (this.autoDuster.x > w + 50) {
        this.autoCleanPhase = 1;
        this.autoDuster.x = w * 0.5;
        this.autoDuster.y = -50;
      }
    } else if (this.autoCleanPhase === 1) {
      // Sweep down
      this.autoDuster.y += speed;
      this.autoDuster.x = w * 0.5 + Math.sin(this.autoDuster.y * 0.02) * 40;

      this.webRenderer.cleanArea(this.autoDuster.x, this.autoDuster.y, 120);
      this.dustSystem.cleanArea(this.autoDuster.x, this.autoDuster.y, 120);
      this.webRenderer.cleanArea(this.autoDuster.x - 100, this.autoDuster.y, 80);
      this.dustSystem.cleanArea(this.autoDuster.x - 100, this.autoDuster.y, 80);
      this.webRenderer.cleanArea(this.autoDuster.x + 100, this.autoDuster.y, 80);
      this.dustSystem.cleanArea(this.autoDuster.x + 100, this.autoDuster.y, 80);

      if (Math.random() < 0.6) {
        this.addSparkle(
          this.autoDuster.x + (Math.random() - 0.5) * 80,
          this.autoDuster.y + (Math.random() - 0.5) * 80
        );
      }

      this.whooshCooldown -= 1;
      if (this.whooshCooldown <= 0) {
        this.soundManager.playWhoosh();
        this.whooshCooldown = 20;
      }

      if (this.autoDuster.y > h + 50) {
        this.finishAutoClean();
      }
    }
  }

  finishAutoClean() {
    this.isAutoCleaning = false;
    this.autoDuster.visible = false;
    this.hideTooltip();

    // Sparkle burst!
    const cx = this.overlay.width / 2;
    const cy = this.overlay.height / 2;
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const dist = 50 + Math.random() * 100;
      this.addSparkle(
        cx + Math.cos(angle) * dist,
        cy + Math.sin(angle) * dist,
        true
      );
    }

    this.soundManager.playComplete();
    this.checkCleaningComplete();
  }

  checkCleaningComplete() {
    const allClean = this.webRenderer.isAllCleaned() && this.dustSystem.isAllCleaned();
    if (allClean) {
      // Notify background to update visit timestamp
      const hostname = window.location.hostname;
      chrome.runtime.sendMessage({
        type: 'MARK_CLEANED',
        payload: { hostname }
      });

      // Remove overlay after sparkles finish
      setTimeout(() => {
        if (this.overlay) this.overlay.destroy();
        this.removeCleanButtons();
      }, 2000);
    } else {
      // Show buttons again
      if (this.cleanButton) this.cleanButton.classList.remove('spw-hidden');
      const autoBtn = document.getElementById('spiderweb-auto-btn');
      if (autoBtn) autoBtn.classList.remove('spw-hidden');
    }
  }

  removeCleanButtons() {
    if (this.cleanButton && this.cleanButton.parentNode) {
      this.cleanButton.parentNode.removeChild(this.cleanButton);
    }
    const autoBtn = document.getElementById('spiderweb-auto-btn');
    if (autoBtn && autoBtn.parentNode) {
      autoBtn.parentNode.removeChild(autoBtn);
    }
    const tooltip = document.getElementById('spiderweb-tooltip');
    if (tooltip && tooltip.parentNode) {
      tooltip.parentNode.removeChild(tooltip);
    }
  }

  addSparkle(x, y, isBurst = false) {
    const colors = ['#FFD700', '#FFF8DC', '#FFFACD', '#F0E68C', '#FFE4B5', '#87CEEB'];
    this.sparkles.push({
      x,
      y,
      size: isBurst ? 3 + Math.random() * 4 : 2 + Math.random() * 3,
      life: 0.6 + Math.random() * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 60,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 8,
      shape: Math.random() < 0.5 ? 'star' : 'circle'
    });
  }

  render(ctx, w, h) {
    // Draw sparkles
    for (const s of this.sparkles) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.globalAlpha = Math.max(0, s.life);

      if (s.shape === 'star') {
        this.drawStar(ctx, 0, 0, s.size, s.color);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, s.size, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();

        // Glow
        ctx.shadowColor = s.color;
        ctx.shadowBlur = s.size * 3;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Draw auto-clean duster
    if (this.autoDuster.visible) {
      this.drawAutoCleanDuster(ctx);
    }
  }

  drawStar(ctx, x, y, size, color) {
    const spikes = 4;
    const outerRadius = size;
    const innerRadius = size * 0.4;

    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 4;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  drawAutoCleanDuster(ctx) {
    const { x, y } = this.autoDuster;

    ctx.save();
    ctx.translate(x, y);

    // Duster handle
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-20, -30);
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Duster head
    const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 25);
    gradient.addColorStop(0, '#DEB887');
    gradient.addColorStop(0.5, '#D2B48C');
    gradient.addColorStop(1, '#BC9A6C');

    ctx.beginPath();
    ctx.ellipse(0, 0, 25, 18, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Feather-like strokes
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const len = 15 + Math.random() * 10;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 6);
      ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len * 0.7);
      ctx.strokeStyle = `rgba(222, 184, 135, ${0.4 + Math.random() * 0.3})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  getDusterCursor() {
    const style = this.settings.dusterStyle || 'classic';
    const cursors = {
      classic: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <line x1="16" y1="16" x2="28" y2="28" stroke="%238B7355" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="14" cy="14" rx="10" ry="7" fill="%23DEB887" transform="rotate(-20 14 14)"/>
        <ellipse cx="14" cy="14" rx="7" ry="5" fill="%23D2B48C" transform="rotate(-20 14 14)"/>
        <line x1="8" y1="10" x2="4" y2="6" stroke="%23BC9A6C" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="12" y1="8" x2="10" y2="4" stroke="%23BC9A6C" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="16" y1="9" x2="18" y2="5" stroke="%23BC9A6C" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="10" y1="14" x2="5" y2="14" stroke="%23BC9A6C" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
      feather: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <line x1="20" y1="20" x2="30" y2="30" stroke="%238B7355" stroke-width="2" stroke-linecap="round"/>
        <path d="M18 18 Q10 14, 6 4 Q12 8, 18 18" fill="%23E8D5B7" stroke="%23BC9A6C" stroke-width="0.5"/>
        <line x1="12" y1="11" x2="6" y2="4" stroke="%23D2B48C" stroke-width="0.8"/>
        <path d="M18 18 Q14 12, 14 2 Q16 10, 18 18" fill="%23F0E4D0" stroke="%23BC9A6C" stroke-width="0.5"/>
      </svg>`,
      vacuum: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect x="8" y="2" width="16" height="6" rx="2" fill="%23666"/>
        <rect x="10" y="8" width="12" height="4" fill="%23888"/>
        <line x1="16" y1="12" x2="16" y2="28" stroke="%23999" stroke-width="4" stroke-linecap="round"/>
        <circle cx="16" cy="28" r="3" fill="%23777"/>
        <rect x="10" y="3" width="12" height="2" rx="1" fill="%23555"/>
      </svg>`,
      magic: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <line x1="16" y1="16" x2="28" y2="28" stroke="%234A3728" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="14" cy="14" r="4" fill="%23FFD700"/>
        <circle cx="14" cy="14" r="2" fill="%23FFF8DC"/>
        <line x1="14" y1="7" x2="14" y2="4" stroke="%23FFD700" stroke-width="1" stroke-linecap="round"/>
        <line x1="14" y1="21" x2="14" y2="24" stroke="%23FFD700" stroke-width="1" stroke-linecap="round"/>
        <line x1="7" y1="14" x2="4" y2="14" stroke="%23FFD700" stroke-width="1" stroke-linecap="round"/>
        <line x1="21" y1="14" x2="24" y2="14" stroke="%23FFD700" stroke-width="1" stroke-linecap="round"/>
        <circle cx="8" cy="8" r="1" fill="%23FFD700" opacity="0.6"/>
        <circle cx="20" cy="8" r="1" fill="%23FFD700" opacity="0.6"/>
        <circle cx="8" cy="20" r="1" fill="%23FFD700" opacity="0.6"/>
      </svg>`
    };

    return cursors[style] || cursors.classic;
  }

  showTooltip(text) {
    this.hideTooltip();
    const tooltip = document.createElement('div');
    tooltip.id = 'spiderweb-tooltip';
    tooltip.textContent = text;
    document.documentElement.appendChild(tooltip);
  }

  hideTooltip() {
    const existing = document.getElementById('spiderweb-tooltip');
    if (existing) existing.remove();
  }

  // Called from content.js when FORCE_CLEAN message received
  forceClean() {
    const mode = this.settings.cleaningMode;
    if (mode === 'auto' || mode === 'both') {
      this.startAutoClean();
    } else {
      this.startManualCleaning();
    }
  }
}

window.__spiderDusterEngine = DusterEngine;
