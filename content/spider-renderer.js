/* ============================================================
   Spider Web & Dust — Crawling Spider Renderer
   An original black-widow-inspired SVG crawler: glossy body,
   long articulated legs, a dark-red dorsal mark, and subtle
   limb movement. It stays crisp without shipping a heavy video.
   ============================================================ */

class SpiderRenderer {
  constructor(settings) {
    this.settings = settings;
    this.spiders = [];
    this.width = 0;
    this.height = 0;
    this._id = 0;
    this._baseSeed = this._hashString(this._sceneKey());
    this.reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  _sceneKey() {
    return [
      'spw-global-spider-layout-v3',
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
    return Math.abs(hash) || 91;
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
    this.generateSpiders();
  }

  getDensityConfig() {
    return {
      low: 1,
      medium: 1,
      high: 2,
      extreme: 2
    }[this.settings.webDensity] || 1;
  }

  generateSpiders() {
    this.destroy();
    if (!this.width || !this.height || this.settings.spiderEnabled === false || this.reducedMotion) return;

    const rng = this._mulberry32(this._baseSeed);
    const ageBoost = Math.max(0, Math.min(1, Number(this.settings._ageIntensity) || 0));
    const count = this.getDensityConfig() +
      (ageBoost > 0.82 && this.settings.webDensity === 'extreme' ? 1 : 0);

    for (let index = 0; index < count; index++) {
      const spider = this._createSpider(rng, index);
      this.spiders.push(spider);
      document.documentElement.appendChild(spider.element);
    }
  }

  _createSpider(rng, index) {
    const id = 'spw-spider-' + (++this._id);
    // Previously 34–58 px. This feels present without becoming an obstruction.
    const size = 74 + rng() * 18;
    const element = document.createElement('div');
    element.className = 'spw-spider';
    element.setAttribute('aria-hidden', 'true');
    element.dataset.spwSpider = 'true';
    element.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:' + size.toFixed(1) + 'px',
      'height:' + (size * 0.76).toFixed(1) + 'px',
      'z-index:2147483647',
      'pointer-events:none',
      'opacity:0',
      'will-change:transform,opacity',
      'transform-origin:center center',
      '--spw-leg-rate:' + (500 + rng() * 120).toFixed(0) + 'ms'
    ].join(';');

    element.innerHTML = [
      '<svg class="spw-spider-art" viewBox="0 0 160 120" aria-hidden="true" focusable="false">',
      '<defs>',
      '<radialGradient id="' + id + '-abdomen" cx="31%" cy="25%" r="76%">',
      '<stop offset="0%" stop-color="#807276"/>',
      '<stop offset="18%" stop-color="#3a3035"/>',
      '<stop offset="56%" stop-color="#141116"/>',
      '<stop offset="100%" stop-color="#030304"/>',
      '</radialGradient>',
      '<radialGradient id="' + id + '-thorax" cx="32%" cy="23%" r="78%">',
      '<stop offset="0%" stop-color="#726166"/>',
      '<stop offset="20%" stop-color="#30272c"/>',
      '<stop offset="64%" stop-color="#110f12"/>',
      '<stop offset="100%" stop-color="#030304"/>',
      '</radialGradient>',
      '<linearGradient id="' + id + '-mark" x1="0%" y1="0%" x2="100%" y2="100%">',
      '<stop offset="0%" stop-color="#ff4a3d"/>',
      '<stop offset="38%" stop-color="#a70d17"/>',
      '<stop offset="100%" stop-color="#4e050a"/>',
      '</linearGradient>',
      '<filter id="' + id + '-shadow" x="-35%" y="-45%" width="190%" height="205%">',
      '<feDropShadow dx="2.4" dy="4" stdDeviation="2.8" flood-color="#000000" flood-opacity="0.76"/>',
      '<feDropShadow dx="-0.45" dy="-0.6" stdDeviation="0.65" flood-color="#f2dce2" flood-opacity="0.22"/>',
      '</filter>',
      '</defs>',
      '<g filter="url(#' + id + '-shadow)">',
      '<g class="spw-spider-legs">',
      '<path class="spw-spider-leg spw-leg-1" d="M81 49 C64 30 48 22 29 21 C20 20 14 15 15 10"/>',
      '<path class="spw-spider-leg spw-leg-2" d="M85 54 C58 43 38 43 20 49 C13 51 7 48 8 43"/>',
      '<path class="spw-spider-leg spw-leg-3" d="M86 61 C57 62 38 71 22 84 C16 89 9 86 10 80"/>',
      '<path class="spw-spider-leg spw-leg-4" d="M88 68 C67 82 56 97 54 111 C53 117 47 118 45 112"/>',
      '<path class="spw-spider-leg spw-leg-5" d="M101 49 C117 30 132 22 149 21 C155 20 159 15 157 10"/>',
      '<path class="spw-spider-leg spw-leg-6" d="M104 54 C127 43 143 43 157 49 C161 51 163 48 161 43"/>',
      '<path class="spw-spider-leg spw-leg-7" d="M104 61 C129 62 145 71 157 84 C162 89 168 86 166 80"/>',
      '<path class="spw-spider-leg spw-leg-8" d="M101 68 C119 82 128 97 130 111 C131 117 137 118 139 112"/>',
      '</g>',
      '<ellipse cx="79" cy="60" rx="31" ry="26.5" fill="url(#' + id + '-abdomen)"/>',
      '<ellipse cx="106" cy="60" rx="19" ry="17.5" fill="url(#' + id + '-thorax)"/>',
      '<path d="M62 44 C76 34 94 35 102 44 C91 41 76 42 65 50 Z" fill="#d9c6ce" opacity="0.12"/>',
      '<path d="M79 41 C87 39 96 44 99 51 C94 49 89 50 85 54 C82 50 78 47 73 45 Z" fill="url(#' + id + '-mark)" opacity="0.9"/>',
      '<path d="M82 62 C89 57 95 60 98 68 C93 66 88 67 84 73 C82 69 78 66 74 64 Z" fill="url(#' + id + '-mark)" opacity="0.72"/>',
      '<path d="M109 46 C116 50 121 55 122 60 C120 67 115 72 109 75 C113 66 113 55 109 46 Z" fill="#0a090b"/>',
      '<circle cx="119" cy="55" r="1.15" fill="#b51c24" opacity="0.55"/>',
      '<circle cx="119" cy="65" r="1.15" fill="#b51c24" opacity="0.55"/>',
      '</g>',
      '</svg>'
    ].join('');

    const path = this._makePath(index);
    return {
      element,
      size,
      path,
      startedAt: performance.now() - rng() * 18000,
      duration: 26 + rng() * 12,
      speedPhase: rng() * Math.PI * 2,
      fleeing: false
    };
  }

  _makePath(index) {
    const width = this.width;
    const height = this.height;
    // These crawl paths follow the same perimeter-anchored structure as the
    // long web filaments, instead of wandering through arbitrary page space.
    const paths = [
      { start: { x: 0, y: 0 }, control: { x: width * 0.34, y: height * 0.08 }, end: { x: width, y: height * 0.27 } },
      { start: { x: width, y: 0 }, control: { x: width * 0.62, y: height * 0.13 }, end: { x: 0, y: height * 0.31 } },
      { start: { x: 0, y: height }, control: { x: width * 0.14, y: height * 0.68 }, end: { x: width * 0.23, y: 0 } },
      { start: { x: width, y: height }, control: { x: width * 0.86, y: height * 0.64 }, end: { x: width * 0.77, y: 0 } }
    ];
    const path = paths[index % paths.length];
    return {
      start: { ...path.start },
      control: { ...path.control },
      end: { ...path.end }
    };
  }

  _pointAt(path, t) {
    const inverse = 1 - t;
    return {
      x: inverse * inverse * path.start.x + 2 * inverse * t * path.control.x + t * t * path.end.x,
      y: inverse * inverse * path.start.y + 2 * inverse * t * path.control.y + t * t * path.end.y
    };
  }

  _tangentAt(path, t) {
    return {
      x: 2 * (1 - t) * (path.control.x - path.start.x) + 2 * t * (path.end.x - path.control.x),
      y: 2 * (1 - t) * (path.control.y - path.start.y) + 2 * t * (path.end.y - path.control.y)
    };
  }

  update(delta, currentTime) {
    for (const spider of this.spiders) {
      if (spider.fleeing || !spider.element) continue;

      const cycle = ((currentTime - spider.startedAt) / 1000 / spider.duration) % 1;
      const activeStart = 0.08;
      const activeEnd = 0.92;
      const active = cycle >= activeStart && cycle <= activeEnd;
      const progress = Math.max(0, Math.min(1, (cycle - activeStart) / (activeEnd - activeStart)));
      const point = this._pointAt(spider.path, progress);
      const tangent = this._tangentAt(spider.path, progress);
      // The SVG body faces left in its natural drawing orientation.
      const angle = Math.atan2(tangent.y, tangent.x) * 180 / Math.PI + 180;
      const bob = Math.sin(currentTime * 0.016 + spider.speedPhase) * 0.45;
      const scale = 0.96 + Math.sin(currentTime * 0.009 + spider.speedPhase) * 0.018;

      spider.element.style.opacity = active ? '0.96' : '0';
      spider.element.style.transform = 'translate3d(' +
        (point.x - spider.size * 0.5).toFixed(2) + 'px,' +
        (point.y - spider.size * 0.38 + bob).toFixed(2) + 'px,0) rotate(' +
        angle.toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ')';
    }
  }

  cleanArea(x, y, radius) {
    for (let index = this.spiders.length - 1; index >= 0; index--) {
      const spider = this.spiders[index];
      const rect = spider.element.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= (radius + rect.width * 0.35) ** 2) {
        spider.fleeing = true;
        spider.element.classList.add('spw-spider-flee');
        const element = spider.element;
        this.spiders.splice(index, 1);
        setTimeout(() => element.remove(), 420);
      }
    }
  }

  cleanAll() {
    for (const spider of this.spiders) {
      if (spider.element) spider.element.remove();
    }
    this.spiders = [];
  }

  isAllCleaned() {
    return this.spiders.length === 0;
  }

  destroy() {
    this.cleanAll();
  }
}

window.__spiderSpiderRenderer = SpiderRenderer;
