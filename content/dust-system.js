/* ============================================================
   Spider Web & Dust — Dust / Grain / Vignette Renderer
   Static atmosphere is cached offscreen; only individual motes
   animate, keeping the full-page scene light on CPU/GPU.
   ============================================================ */

class DustSystem {
  constructor(settings) {
    this.settings = settings;
    this.particles = [];
    this.settledParticles = [];
    this.width = 0;
    this.height = 0;
    this.time = 0;
    this.filmOpacity = 0;
    this.baseFilmOpacity = 0;
    this.staticCanvas = null;
    this.motionAccumulator = 0;
    this.reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Dust placement is a global extension scene, just like the cobwebs.
    // It must not reshuffle merely because the user opens another website.
    this._seed = this._hashString([
      'spw-global-dust-layout-v3',
      settings.webDensity || 'medium',
      settings.dustIntensity || 'medium'
    ].join('::'));
  }

  _hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index++) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash) || 7;
  }

  _mulberry32(seed) {
    return function () {
      let value = seed += 0x6D2B79F5;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  onResize(width, height) {
    this.width = width;
    this.height = height;
    this.generateParticles();
    this._buildStaticAtmosphere();
  }

  generateParticles() {
    this.particles = [];
    this.settledParticles = [];

    const floatingCounts = { low: 40, medium: 96, high: 160 };
    const settledCounts = { low: 20, medium: 52, high: 92 };
    const age = Math.max(0, Math.min(1, Number(this.settings._ageIntensity) || 0));
    const countBoost = Math.round(age * 20);
    const floatingCount = (floatingCounts[this.settings.dustIntensity] || floatingCounts.medium) + countBoost;
    const settledCount = (settledCounts[this.settings.dustIntensity] || settledCounts.medium) + Math.round(countBoost * 0.55);
    const rng = this._mulberry32(this._seed + this.width * 17 + this.height);

    for (let index = 0; index < floatingCount; index++) {
      this.particles.push(this._createFloatingParticle(rng));
    }
    for (let index = 0; index < settledCount; index++) {
      this.settledParticles.push(this._createSettledParticle(rng));
    }

    const filmLevels = { low: 0.36, medium: 0.58, high: 0.82 };
    this.baseFilmOpacity = Math.min(1, (filmLevels[this.settings.dustIntensity] || 0.58) + age * 0.1);
    this.filmOpacity = this.baseFilmOpacity;
  }

  _createFloatingParticle(rng) {
    return {
      x: rng() * this.width,
      y: rng() * this.height,
      size: 0.55 + rng() * 1.8,
      opacity: 0.11 + rng() * 0.2,
      vx: (rng() - 0.5) * 0.55,
      vy: (rng() - 0.5) * 0.34,
      wobblePhase: rng() * Math.PI * 2,
      wobbleRate: 0.5 + rng() * 0.8,
      color: this._getColor(rng),
      alive: true,
      fade: 1
    };
  }

  _createSettledParticle(rng) {
    const edge = rng();
    const depth = 34 + rng() * 100;
    let x;
    let y;

    if (edge < 0.42) {
      x = rng() * this.width;
      y = this.height - rng() * depth;
    } else if (edge < 0.64) {
      x = rng() < 0.5 ? rng() * depth : this.width - rng() * depth;
      y = rng() < 0.5 ? rng() * depth : this.height - rng() * depth;
    } else if (edge < 0.84) {
      x = rng() < 0.5 ? rng() * depth : this.width - rng() * depth;
      y = rng() * this.height;
    } else {
      x = rng() * this.width;
      y = rng() * depth;
    }

    return {
      x,
      y,
      size: 0.7 + rng() * 2.1,
      opacity: 0.12 + rng() * 0.22,
      color: this._getColor(rng),
      alive: true,
      fade: 1
    };
  }

  _getColor(rng = Math.random) {
    const colors = this.settings._adaptiveColors || {};
    const value = rng();
    if (colors.isDark) {
      return value < 0.3 ? (colors.dustDark || '#827363')
        : value < 0.72 ? (this.settings.particleColor || '#c5b7a4')
          : (colors.dustLight || '#eee2d1');
    }
    return value < 0.32 ? (colors.dustDark || '#4b3d31')
      : value < 0.75 ? (this.settings.particleColor || '#716252')
        : (colors.dustLight || '#a9957e');
  }

  _buildStaticAtmosphere() {
    if (!this.width || !this.height) return;

    // The cached layer intentionally renders at a modest resolution. It is
    // soft grain/vignette by design and is stretched once per display frame.
    const maxEdge = 1000;
    const scale = Math.min(1, maxEdge / Math.max(this.width, this.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(this.width * scale));
    canvas.height = Math.max(1, Math.round(this.height * scale));
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    const colors = this.settings._adaptiveColors || {};
    const darkSite = Boolean(colors.isDark);
    const dustRgb = this.hexToRgb(this.settings.particleColor || '#8c7966');
    const edgeRgb = darkSite ? { r: 4, g: 4, b: 5 } : { r: 35, g: 24, b: 17 };
    const intensity = this.baseFilmOpacity;

    // One radial vignette, built only on resize. It adds atmosphere without
    // turning the whole page into a brown coffee stain.
    const radius = Math.max(this.width, this.height) * 0.76;
    const vignette = ctx.createRadialGradient(
      this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.16,
      this.width / 2, this.height / 2, radius
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.6, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(' + edgeRgb.r + ',' + edgeRgb.g + ',' + edgeRgb.b + ',' + (0.19 * intensity).toFixed(3) + ')');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.width, this.height);

    // Soft accumulated dust at the lower edge and in two random-ish corners.
    const bottom = ctx.createLinearGradient(0, this.height, 0, this.height - Math.min(180, this.height * 0.25));
    bottom.addColorStop(0, 'rgba(' + dustRgb.r + ',' + dustRgb.g + ',' + dustRgb.b + ',' + (0.065 * intensity).toFixed(3) + ')');
    bottom.addColorStop(1, 'rgba(' + dustRgb.r + ',' + dustRgb.g + ',' + dustRgb.b + ',0)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, this.height - Math.min(180, this.height * 0.25), this.width, Math.min(180, this.height * 0.25));

    const rng = this._mulberry32(this._seed + 999);
    const grainCount = Math.round((darkSite ? 1200 : 1700) * (0.45 + intensity));
    ctx.fillStyle = 'rgba(' + dustRgb.r + ',' + dustRgb.g + ',' + dustRgb.b + ',0.06)';
    for (let index = 0; index < grainCount; index++) {
      const x = rng() * this.width;
      const y = rng() * this.height;
      const size = rng() < 0.9 ? 0.8 : 1.4;
      ctx.globalAlpha = (0.12 + rng() * 0.4) * intensity;
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;

    this.staticCanvas = canvas;
  }

  update(delta) {
    this.time += delta;
    if (this.reducedMotion || this.filmOpacity <= 0) return;

    this.motionAccumulator += delta;
    if (this.motionAccumulator < 1 / 30) return;
    const step = Math.min(0.1, this.motionAccumulator);
    this.motionAccumulator = 0;

    for (const particle of this.particles) {
      if (!particle.alive) continue;
      const wobble = Math.sin(this.time * particle.wobbleRate + particle.wobblePhase) * 0.16;
      particle.x += (particle.vx + wobble) * step * 60;
      particle.y += particle.vy * step * 60;
      if (particle.x < -10) particle.x = this.width + 10;
      if (particle.x > this.width + 10) particle.x = -10;
      if (particle.y < -10) particle.y = this.height + 10;
      if (particle.y > this.height + 10) particle.y = -10;
    }
  }

  render(ctx, width, height) {
    if (this.filmOpacity <= 0) return;

    const atmosphereAlpha = this.baseFilmOpacity
      ? Math.max(0, Math.min(1, this.filmOpacity / this.baseFilmOpacity))
      : 0;
    if (this.staticCanvas) {
      ctx.save();
      ctx.globalAlpha = atmosphereAlpha;
      ctx.drawImage(this.staticCanvas, 0, 0, width, height);
      ctx.restore();
    }

    for (const particle of this.settledParticles) {
      if (particle.alive && particle.fade > 0) this._drawParticle(ctx, particle, atmosphereAlpha);
    }
    for (const particle of this.particles) {
      if (particle.alive && particle.fade > 0) this._drawParticle(ctx, particle, atmosphereAlpha);
    }
  }

  _drawParticle(ctx, particle, atmosphereAlpha) {
    const rgb = this.hexToRgb(particle.color);
    ctx.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' +
      (particle.opacity * particle.fade * atmosphereAlpha).toFixed(3) + ')';
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }

  cleanArea(x, y, radius) {
    const radiusSquared = radius * radius;
    const clean = particle => {
      if (!particle.alive) return;
      const dx = particle.x - x;
      const dy = particle.y - y;
      if (dx * dx + dy * dy > radiusSquared) return;
      particle.fade = Math.max(0, particle.fade - 0.42);
      if (particle.fade <= 0.03) particle.alive = false;
    };

    this.particles.forEach(clean);
    this.settledParticles.forEach(clean);
    const areaFraction = Math.min(0.05, (Math.PI * radiusSquared) / Math.max(1, this.width * this.height));
    this.filmOpacity = Math.max(0, this.filmOpacity - Math.max(0.012, areaFraction * 5.5));
  }

  cleanAll() {
    for (const particle of this.particles) {
      particle.alive = false;
      particle.fade = 0;
    }
    for (const particle of this.settledParticles) {
      particle.alive = false;
      particle.fade = 0;
    }
    this.filmOpacity = 0;
  }

  isAllCleaned() {
    return this.filmOpacity <= 0.01 &&
      !this.particles.some(particle => particle.alive) &&
      !this.settledParticles.some(particle => particle.alive);
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 132, g: 114, b: 94 };
  }
}

window.__spiderDustSystem = DustSystem;
