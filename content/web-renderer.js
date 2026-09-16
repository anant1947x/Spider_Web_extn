/* ============================================================
   Spider Web & Dust — Procedural Web Renderer
   Generates realistic spider webs in corners and edges.
   ============================================================ */

class WebRenderer {
  constructor(settings) {
    this.settings = settings;
    this.webs = [];
    this.width = 0;
    this.height = 0;
    this.time = 0;
    this.cleanedAreas = []; // { x, y, radius, opacity }
    this.fadeOutWebs = [];  // webs being cleaned
  }

  onResize(w, h) {
    this.width = w;
    this.height = h;
    this.generateWebs();
  }

  getDensityConfig() {
    const configs = {
      low:     { cornerWebs: 2, strandSets: 1, maxSpokes: 8,  webScale: 0.7 },
      medium:  { cornerWebs: 3, strandSets: 2, maxSpokes: 12, webScale: 1.0 },
      high:    { cornerWebs: 4, strandSets: 3, maxSpokes: 16, webScale: 1.2 },
      extreme: { cornerWebs: 4, strandSets: 5, maxSpokes: 20, webScale: 1.4 }
    };
    return configs[this.settings.webDensity] || configs.medium;
  }

  generateWebs() {
    this.webs = [];
    if (!this.width || !this.height) return;

    const cfg = this.getDensityConfig();
    const w = this.width;
    const h = this.height;

    // Corner positions: [anchorX, anchorY, startAngle, endAngle]
    const corners = [
      { x: 0, y: 0, startAngle: 0, endAngle: Math.PI / 2 },           // top-left
      { x: w, y: 0, startAngle: Math.PI / 2, endAngle: Math.PI },      // top-right
      { x: 0, y: h, startAngle: -Math.PI / 2, endAngle: 0 },           // bottom-left
      { x: w, y: h, startAngle: Math.PI, endAngle: 3 * Math.PI / 2 }   // bottom-right
    ];

    // Shuffle and pick corners
    const shuffled = corners.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, cfg.cornerWebs);

    for (const corner of picked) {
      this.webs.push(this.createCornerWeb(corner, cfg));
    }

    // Add strand webs along edges
    for (let i = 0; i < cfg.strandSets; i++) {
      this.webs.push(...this.createStrandWebs());
    }

