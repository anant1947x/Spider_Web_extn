/* ============================================================
   Spider Web & Dust — Overlay Canvas
   Owns the viewport canvas and a single efficient animation loop.
   ============================================================ */

class OverlayCanvas {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 1;
    this.animationId = null;
    this.renderers = [];
    this.isActive = false;
    this.container = null;
    this.speedMultiplier = 1;
    this.lastTime = 0;
    this.isDocumentHidden = false;
    this._resizeHandler = null;
    this._visibilityHandler = null;
  }

  init() {
    if (this.canvas) return;

    this.container = document.createElement('div');
    this.container.id = 'spiderweb-dust-overlay';
    this.container.setAttribute('aria-hidden', 'true');
    this.container.style.cssText = [
      'position:fixed',
      'inset:0',
      'width:100vw',
      'height:100vh',
      'z-index:2147483646',
      'pointer-events:none',
      'overflow:hidden',
      'contain:layout style paint'
    ].join(';');

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'spiderweb-dust-canvas';
    this.canvas.style.cssText = [
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'display:block',
      'pointer-events:none'
    ].join(';');

    this.container.appendChild(this.canvas);
    document.documentElement.appendChild(this.container);
    this.ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: true });

    this._resizeHandler = () => this.resize();
    this._visibilityHandler = () => {
      this.isDocumentHidden = document.hidden;
      this.lastTime = performance.now();
    };

    window.addEventListener('resize', this._resizeHandler, { passive: true });
    document.addEventListener('visibilitychange', this._visibilityHandler);
    this.resize();
    this.isActive = true;
  }

  resize() {
    if (!this.canvas || !this.ctx) return;

    // Effects stay visually crisp while avoiding a 4×/9× canvas workload
    // on high-DPI displays. The DOM image webs retain their native sharpness.
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.width = Math.max(1, window.innerWidth);
    this.height = Math.max(1, window.innerHeight);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

    for (const renderer of this.renderers) {
      if (renderer.onResize) renderer.onResize(this.width, this.height);
    }
  }

  addRenderer(renderer) {
    this.renderers.push(renderer);
    if (renderer.onResize) renderer.onResize(this.width, this.height);
  }

  removeRenderer(renderer) {
    this.renderers = this.renderers.filter(item => item !== renderer);
  }

  startRenderLoop(speedMultiplier = 1) {
    if (this.animationId || !this.ctx) return;
    this.speedMultiplier = Math.max(0.25, Math.min(2, Number(speedMultiplier) || 1));
    this.lastTime = performance.now();

    const loop = currentTime => {
      if (!this.isActive || !this.ctx) return;

      const rawDelta = Math.min(0.05, Math.max(0, (currentTime - this.lastTime) / 1000));
      this.lastTime = currentTime;

      if (!this.isDocumentHidden) {
        const delta = rawDelta * this.speedMultiplier;
        this.ctx.clearRect(0, 0, this.width, this.height);

        for (const renderer of this.renderers) {
          if (renderer.update) renderer.update(delta, currentTime);
          if (renderer.render) renderer.render(this.ctx, this.width, this.height);
        }
      }

      this.animationId = requestAnimationFrame(loop);
    };

    this.animationId = requestAnimationFrame(loop);
  }

  stopRenderLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  enablePointerEvents() {
    if (!this.container) return;
    this.container.classList.add('spw-cleaning-active');
    this.container.style.pointerEvents = 'auto';
  }

  disablePointerEvents() {
    if (!this.container) return;
    this.container.classList.remove('spw-cleaning-active');
    this.container.style.pointerEvents = 'none';
  }

  setCursor(cursorStyle) {
    if (this.container) this.container.style.cursor = cursorStyle;
  }

  destroy() {
    this.stopRenderLoop();
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    if (this._visibilityHandler) document.removeEventListener('visibilitychange', this._visibilityHandler);
    if (this.container?.parentNode) this.container.parentNode.removeChild(this.container);

    this.canvas = null;
    this.ctx = null;
    this.container = null;
    this.renderers = [];
    this.isActive = false;
  }
}

window.__spiderWebOverlay = OverlayCanvas;
