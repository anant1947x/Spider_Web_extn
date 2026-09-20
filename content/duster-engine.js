/* ============================================================
   Spider Web & Dust — Cleaning Engine
   Manual brushing and a complete serpentine auto-clean sweep.
   ============================================================ */

class DusterEngine {
  constructor(settings, overlay, webRenderer, dustSystem, soundManager, spiderRenderer) {
    this.settings = settings;
    this.overlay = overlay;
    this.webRenderer = webRenderer;
    this.dustSystem = dustSystem;
    this.soundManager = soundManager;
    this.spiderRenderer = spiderRenderer;

    this.isCleaningMode = false;
    this.isAutoCleaning = false;
    this.isPointerDown = false;
    this.completionStarted = false;
    this.sparkles = [];
    this.cleanButton = null;
    this.autoButton = null;
    this.tooltip = null;
    this.cleanRadius = this._getCleanRadius();
    this.lastPointer = { x: 0, y: 0 };
    this.whooshCooldown = 0;
    this.autoRoute = [];
    this.autoRouteIndex = 0;
    this.autoDuster = { x: -80, y: -80, visible: false, radius: 145 };

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  _getCleanRadius() {
    const styles = { classic: 78, feather: 58, vacuum: 105, magic: 88 };
    return styles[this.settings.dusterStyle] || styles.classic;
  }

  init() {
    this.createCleanButtons();
  }

  createCleanButtons() {
    const mode = this.settings.cleaningMode || 'both';
    this.cleanButton = this._createButton(
      'spiderweb-clean-btn',
      mode === 'both' ? 'Brush' : 'Clean',
      this._broomIcon()
    );
    this.cleanButton.addEventListener('click', () => {
      if (mode === 'auto') this.startAutoClean();
      else this.startManualCleaning();
    });

    if (mode === 'both') {
      this.autoButton = this._createButton('spiderweb-auto-btn', 'Sweep', this._sweepIcon());
      this.autoButton.addEventListener('click', () => this.startAutoClean());
    }
  }

  _createButton(id, label, icon) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = 'spw-action-button';
    button.setAttribute('aria-label', label + ' cobwebs and dust');
    button.innerHTML = '<span class="spw-btn-inner">' + icon + '<span>' + label + '</span></span>';
    document.documentElement.appendChild(button);
    return button;
  }

  _broomIcon() {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M14 3l7 7-2.2 2.2-7-7L14 3z" fill="currentColor" opacity=".82"/>' +
      '<path d="M4.5 14.7c2.5-2.5 5.5-3.2 7.6-1.1s1.4 5.1-1.1 7.6l-6.2-6.5z" fill="currentColor" opacity=".96"/>' +
      '<path d="M6.2 17.1l3.7 3.8M8.3 15.8l3.7 3.8M4.9 18.3l3.7 3.8" stroke="rgba(255,255,255,.38)" stroke-width=".7"/>' +
      '</svg>';
  }

  _sweepIcon() {
    return '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M4 12a8 8 0 0113.6-5.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M17 3v4h-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M20 12a8 8 0 01-13.6 5.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M7 21v-4h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  _setButtonsHidden(hidden) {
    [this.cleanButton, this.autoButton].filter(Boolean).forEach(button => {
      button.classList.toggle('spw-hidden', hidden);
      button.disabled = hidden;
    });
  }

  startManualCleaning() {
    if (this.isCleaningMode || this.isAutoCleaning || this.completionStarted) return;

    this.isCleaningMode = true;
    this.isPointerDown = false;
    this.soundManager.init();
    this.overlay.enablePointerEvents();
    this.overlay.setCursor(this._getDusterCursor());
    this._setButtonsHidden(true);

    const target = this.overlay.container;
    target.addEventListener('pointerdown', this._onPointerDown);
    target.addEventListener('pointermove', this._onPointerMove);
    target.addEventListener('pointerup', this._onPointerUp);
    target.addEventListener('pointercancel', this._onPointerUp);
    document.addEventListener('keydown', this._onKeyDown);
    this.showTooltip('Hold and drag to dust · Press Esc when you’re done');
  }

  stopManualCleaning() {
    if (!this.isCleaningMode) return;
    this.isCleaningMode = false;
    this.isPointerDown = false;
    this.overlay.disablePointerEvents();
    this.overlay.setCursor('default');

    const target = this.overlay.container;
    target.removeEventListener('pointerdown', this._onPointerDown);
    target.removeEventListener('pointermove', this._onPointerMove);
    target.removeEventListener('pointerup', this._onPointerUp);
    target.removeEventListener('pointercancel', this._onPointerUp);
    document.removeEventListener('keydown', this._onKeyDown);
    this.hideTooltip();
    this.checkCleaningComplete();
  }

  _onPointerDown(event) {
    if (!this.isCleaningMode) return;
    event.preventDefault();
    this.isPointerDown = true;
    this.overlay.container.setPointerCapture?.(event.pointerId);
    this._brush(event.clientX, event.clientY, this.cleanRadius);
  }

