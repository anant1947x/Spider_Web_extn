/* ============================================================
   Spider Web & Dust — Cobweb Renderer
   Detailed transparent cobweb assets plus intentionally
   wall-anchored canvas filaments.
   ============================================================ */

class WebRenderer {
  constructor(settings) {
    this.settings = settings;
    this.webs = [];
    this.width = 0;
    this.height = 0;
    this.time = 0;
    this.reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.cornerAssets = [
      'assets/cobwebs/corner_heavy.png',
      'assets/cobwebs/corner_medium.png',
      'assets/cobwebs/corner_light.png',
      'assets/cobwebs/corner_medium.png'
    ];
    this.clusterAssets = ['assets/cobwebs/cluster.png'];
    this.strandAssets = ['assets/cobwebs/strand.png'];
    this.drapeAssets = ['assets/cobwebs/edge_drape.png'];

    // The scene geometry is extension-wide, not based on a hostname. This
    // makes the same settings read as the same abandoned room on every page.
    this._baseSeed = this._hashString(this._sceneKey());
    this._cleanupOld();
  }

  _sceneKey() {
    return [
      'spw-global-web-layout-v4',
      this.settings.webDensity || 'medium',
      this.settings.dustIntensity || 'medium'
    ].join('::');
  }

  _hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index++) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash) || 42;
  }

  _mulberry32(seed) {
    return function () {
      let value = seed += 0x6D2B79F5;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  _cleanupOld() {
    document.querySelectorAll('.spw-web-asset, [data-spw-web]').forEach(element => element.remove());
  }

  onResize(width, height) {
    this.width = width;
    this.height = height;
    this.generateWebs();
  }

  getDensityConfig() {
    const base = {
      low:     { corners: 2, clusters: 1, drapes: 0, assetStrands: 1, canvasStrands: 2 },
      medium:  { corners: 3, clusters: 2, drapes: 1, assetStrands: 2, canvasStrands: 4 },
      high:    { corners: 3, clusters: 3, drapes: 1, assetStrands: 3, canvasStrands: 6 },
      extreme: { corners: 4, clusters: 4, drapes: 2, assetStrands: 4, canvasStrands: 8 }
    }[this.settings.webDensity] || { corners: 3, clusters: 2, drapes: 1, assetStrands: 2, canvasStrands: 4 };

    const age = Math.max(0, Math.min(1, Number(this.settings._ageIntensity) || 0));
    return {
      ...base,
      // Age subtly deepens opacity but never rearranges a user's chosen scene.
      ageOpacity: age * 0.12
    };
  }

  generateWebs() {
    this.cleanAll();
    this._cleanupOld();
    if (!this.width || !this.height) return;

    const config = this.getDensityConfig();
    const rng = this._mulberry32(this._baseSeed);
    const minDimension = Math.min(this.width, this.height);

    this._generateCornerWebs(rng, config, minDimension);
    this._generateEdgeClusters(rng, config, minDimension);
    this._generateDrapes(rng, config, minDimension);
    this._generateAssetStrands(rng, config);

    for (let index = 0; index < config.canvasStrands; index++) {
      this.webs.push(this._createLongStrand(rng, index, config));
    }
  }

  _generateCornerWebs(rng, config, minDimension) {
    // All four variants are positioned against an actual viewport corner.
    // The old bottom-right safe-offset caused the floating, misaligned asset.
    const corners = [
      { x: 0, y: 0, transform: 'none' },
      { x: this.width, y: 0, transform: 'scaleX(-1)' },
      { x: 0, y: this.height, transform: 'scaleY(-1)' },
      { x: this.width, y: this.height, transform: 'scale(-1,-1)' }
    ];

    corners.slice(0, config.corners).forEach((corner, index) => {
      // Slightly bigger at every density while retaining a readable centre.
      const size = minDimension * (0.285 + rng() * 0.095);
      const x = corner.x === this.width ? this.width - size : 0;
      const y = corner.y === this.height ? this.height - size : 0;

      this._placeAsset(this.cornerAssets[index], {
        x,
        y,
        width: size,
        height: size,
        transform: corner.transform,
        opacity: 0.59 + rng() * 0.12 + config.ageOpacity,
        phase: rng() * Math.PI * 2,
        label: 'corner web'
      });
    });
  }

  _generateEdgeClusters(rng, config, minDimension) {
    // Stable edge slots make clusters visibly attached to the room boundary.
    const slots = [
      { edge: 'top', at: 0.26, rotation: 8 },
      { edge: 'right', at: 0.34, rotation: 92 },
      { edge: 'left', at: 0.58, rotation: -86 },
      { edge: 'bottom', at: 0.68, rotation: 176 },
      { edge: 'top', at: 0.73, rotation: -8 }
    ];

    for (let index = 0; index < config.clusters; index++) {
      const size = minDimension * (0.18 + rng() * 0.08);
      const slot = slots[index % slots.length];
      let x = 0;
      let y = 0;

      if (slot.edge === 'top') {
        x = this.width * slot.at - size * 0.5;
        y = -size * 0.18;
      } else if (slot.edge === 'right') {
        x = this.width - size * 0.78;
        y = this.height * slot.at - size * 0.5;
      } else if (slot.edge === 'bottom') {
        x = this.width * slot.at - size * 0.5;
        y = this.height - size * 0.78;
      } else {
        x = -size * 0.22;
        y = this.height * slot.at - size * 0.5;
      }

      this._placeAsset(this.clusterAssets[index % this.clusterAssets.length], {
        x,
        y,
        width: size,
        height: size,
        transform: 'rotate(' + slot.rotation + 'deg)',
        opacity: 0.4 + rng() * 0.12 + config.ageOpacity,
        phase: rng() * Math.PI * 2,
        label: 'edge cobweb'
      });
    }
  }

  _generateDrapes(rng, config, minDimension) {
    const slots = [
      { at: 0.35, transform: 'rotate(4deg)' },
      { at: 0.68, transform: 'scaleX(-1) rotate(-4deg)' }
    ];

    for (let index = 0; index < config.drapes; index++) {
      const size = minDimension * (0.29 + rng() * 0.1);
      const slot = slots[index % slots.length];
      const x = Math.max(0, Math.min(this.width - size, this.width * slot.at - size * 0.5));

      this._placeAsset(this.drapeAssets[index % this.drapeAssets.length], {
        x,
        y: -size * 0.1,
        width: size,
        height: size,
        transform: slot.transform,
        opacity: 0.42 + rng() * 0.1 + config.ageOpacity,
        phase: rng() * Math.PI * 2,
        label: 'hanging cobweb'
      });
    }
  }

  _generateAssetStrands(rng, config) {
    for (let index = 0; index < config.assetStrands; index++) {
      const width = this.width * (0.38 + rng() * 0.1);
      const height = Math.min(this.height * 0.27, width * 0.39);
      const slots = [
        { x: -width * 0.08, y: -height * 0.16, transform: 'rotate(7deg)' },
        { x: this.width - width * 0.92, y: -height * 0.16, transform: 'scaleX(-1) rotate(-7deg)' },
        { x: -width * 0.36, y: this.height * 0.46 - height * 0.5, transform: 'rotate(86deg)' },
        { x: this.width - width * 0.64, y: this.height * 0.56 - height * 0.5, transform: 'rotate(-86deg)' }
      ];
      const slot = slots[index % slots.length];

      this._placeAsset(this.strandAssets[index % this.strandAssets.length], {
        x: slot.x,
        y: slot.y,
        width,
        height,
        transform: slot.transform,
        opacity: 0.25 + rng() * 0.09 + config.ageOpacity,
        phase: rng() * Math.PI * 2,
        label: 'wall-anchored cobweb strand'
      });
    }
  }

  _getStrandBlueprints() {
    const width = this.width;
    const height = this.height;

    // Every endpoint lies on a screen edge or a screen corner. This is the
    // structural difference that makes long threads feel connected to walls.
    return [
      { start: { x: 0, y: 0 }, control: { x: width * 0.34, y: height * 0.08 }, end: { x: width, y: height * 0.27 }, dual: true },
      { start: { x: width, y: 0 }, control: { x: width * 0.62, y: height * 0.13 }, end: { x: 0, y: height * 0.31 }, dual: false },
      { start: { x: 0, y: height }, control: { x: width * 0.14, y: height * 0.68 }, end: { x: width * 0.23, y: 0 }, dual: true },
      { start: { x: width, y: height }, control: { x: width * 0.86, y: height * 0.64 }, end: { x: width * 0.77, y: 0 }, dual: false },
      { start: { x: 0, y: height * 0.64 }, control: { x: width * 0.43, y: height * 0.72 }, end: { x: width, y: height * 0.77 }, dual: true },
      { start: { x: width, y: height * 0.47 }, control: { x: width * 0.78, y: height * 0.72 }, end: { x: width * 0.67, y: height }, dual: false },
      { start: { x: 0, y: height * 0.25 }, control: { x: width * 0.2, y: height * 0.52 }, end: { x: width * 0.34, y: height }, dual: true },
      { start: { x: width * 0.45, y: 0 }, control: { x: width * 0.57, y: height * 0.48 }, end: { x: width * 0.79, y: height }, dual: false }
    ];
  }

  _createLongStrand(rng, index, config) {
    const blueprints = this._getStrandBlueprints();
    const blueprint = blueprints[index % blueprints.length];
    const path = {
      start: { ...blueprint.start },
      control: { ...blueprint.control },
      end: { ...blueprint.end }
    };
    const separation = 5 + rng() * 2.8;

    return {
      type: 'strand',
      ...path,
      dualPath: blueprint.dual ? this._createTwinPath(path, separation) : null,
      opacity: 0.11 + rng() * 0.055 + config.ageOpacity,
      thickness: 0.52 + rng() * 0.34,
      phase: rng() * Math.PI * 2,
      fade: 1,
      cleanStrength: 0.46
    };
  }

  _createTwinPath(path, separation) {
    const toward = (from, target, distance) => {
      const dx = target.x - from.x;
      const dy = target.y - from.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      return { x: from.x + dx / length * distance, y: from.y + dy / length * distance };
    };
    const dx = path.end.x - path.start.x;
    const dy = path.end.y - path.start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const normal = { x: -dy / length * separation * 0.38, y: dx / length * separation * 0.38 };

    return {
      start: toward(path.start, path.control, separation),
      control: { x: path.control.x + normal.x, y: path.control.y + normal.y },
      end: toward(path.end, path.control, separation)
    };
  }

  _placeAsset(asset, options) {
    const element = document.createElement('img');
    const colors = this.settings._adaptiveColors || {};
    const darkSite = Boolean(colors.isDark);
    const tint = darkSite
      ? 'brightness(1.2) sepia(0.24) saturate(0.82) contrast(1.04)'
      : 'brightness(0.48) sepia(0.45) saturate(0.85) contrast(1.14)';
    const shadow = colors.webShadowColor || 'rgba(0,0,0,0.65)';
    const highlight = colors.webHighlightColor || 'rgba(255,250,240,0.2)';

    element.src = chrome.runtime.getURL(asset);
    element.className = 'spw-web-asset';
    element.dataset.spwWeb = options.label;
    element.alt = '';
    element.draggable = false;
    element.setAttribute('aria-hidden', 'true');
    element.style.cssText = [
      'position:fixed',
      'left:' + options.x.toFixed(1) + 'px',
      'top:' + options.y.toFixed(1) + 'px',
      'width:' + options.width.toFixed(1) + 'px',
      'height:' + options.height.toFixed(1) + 'px',
      'object-fit:contain',
      'pointer-events:none',
      'z-index:2147483647',
      'opacity:0',
      'will-change:transform,opacity',
      'transition:opacity 380ms ease-out',
      'mix-blend-mode:' + (darkSite ? 'screen' : 'multiply'),
      'filter:' + tint + ' drop-shadow(3px 5px 7px ' + shadow + ') drop-shadow(-0.5px -0.5px 0.8px ' + highlight + ')',
      'transform:' + (options.transform || 'none'),
      'transform-origin:center center'
    ].join(';');

    document.documentElement.appendChild(element);
    const item = {
      type: 'asset',
      element,
      opacity: Math.min(0.92, options.opacity),
      fade: 1,
      baseTransform: options.transform || 'none',
      phase: options.phase,
      cleanStrength: 0.3
    };
    this.webs.push(item);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (element.isConnected) element.style.opacity = String(item.opacity);
      });
    });
  }

  update(delta) {
    this.time += delta;

    for (const item of this.webs) {
      if (item.type !== 'asset' || !item.element || this.reducedMotion) continue;
      const x = Math.sin(this.time * 0.24 + item.phase) * 0.7;
      const y = Math.cos(this.time * 0.18 + item.phase) * 0.42;
      const base = item.baseTransform === 'none' ? '' : ' ' + item.baseTransform;
      // Translate first so a mirror never reverses the tiny physical sway.
      item.element.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)' + base;
    }
  }

  render(ctx) {
    const colors = this.settings._adaptiveColors || {};
    const rgb = this.hexToRgb(this.settings.webColor || '#d8d0c4');
    const darkSite = Boolean(colors.isDark);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const item of this.webs) {
      if (item.type !== 'strand' || item.fade <= 0) continue;
      const sway = this.reducedMotion ? 0 : Math.sin(this.time * 0.32 + item.phase) * 0.85;
      const alpha = item.opacity * item.fade;
      const shadowAlpha = alpha * (darkSite ? 0.46 : 0.72);

      this._strokeStrand(ctx, item, sway + 1.1, 1.45, 'rgba(10, 7, 5, ' + shadowAlpha + ')', item.thickness * 2.05);
      this._strokeStrand(ctx, item, sway, 0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')', item.thickness);
      this._strokeStrand(ctx, item, sway - 0.35, -0.28, 'rgba(255, 248, 233, ' + (alpha * 0.38) + ')', item.thickness * 0.42);
    }

    ctx.restore();
  }

  _strokeStrand(ctx, item, sway, offsetY, color, width) {
    const drawPath = path => {
      ctx.beginPath();
      ctx.moveTo(path.start.x, path.start.y + offsetY);
      ctx.quadraticCurveTo(
        path.control.x + sway,
        path.control.y + sway * 0.5 + offsetY,
        path.end.x,
        path.end.y + offsetY
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };

    drawPath(item);
    if (item.dualPath) drawPath(item.dualPath);
  }

  cleanArea(x, y, radius) {
    for (let index = this.webs.length - 1; index >= 0; index--) {
      const item = this.webs[index];
      const touched = item.type === 'asset'
        ? this._assetIntersects(item, x, y, radius)
        : this._strandIntersects(item, x, y, radius);

      if (!touched) continue;
      item.fade = Math.max(0, item.fade - item.cleanStrength);

      if (item.element) item.element.style.opacity = String(item.opacity * item.fade);
      if (item.fade <= 0.03) {
        if (item.element) item.element.remove();
        this.webs.splice(index, 1);
      }
    }
  }

  _assetIntersects(item, x, y, radius) {
    const rect = item.element.getBoundingClientRect();
    const closestX = Math.max(rect.left, Math.min(x, rect.right));
    const closestY = Math.max(rect.top, Math.min(y, rect.bottom));
    const dx = x - closestX;
    const dy = y - closestY;
    return dx * dx + dy * dy <= radius * radius;
  }

  _strandIntersects(item, x, y, radius) {
    if (this._distanceToQuadratic(item, x, y) <= radius + item.thickness * 4) return true;
    return Boolean(item.dualPath) &&
      this._distanceToQuadratic(item.dualPath, x, y) <= radius + item.thickness * 4;
  }

  _distanceToQuadratic(path, x, y) {
    let shortest = Infinity;
    let previous = path.start;
    const steps = 22;
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const inverse = 1 - t;
      const current = {
        x: inverse * inverse * path.start.x + 2 * inverse * t * path.control.x + t * t * path.end.x,
        y: inverse * inverse * path.start.y + 2 * inverse * t * path.control.y + t * t * path.end.y
      };
      shortest = Math.min(shortest, this._distanceToSegment(x, y, previous.x, previous.y, current.x, current.y));
      previous = current;
    }
    return shortest;
  }

  _distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  cleanAll() {
    for (const item of this.webs) {
      if (item.element) item.element.remove();
    }
    this.webs = [];
  }

  isAllCleaned() {
    return this.webs.length === 0;
  }

  destroy() {
    this.cleanAll();
    this._cleanupOld();
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 216, g: 208, b: 196 };
  }
}

window.__spiderWebRenderer = WebRenderer;
