/* ============================================================
   Spider Web & Dust — Canvas Overlay
   Creates and manages the full-viewport transparent canvas.
   ============================================================ */

class OverlayCanvas {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.animationId = null;
    this.renderers = [];
    this.isActive = false;
    this.container = null;
  }

  init() {
    if (this.canvas) return;

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'spiderweb-dust-overlay';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483646;
      pointer-events: none;
      overflow: hidden;
    `;

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'spiderweb-dust-canvas';
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    `;

    this.container.appendChild(this.canvas);
    document.documentElement.appendChild(this.container);

    this.ctx = this.canvas.getContext('2d');
    this.resize();

    // Handle resize
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);

    this.isActive = true;
  }

  resize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Notify renderers of resize
    this.renderers.forEach(r => {
      if (r.onResize) r.onResize(this.width, this.height);
    });
  }

  addRenderer(renderer) {
    this.renderers.push(renderer);
    if (renderer.onResize) {
      renderer.onResize(this.width, this.height);
    }
  }

  removeRenderer(renderer) {
    this.renderers = this.renderers.filter(r => r !== renderer);
  }

  startRenderLoop(speedMultiplier = 1.0) {
    if (this.animationId) return;

    let lastTime = performance.now();

    const loop = (currentTime) => {
      const rawDelta = (currentTime - lastTime) / 1000;
      const delta = rawDelta * speedMultiplier;
      lastTime = currentTime;

      this.ctx.clearRect(0, 0, this.width, this.height);

      for (const renderer of this.renderers) {
        if (renderer.update) renderer.update(delta, currentTime);
        if (renderer.render) renderer.render(this.ctx, this.width, this.height);
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
    if (this.container) {
      this.container.style.pointerEvents = 'auto';
    }
  }

  disablePointerEvents() {
    if (this.container) {
      this.container.style.pointerEvents = 'none';
    }
  }

  setCursor(cursorStyle) {
    if (this.container) {
      this.container.style.cursor = cursorStyle;
    }
  }

  destroy() {
    this.stopRenderLoop();
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.canvas = null;
    this.ctx = null;
    this.container = null;
    this.renderers = [];
    this.isActive = false;
  }
}

// Export for content script
window.__spiderWebOverlay = OverlayCanvas;
