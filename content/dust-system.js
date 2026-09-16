/* ============================================================
   Spider Web & Dust — Dust Particle System
   Floating dust motes with drift, settle, and film effects.
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
  }

  onResize(w, h) {
    this.width = w;
    this.height = h;
    this.generateParticles();
  }

  getParticleCount() {
    const counts = { low: 40, medium: 90, high: 180 };
    return counts[this.settings.dustIntensity] || counts.medium;
  }

  getSettledCount() {
    const counts = { low: 15, medium: 35, high: 60 };
    return counts[this.settings.dustIntensity] || counts.medium;
  }

  generateParticles() {
    this.particles = [];
    this.settledParticles = [];

    const count = this.getParticleCount();
    const settledCount = this.getSettledCount();

    // Floating particles
    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle());
    }

    // Settled particles (along edges and corners)
    for (let i = 0; i < settledCount; i++) {
      this.settledParticles.push(this.createSettledParticle());
    }

    // Set film opacity based on intensity
    const filmLevels = { low: 0.02, medium: 0.04, high: 0.07 };
    this.filmOpacity = filmLevels[this.settings.dustIntensity] || 0.04;
  }

  createParticle() {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      size: 1 + Math.random() * 3,
      opacity: 0.15 + Math.random() * 0.45,
      vx: (Math.random() - 0.5) * 0.3,
      vy: 0.1 + Math.random() * 0.4,          // slow downward drift
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.5 + Math.random() * 1.5,
      wobbleAmount: 0.3 + Math.random() * 0.8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.5,
      shape: Math.random() < 0.3 ? 'elongated' : 'round',
      alive: true,
      fadeOut: 1
    };
  }

  createSettledParticle() {
    // Cluster around corners and edges
    let x, y;
    const zone = Math.random();

    if (zone < 0.3) {
      // Corners
      const corner = Math.floor(Math.random() * 4);
      x = corner % 2 === 0 ? Math.random() * 80 : this.width - Math.random() * 80;
      y = corner < 2 ? Math.random() * 80 : this.height - Math.random() * 80;
    } else if (zone < 0.6) {
      // Top edge
      x = Math.random() * this.width;
      y = Math.random() * 15;
    } else if (zone < 0.8) {
      // Bottom edge
      x = Math.random() * this.width;
      y = this.height - Math.random() * 10;
    } else {
      // Side edges
      x = Math.random() < 0.5 ? Math.random() * 10 : this.width - Math.random() * 10;
      y = Math.random() * this.height;
    }

    return {
      x, y,
      size: 1.5 + Math.random() * 3,
      opacity: 0.2 + Math.random() * 0.3,
      rotation: Math.random() * Math.PI * 2,
      shape: Math.random() < 0.4 ? 'elongated' : 'round',
      alive: true,
      fadeOut: 1
    };
  }

  update(delta) {
    this.time += delta;

    for (const p of this.particles) {
      if (!p.alive) continue;

      // Wobble (pseudo-perlin)
      const wobble = Math.sin(this.time * p.wobbleSpeed + p.wobblePhase) * p.wobbleAmount;

      p.x += (p.vx + wobble * 0.5) * delta * 60;
      p.y += p.vy * delta * 60;
      p.rotation += p.rotationSpeed * delta;

      // Wrap around
      if (p.y > this.height + 10) {
        p.y = -10;
        p.x = Math.random() * this.width;
      }
      if (p.x < -10) p.x = this.width + 10;
      if (p.x > this.width + 10) p.x = -10;
    }
  }

  render(ctx, w, h) {
    const dustColor = this.settings.particleColor || '#b8b8b8';
    const rgb = this.hexToRgb(dustColor);

    // Draw dusty film overlay (very subtle corner darkening)
    this.renderDustFilm(ctx, w, h, rgb);

    // Draw settled particles
    for (const p of this.settledParticles) {
      if (!p.alive || p.fadeOut <= 0) continue;
      this.renderParticle(ctx, p, rgb);
    }

    // Draw floating particles
    for (const p of this.particles) {
      if (!p.alive || p.fadeOut <= 0) continue;
      this.renderParticle(ctx, p, rgb);
    }
  }

  renderDustFilm(ctx, w, h, rgb) {
    if (this.filmOpacity <= 0) return;

    // Corner gradients (dusty film accumulation)
    const corners = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: 0, y: h },
      { x: w, y: h }
    ];

    for (const corner of corners) {
      const gradient = ctx.createRadialGradient(
        corner.x, corner.y, 0,
        corner.x, corner.y, Math.min(w, h) * 0.25
      );
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${this.filmOpacity})`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }
  }

  renderParticle(ctx, p, rgb) {
    const alpha = p.opacity * p.fadeOut;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = alpha;

    if (p.shape === 'elongated') {
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 1.5, p.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Clean area — kill particles in the zone
  cleanArea(x, y, radius) {
    const r2 = radius * radius;

    for (const p of this.particles) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < r2) {
        p.fadeOut = Math.max(0, p.fadeOut - 0.2);
        if (p.fadeOut <= 0) p.alive = false;
      }
    }

    for (const p of this.settledParticles) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < r2) {
        p.fadeOut = Math.max(0, p.fadeOut - 0.15);
        if (p.fadeOut <= 0) p.alive = false;
      }
    }

    // Reduce film opacity
    this.filmOpacity = Math.max(0, this.filmOpacity - 0.002);
  }

  isAllCleaned() {
    const floatingAlive = this.particles.some(p => p.alive);
    const settledAlive = this.settledParticles.some(p => p.alive);
    return !floatingAlive && !settledAlive && this.filmOpacity <= 0.005;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 184, g: 184, b: 184 };
  }
}

window.__spiderDustSystem = DustSystem;