    // Add small hanging webs
    if (cfg.strandSets > 1) {
      this.webs.push(...this.createHangingWebs(cfg));
    }
  }

  createCornerWeb(corner, cfg) {
    const baseSize = Math.min(this.width, this.height) * 0.15 * cfg.webScale;
    const size = baseSize * (0.8 + Math.random() * 0.4);
    const spokeCount = Math.floor(cfg.maxSpokes * 0.6 + Math.random() * cfg.maxSpokes * 0.4);
    const spiralCount = Math.floor(4 + Math.random() * 6);

    // Generate spokes
    const spokes = [];
    const angleRange = corner.endAngle - corner.startAngle;

    for (let i = 0; i < spokeCount; i++) {
      const t = i / (spokeCount - 1);
      const angle = corner.startAngle + t * angleRange;
      // Add slight randomness to spoke angles
      const jitter = (Math.random() - 0.5) * 0.08;
      const spokeLength = size * (0.7 + Math.random() * 0.3);

      spokes.push({
        angle: angle + jitter,
        length: spokeLength,
        endX: corner.x + Math.cos(angle + jitter) * spokeLength,
        endY: corner.y + Math.sin(angle + jitter) * spokeLength,
        swayPhase: Math.random() * Math.PI * 2,
        swayAmount: 0.5 + Math.random() * 1.5
      });
    }

    // Generate spiral connections
    const spirals = [];
    for (let s = 1; s <= spiralCount; s++) {
      const t = s / (spiralCount + 1);
      const radius = size * t;
      const points = [];

      for (let i = 0; i < spokeCount; i++) {
        const spoke = spokes[i];
        const dist = Math.min(radius, spoke.length) * (0.9 + Math.random() * 0.2);
        points.push({
          x: corner.x + Math.cos(spoke.angle) * dist,
          y: corner.y + Math.sin(spoke.angle) * dist,
          swayPhase: Math.random() * Math.PI * 2,
          swayAmount: 0.3 + Math.random() * 1.0
        });
      }
      spirals.push(points);
    }

    return {
      type: 'corner',
      corner,
      spokes,
      spirals,
      size,
      opacity: 0.25 + Math.random() * 0.35,
      fadeIn: 0,      // for entrance animation
      fadeOut: 1       // for cleaning animation
    };
  }

  createStrandWebs() {
    const strands = [];
    const count = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count; i++) {
      const edge = Math.floor(Math.random() * 4); // 0:top 1:right 2:bottom 3:left
      let startX, startY, endX, endY;

      switch (edge) {
        case 0: // top edge to side
          startX = Math.random() * this.width;
          startY = 0;
          endX = Math.random() < 0.5 ? 0 : this.width;
          endY = Math.random() * this.height * 0.4;
          break;
        case 1: // right edge to top/bottom
          startX = this.width;
          startY = Math.random() * this.height;
          endX = this.width - Math.random() * this.width * 0.3;
          endY = Math.random() < 0.5 ? 0 : this.height;
          break;
        case 2: // bottom edge
          startX = Math.random() * this.width;
          startY = this.height;
          endX = Math.random() < 0.5 ? 0 : this.width;
          endY = this.height - Math.random() * this.height * 0.3;
          break;
        case 3: // left edge
          startX = 0;
          startY = Math.random() * this.height;
          endX = Math.random() * this.width * 0.3;
          endY = Math.random() < 0.5 ? 0 : this.height;
          break;
      }

      // Create a sagging strand (catenary curve approximation)
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      const sag = 15 + Math.random() * 30;

      strands.push({
        type: 'strand',
        startX, startY,
        endX, endY,
        midX, midY: midY + sag,
        opacity: 0.15 + Math.random() * 0.2,
        thickness: 0.5 + Math.random() * 0.8,
        swayPhase: Math.random() * Math.PI * 2,
        swayAmount: 1 + Math.random() * 2,
        fadeIn: 0,
        fadeOut: 1
      });
    }

    return strands;
  }

  createHangingWebs(cfg) {
    const webs = [];
    const count = 1 + Math.floor(Math.random() * 2);

    for (let i = 0; i < count; i++) {
      const anchorX = this.width * (0.2 + Math.random() * 0.6);
      const anchorY = 0;
      const hangLength = 40 + Math.random() * 80;
      const spreadAngle = 0.3 + Math.random() * 0.4;
      const threadCount = 3 + Math.floor(Math.random() * 4);

      const threads = [];
      for (let t = 0; t < threadCount; t++) {
        const angle = Math.PI / 2 - spreadAngle + (2 * spreadAngle * t / (threadCount - 1));
        const len = hangLength * (0.7 + Math.random() * 0.3);
        threads.push({
          angle,
          length: len,
          endX: anchorX + Math.cos(angle) * len,
          endY: anchorY + Math.sin(angle) * len,
          swayPhase: Math.random() * Math.PI * 2,
          swayAmount: 1 + Math.random() * 2
        });
      }

      webs.push({
        type: 'hanging',
        anchorX, anchorY,
        threads,
        opacity: 0.2 + Math.random() * 0.2,
        fadeIn: 0,
        fadeOut: 1
      });
    }

    return webs;
  }

  update(delta, currentTime) {
    this.time += delta;

    // Fade in webs
    for (const web of this.webs) {
      if (web.fadeIn < 1) {
        web.fadeIn = Math.min(1, web.fadeIn + delta * 0.5);
      }
    }

    // Process cleaning fade-outs
    this.fadeOutWebs = this.fadeOutWebs.filter(fw => {
      fw.fadeOut -= delta * 1.5;
      return fw.fadeOut > 0;
    });
  }

  render(ctx, w, h) {
    const webColor = this.settings.webColor || '#e0e0e0';
    const rgb = this.hexToRgb(webColor);

    for (const web of this.webs) {
      if (web.fadeOut <= 0) continue;
      const globalAlpha = web.opacity * web.fadeIn * web.fadeOut;

      if (web.type === 'corner') {
        this.renderCornerWeb(ctx, web, rgb, globalAlpha);
      } else if (web.type === 'strand') {
        this.renderStrand(ctx, web, rgb, globalAlpha);
      } else if (web.type === 'hanging') {
        this.renderHangingWeb(ctx, web, rgb, globalAlpha);
      }
    }

    // Render fading-out webs
    for (const web of this.fadeOutWebs) {
      const globalAlpha = web.opacity * web.fadeOut;
      if (web.type === 'corner') {
        this.renderCornerWeb(ctx, web, rgb, globalAlpha);
      } else if (web.type === 'strand') {
        this.renderStrand(ctx, web, rgb, globalAlpha);
      } else if (web.type === 'hanging') {
        this.renderHangingWeb(ctx, web, rgb, globalAlpha);
      }
    }
  }

  renderCornerWeb(ctx, web, rgb, alpha) {
    const { corner, spokes, spirals } = web;
    const t = this.time;

    ctx.save();
    ctx.lineCap = 'round';

    // Draw spokes
    for (const spoke of spokes) {
      const sway = Math.sin(t * 0.8 + spoke.swayPhase) * spoke.swayAmount;
      const endX = spoke.endX + sway;
      const endY = spoke.endY + sway * 0.5;

      ctx.beginPath();
      ctx.moveTo(corner.x, corner.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.7})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Draw spiral connections
    for (let si = 0; si < spirals.length; si++) {
      const points = spirals[si];
      if (points.length < 2) continue;

      ctx.beginPath();
      const sway0 = Math.sin(t * 0.6 + points[0].swayPhase) * points[0].swayAmount;
      ctx.moveTo(points[0].x + sway0, points[0].y + sway0 * 0.5);

      for (let i = 1; i < points.length; i++) {
        const sway = Math.sin(t * 0.6 + points[i].swayPhase) * points[i].swayAmount;
        const px = points[i].x + sway;
        const py = points[i].y + sway * 0.5;

        // Use quadratic curve for smoother spirals
        if (i < points.length - 1) {
          const swayNext = Math.sin(t * 0.6 + points[i + 1].swayPhase) * points[i + 1].swayAmount;
          const nx = points[i + 1].x + swayNext;
          const ny = points[i + 1].y + swayNext * 0.5;
          const cpx = (px + nx) / 2;
          const cpy = (py + ny) / 2;
          ctx.quadraticCurveTo(px, py, cpx, cpy);
        } else {
          ctx.lineTo(px, py);
        }
      }

      const spiralAlpha = alpha * (0.3 + 0.5 * (si / spirals.length));
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${spiralAlpha})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  renderStrand(ctx, strand, rgb, alpha) {
    const t = this.time;
    const sway = Math.sin(t * 0.5 + strand.swayPhase) * strand.swayAmount;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(strand.startX, strand.startY);
    ctx.quadraticCurveTo(
      strand.midX + sway,
      strand.midY + sway * 0.5,
      strand.endX,
      strand.endY
    );
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    ctx.lineWidth = strand.thickness;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  renderHangingWeb(ctx, web, rgb, alpha) {
    const t = this.time;

    ctx.save();
    ctx.lineCap = 'round';

    for (const thread of web.threads) {
      const sway = Math.sin(t * 0.7 + thread.swayPhase) * thread.swayAmount;

      ctx.beginPath();
      ctx.moveTo(web.anchorX, web.anchorY);
      ctx.quadraticCurveTo(
        (web.anchorX + thread.endX) / 2 + sway,
        (web.anchorY + thread.endY) / 2,
        thread.endX + sway,
        thread.endY
      );
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.6})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Connect thread endpoints
    if (web.threads.length > 1) {
      ctx.beginPath();
      const first = web.threads[0];
      const sway0 = Math.sin(t * 0.7 + first.swayPhase) * first.swayAmount;
      ctx.moveTo(first.endX + sway0, first.endY);

      for (let i = 1; i < web.threads.length; i++) {
        const th = web.threads[i];
        const sw = Math.sin(t * 0.7 + th.swayPhase) * th.swayAmount;
        ctx.lineTo(th.endX + sw, th.endY);
      }
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.3})`;
      ctx.lineWidth = 0.4;
      ctx.stroke();
    }

    ctx.restore();
  }

  // Clean area — marks webs overlapping with the cleaned region
  cleanArea(x, y, radius) {
    for (let i = this.webs.length - 1; i >= 0; i--) {
      const web = this.webs[i];
      if (this.webOverlapsCircle(web, x, y, radius)) {
        web.fadeOut = Math.max(0, web.fadeOut - 0.15);
        if (web.fadeOut <= 0.05) {
          this.fadeOutWebs.push({ ...web, fadeOut: 0.3 });
          this.webs.splice(i, 1);
        }
      }
    }
  }

  webOverlapsCircle(web, cx, cy, r) {
    if (web.type === 'corner') {
      const dx = web.corner.x - cx;
      const dy = web.corner.y - cy;
      return Math.sqrt(dx * dx + dy * dy) < r + web.size;
    } else if (web.type === 'strand') {
      // Check distance from circle center to strand midpoint
      const dx = web.midX - cx;
      const dy = web.midY - cy;
      return Math.sqrt(dx * dx + dy * dy) < r + 50;
    } else if (web.type === 'hanging') {
      const dx = web.anchorX - cx;
      const dy = web.anchorY - cy;
      return Math.sqrt(dx * dx + dy * dy) < r + 60;
    }
    return false;
  }

  isAllCleaned() {
    return this.webs.length === 0 && this.fadeOutWebs.length === 0;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 224, g: 224, b: 224 };
  }
}

window.__spiderWebRenderer = WebRenderer;