  _onPointerMove(event) {
    if (!this.isCleaningMode || !this.isPointerDown) return;
    event.preventDefault();
    this._brush(event.clientX, event.clientY, this.cleanRadius);
  }

  _onPointerUp(event) {
    if (!this.isCleaningMode) return;
    this.isPointerDown = false;
    if (this.overlay.container.hasPointerCapture?.(event.pointerId)) {
      this.overlay.container.releasePointerCapture(event.pointerId);
    }
    this.checkCleaningComplete();
  }

  _onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.stopManualCleaning();
    }
  }

  _brush(x, y, radius, isAuto = false) {
    this.webRenderer.cleanArea(x, y, radius);
    this.dustSystem.cleanArea(x, y, radius);
    if (this.spiderRenderer?.cleanArea) this.spiderRenderer.cleanArea(x, y, radius);

    if (Math.random() < (isAuto ? 0.28 : 0.46) && this.sparkles.length < 90) {
      this.addSparkle(
        x + (Math.random() - 0.5) * radius * 0.95,
        y + (Math.random() - 0.5) * radius * 0.7
      );
    }

    const dx = x - this.lastPointer.x;
    const dy = y - this.lastPointer.y;
    const speed = Math.hypot(dx, dy);
    if (speed > 3 && this.whooshCooldown <= 0) {
      this.soundManager.playWhoosh();
      this.whooshCooldown = isAuto ? 0.32 : 0.17;
    }
    if (!isAuto && Math.random() < 0.06) this.soundManager.playWebSnap();
    this.lastPointer = { x, y };
  }

  startAutoClean() {
    if (this.isAutoCleaning || this.isCleaningMode || this.completionStarted) return;

    this.isAutoCleaning = true;
    this.soundManager.init();
    this._setButtonsHidden(true);
    this.showTooltip('Sweeping every corner…');
    this._buildAutoRoute();
    this.autoRouteIndex = 1;
    this.autoDuster = {
      ...this.autoRoute[0],
      visible: true,
      radius: Math.max(145, this.cleanRadius * 1.8)
    };
    this.lastPointer = { x: this.autoDuster.x, y: this.autoDuster.y };
  }

  _buildAutoRoute() {
    const radius = Math.max(145, this.cleanRadius * 1.8);
    const spacing = Math.max(125, radius * 1.15);
    const rows = Math.max(2, Math.ceil(this.overlay.height / spacing) + 1);
    const route = [];

    for (let row = 0; row < rows; row++) {
      const y = Math.min(this.overlay.height + radius * 0.3, row * spacing);
      const forwards = row % 2 === 0;
      route.push({ x: forwards ? -radius : this.overlay.width + radius, y });
      route.push({ x: forwards ? this.overlay.width + radius : -radius, y });
    }
    this.autoRoute = route;
  }

  update(delta) {
    this.whooshCooldown = Math.max(0, this.whooshCooldown - delta);

    for (let index = this.sparkles.length - 1; index >= 0; index--) {
      const sparkle = this.sparkles[index];
      sparkle.life -= delta * 1.9;
      sparkle.y -= delta * 24;
      sparkle.x += sparkle.vx * delta;
      sparkle.size *= 0.975;
      sparkle.rotation += sparkle.rotationSpeed * delta;
      if (sparkle.life <= 0) this.sparkles.splice(index, 1);
    }

    if (this.isAutoCleaning) this._updateAutoClean(delta);
  }

  _updateAutoClean(delta) {
    const target = this.autoRoute[this.autoRouteIndex];
    if (!target) {
      this._finishAutoClean();
      return;
    }

    const dx = target.x - this.autoDuster.x;
    const dy = target.y - this.autoDuster.y;
    const distance = Math.hypot(dx, dy);
    const movement = Math.max(1, 1550 * delta);

    if (distance <= movement) {
      this.autoDuster.x = target.x;
      this.autoDuster.y = target.y;
      this.autoRouteIndex++;
    } else {
      this.autoDuster.x += (dx / distance) * movement;
      this.autoDuster.y += (dy / distance) * movement;
    }

    this._brush(this.autoDuster.x, this.autoDuster.y, this.autoDuster.radius, true);
  }

  _finishAutoClean() {
    this.isAutoCleaning = false;
    this.autoDuster.visible = false;
    this.webRenderer.cleanAll?.();
    this.dustSystem.cleanAll?.();
    this.spiderRenderer?.cleanAll?.();
    this.hideTooltip();

    const x = this.overlay.width / 2;
    const y = this.overlay.height / 2;
    for (let index = 0; index < 34; index++) {
      const angle = index / 34 * Math.PI * 2;
      const distance = 42 + Math.random() * 120;
      this.addSparkle(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, true);
    }
    this.soundManager.playComplete();
    this.checkCleaningComplete();
  }

  checkCleaningComplete() {
    const allClean = this.webRenderer.isAllCleaned() &&
      this.dustSystem.isAllCleaned() &&
      (!this.spiderRenderer || this.spiderRenderer.isAllCleaned());

    if (allClean) {
      this._completeScene();
      return;
    }

    if (!this.isCleaningMode && !this.isAutoCleaning) {
      this._setButtonsHidden(false);
    }
  }

  _completeScene() {
    if (this.completionStarted) return;
    this.completionStarted = true;
    this._setButtonsHidden(true);
    chrome.runtime.sendMessage({
      type: 'MARK_CLEANED',
      payload: { hostname: window.location.hostname }
    }).catch(() => {});

    setTimeout(() => {
      this.removeCleanButtons();
      if (this.overlay?.isActive) this.overlay.destroy();
    }, 1350);
  }

  forceClean() {
    const mode = this.settings.cleaningMode || 'both';
    if (mode === 'manual') this.startManualCleaning();
    else this.startAutoClean();
  }

  addSparkle(x, y, burst = false) {
    const colors = ['#ffe9a4', '#fff7d6', '#d8f3ff', '#f4ca7c', '#fff'];
    this.sparkles.push({
      x,
      y,
      size: burst ? 3 + Math.random() * 4 : 1.8 + Math.random() * 2.8,
      life: burst ? 0.9 + Math.random() * 0.45 : 0.48 + Math.random() * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * (burst ? 90 : 55),
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 7,
      star: Math.random() > 0.38
    });
  }

  render(ctx) {
    for (const sparkle of this.sparkles) {
      ctx.save();
      ctx.translate(sparkle.x, sparkle.y);
      ctx.rotate(sparkle.rotation);
      ctx.globalAlpha = Math.max(0, sparkle.life);
      if (sparkle.star) this._drawStar(ctx, sparkle.size, sparkle.color);
      else {
        ctx.fillStyle = sparkle.color;
        ctx.shadowColor = sparkle.color;
        ctx.shadowBlur = sparkle.size * 4;
        ctx.beginPath();
        ctx.arc(0, 0, sparkle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (this.autoDuster.visible) this._drawAutoDuster(ctx);
  }

  _drawStar(ctx, size, color) {
    ctx.beginPath();
    for (let index = 0; index < 8; index++) {
      const radius = index % 2 === 0 ? size : size * 0.38;
      const angle = index * Math.PI / 4 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 3.6;
    ctx.fill();
  }

  _drawAutoDuster(ctx) {
    const { x, y } = this.autoDuster;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.18);
    ctx.strokeStyle = '#76543a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, 5);
    ctx.lineTo(-34, -34);
    ctx.stroke();

    const feather = ctx.createRadialGradient(0, 0, 4, 0, 0, 29);
    feather.addColorStop(0, '#f0c986');
    feather.addColorStop(0.52, '#d9a860');
    feather.addColorStop(1, '#9c6b3f');
    ctx.fillStyle = feather;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 18, 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,236,192,.42)';
    ctx.lineWidth = 1.2;
    for (let index = 0; index < 9; index++) {
      const angle = -1.1 + index * 0.27;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * 25, Math.sin(angle) * 15);
      ctx.stroke();
    }
    ctx.restore();
  }

  _getDusterCursor() {
    const cursor = '<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">' +
      '<line x1="22" y1="22" x2="39" y2="39" stroke="%236f5039" stroke-width="4" stroke-linecap="round"/>' +
      '<ellipse cx="18" cy="18" rx="14" ry="9" transform="rotate(-18 18 18)" fill="%23d9a860"/>' +
      '<ellipse cx="17" cy="17" rx="10" ry="6.2" transform="rotate(-18 17 17)" fill="%23f0c986"/>' +
      '<path d="M7 16l-4-4M9 12L7 7M14 10l1-5M20 11l4-5" stroke="%239c6b3f" stroke-width="1.3" stroke-linecap="round"/>' +
      '</svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(cursor) + '") 17 17, crosshair';
  }

  showTooltip(text) {
    this.hideTooltip();
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'spiderweb-tooltip';
    this.tooltip.textContent = text;
    document.documentElement.appendChild(this.tooltip);
  }

  hideTooltip() {
    if (this.tooltip?.parentNode) this.tooltip.parentNode.removeChild(this.tooltip);
    const existing = document.getElementById('spiderweb-tooltip');
    if (existing?.parentNode) existing.parentNode.removeChild(existing);
    this.tooltip = null;
  }

  removeCleanButtons() {
    [this.cleanButton, this.autoButton].filter(Boolean).forEach(button => button.remove());
    this.cleanButton = null;
    this.autoButton = null;
    this.hideTooltip();
  }

  destroy() {
    this.isAutoCleaning = false;
    this.isCleaningMode = false;
    this.isPointerDown = false;
    if (this.overlay?.container) {
      this.overlay.container.removeEventListener('pointerdown', this._onPointerDown);
      this.overlay.container.removeEventListener('pointermove', this._onPointerMove);
      this.overlay.container.removeEventListener('pointerup', this._onPointerUp);
      this.overlay.container.removeEventListener('pointercancel', this._onPointerUp);
      this.overlay.disablePointerEvents();
    }
    document.removeEventListener('keydown', this._onKeyDown);
    this.removeCleanButtons();
  }
}

window.__spiderDusterEngine = DusterEngine;
