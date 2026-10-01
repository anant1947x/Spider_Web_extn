/* ============================================================
   Spider Web & Dust — Crawling Spider Renderer
   Original vector spiders with individually articulated legs.
   The renderer stays sharp at every viewport size and avoids
   a video/image asset that would look soft or block page input.
   ============================================================ */

class SpiderRenderer {
  constructor(settings) {
    this.settings = settings;
    this.spiders = [];
    this.width = 0;
    this.height = 0;
    this.scrollMotion = 0;
    this._id = 0;
    this._baseSeed = this._hashString(this._sceneKey());
    this.reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  _sceneKey() {
    return [
      'spw-global-spider-layout-v4',
      this.settings.webDensity || 'medium',
      this.settings.dustIntensity || 'medium',
      Number(this.settings.spiderCount) || 0
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

  setScrollMotion(impulse) {
    this.scrollMotion = Math.max(-18, Math.min(18, Number(impulse) || 0));
  }

  getDensityConfig() {
    const requested = Number(this.settings.spiderCount);
    if (Number.isFinite(requested) && requested > 0) {
      return Math.max(1, Math.min(6, Math.round(requested)));
    }

    const densityCount = {
      low: 1,
      medium: 2,
      high: 3,
      extreme: 4
    }[this.settings.webDensity] || 2;
    const ageBoost = Math.max(0, Math.min(1, Number(this.settings._ageIntensity) || 0));

    return Math.min(6, densityCount + (ageBoost > 0.82 && this.settings.webDensity === 'extreme' ? 1 : 0));
  }

  generateSpiders() {
    this.destroy();
    if (!this.width || !this.height || this.settings.spiderEnabled === false || this.reducedMotion) return;

    const rng = this._mulberry32(this._baseSeed);
    const count = this.getDensityConfig();

    for (let index = 0; index < count; index++) {
      const spider = this._createSpider(rng, index);
      this.spiders.push(spider);
      document.documentElement.appendChild(spider.element);
    }
  }

  _createSpider(rng, index) {
    const id = 'spw-spider-' + (++this._id);
    const viewportScale = Math.min(this.width, this.height) * 0.108;
    const baseSize = Math.max(58, Math.min(118, viewportScale));
    const size = Math.max(58, Math.min(122, baseSize * (0.86 + rng() * 0.28)));
    const height = size * (150 / 220);
    const element = document.createElement('div');
    const legs = this._getLegLayout();

    element.className = 'spw-spider';
    element.setAttribute('aria-hidden', 'true');
    element.dataset.spwSpider = 'true';
    element.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:' + size.toFixed(1) + 'px',
      'height:' + height.toFixed(1) + 'px',
      'z-index:2147483647',
      'pointer-events:none',
      'opacity:0',
      'will-change:transform,opacity',
      'transform-origin:center center',
      'contain:layout style paint'
    ].join(';');
    [
      ['position', 'fixed'],
      ['top', '0'],
      ['left', '0'],
      ['width', size.toFixed(1) + 'px'],
      ['height', height.toFixed(1) + 'px'],
      ['z-index', '2147483647'],
      ['pointer-events', 'none'],
      ['max-width', 'none'],
      ['max-height', 'none'],
      ['opacity', '0']
    ].forEach(([property, value]) => element.style.setProperty(property, value, 'important'));

    element.innerHTML = this._buildSpiderMarkup(id, legs);

    const legNodes = legs.map((leg, legIndex) => ({
      shadow: element.querySelector('[data-spw-leg-shadow="' + legIndex + '"]'),
      main: element.querySelector('[data-spw-leg-main="' + legIndex + '"]'),
      highlight: element.querySelector('[data-spw-leg-highlight="' + legIndex + '"]'),
      knee: element.querySelector('[data-spw-leg-knee="' + legIndex + '"]'),
      ankle: element.querySelector('[data-spw-leg-ankle="' + legIndex + '"]')
    }));

    const spider = {
      element,
      size,
      height,
      legs,
      legNodes,
      routeIndex: index * 2,
      routeRng: this._mulberry32(this._baseSeed + (index + 1) * 40503),
      path: null,
      cycleStartedAt: 0,
      cycleDuration: 0,
      pauseAt: 0.5,
      entryDuration: 0,
      crawlInDuration: 0,
      pauseDuration: 0,
      crawlOutDuration: 0,
      exitDuration: 0,
      restDuration: 0,
      stepRate: 5.9 + rng() * 1.5,
      legOffset: rng() * Math.PI * 2,
      scrollWeight: 0.58 + rng() * 0.42,
      lastLegFrame: -Infinity,
      fleeing: false
    };

    this._configureCycle(spider, performance.now(), true);
    // Stagger each crawler so a newly opened stale site already feels alive.
    spider.cycleStartedAt -= spider.cycleDuration * 1000 * (0.14 + rng() * 0.7);
    return spider;
  }

  _getLegLayout() {
    // Body faces right in its native viewBox. Each leg has three physical
    // segments, then receives a slightly different gait in _legPose().
    return [
      { start: { x: 116, y: 57 }, knee: { x: 84, y: 31 }, ankle: { x: 44, y: 20 }, tip: { x: 17, y: 12 }, phase: 0.2, stride: 5.2, lift: 4.0 },
      { start: { x: 109, y: 65 }, knee: { x: 73, y: 51 }, ankle: { x: 38, y: 51 }, tip: { x: 15, y: 59 }, phase: Math.PI + 0.8, stride: 4.6, lift: 3.4 },
      { start: { x: 109, y: 81 }, knee: { x: 72, y: 86 }, ankle: { x: 41, y: 100 }, tip: { x: 17, y: 113 }, phase: 1.1, stride: 5.0, lift: 3.8 },
      { start: { x: 116, y: 94 }, knee: { x: 87, y: 112 }, ankle: { x: 65, y: 132 }, tip: { x: 55, y: 146 }, phase: Math.PI + 1.55, stride: 4.1, lift: 3.2 },
      { start: { x: 146, y: 57 }, knee: { x: 169, y: 31 }, ankle: { x: 194, y: 20 }, tip: { x: 211, y: 13 }, phase: Math.PI + 0.25, stride: 5.1, lift: 4.0 },
      { start: { x: 153, y: 65 }, knee: { x: 185, y: 52 }, ankle: { x: 210, y: 54 }, tip: { x: 218, y: 65 }, phase: 0.75, stride: 4.5, lift: 3.4 },
      { start: { x: 153, y: 81 }, knee: { x: 185, y: 87 }, ankle: { x: 211, y: 102 }, tip: { x: 218, y: 117 }, phase: Math.PI + 1.18, stride: 5.0, lift: 3.8 },
      { start: { x: 146, y: 94 }, knee: { x: 168, y: 113 }, ankle: { x: 184, y: 133 }, tip: { x: 192, y: 146 }, phase: 1.72, stride: 4.1, lift: 3.2 }
    ];
  }

  _buildSpiderMarkup(id, legs) {
    const legMarkup = legs.map((leg, index) => {
      const pose = this._legPose(leg, 0, 0.14);
      const d = this._legPathD(pose);
      return [
        '<path class="spw-spider-leg-shadow" data-spw-leg-shadow="' + index + '" d="' + d + '"/>',
        '<path class="spw-spider-leg-main" data-spw-leg-main="' + index + '" d="' + d + '"/>',
        '<path class="spw-spider-leg-highlight" data-spw-leg-highlight="' + index + '" d="' + d + '"/>',
        '<circle class="spw-spider-joint" data-spw-leg-knee="' + index + '" cx="' + pose.knee.x.toFixed(1) + '" cy="' + pose.knee.y.toFixed(1) + '" r="2.15"/>',
        '<circle class="spw-spider-joint spw-spider-joint-small" data-spw-leg-ankle="' + index + '" cx="' + pose.ankle.x.toFixed(1) + '" cy="' + pose.ankle.y.toFixed(1) + '" r="1.7"/>'
      ].join('');
    }).join('');

    return [
      '<svg class="spw-spider-art" viewBox="0 0 220 150" aria-hidden="true" focusable="false">',
      '<defs>',
      '<radialGradient id="' + id + '-abdomen" cx="29%" cy="24%" r="78%">',
      '<stop offset="0%" stop-color="#827179"/>',
      '<stop offset="14%" stop-color="#4a3a42"/>',
      '<stop offset="43%" stop-color="#20191f"/>',
      '<stop offset="78%" stop-color="#08070a"/>',
      '<stop offset="100%" stop-color="#020203"/>',
      '</radialGradient>',
      '<radialGradient id="' + id + '-thorax" cx="31%" cy="22%" r="82%">',
      '<stop offset="0%" stop-color="#726069"/>',
      '<stop offset="17%" stop-color="#352b31"/>',
      '<stop offset="57%" stop-color="#120f13"/>',
      '<stop offset="100%" stop-color="#020203"/>',
      '</radialGradient>',
      '<linearGradient id="' + id + '-leg" x1="0%" y1="0%" x2="100%" y2="100%">',
      '<stop offset="0%" stop-color="#5c5056"/>',
      '<stop offset="18%" stop-color="#211b20"/>',
      '<stop offset="68%" stop-color="#08080a"/>',
      '<stop offset="100%" stop-color="#010102"/>',
      '</linearGradient>',
      '<radialGradient id="' + id + '-mark" cx="38%" cy="22%" r="84%">',
      '<stop offset="0%" stop-color="#d93632"/>',
      '<stop offset="48%" stop-color="#7e0b13"/>',
      '<stop offset="100%" stop-color="#340307"/>',
      '</radialGradient>',
      '<filter id="' + id + '-shadow" x="-25%" y="-35%" width="170%" height="200%">',
      '<feDropShadow dx="2.6" dy="4.3" stdDeviation="2.7" flood-color="#000000" flood-opacity="0.78"/>',
      '<feDropShadow dx="-0.45" dy="-0.65" stdDeviation="0.55" flood-color="#eadde1" flood-opacity="0.19"/>',
      '</filter>',
      '</defs>',
      '<g filter="url(#' + id + '-shadow)">',
      '<g class="spw-spider-legs">', legMarkup, '</g>',
      '<ellipse class="spw-spider-abdomen" cx="106" cy="76" rx="39" ry="33" fill="url(#' + id + '-abdomen)" stroke="#a8939c" stroke-opacity="0.19" stroke-width="1.05"/>',
      '<ellipse cx="149" cy="76" rx="24" ry="21.5" fill="url(#' + id + '-thorax)" stroke="#95818a" stroke-opacity="0.18" stroke-width="0.8"/>',
      '<path d="M76 59 C88 45 111 42 132 52 C114 48 92 51 80 66 Z" fill="#f8e5eb" opacity="0.12"/>',
      '<path d="M86 55 C95 46 111 46 122 55 C116 56 111 60 106 67 C101 60 95 57 86 55 Z" fill="url(#' + id + '-mark)" opacity="0.72"/>',
      '<path d="M101 69 C107 64 116 67 120 75 C115 75 111 79 107 86 C105 80 101 75 96 72 Z" fill="url(#' + id + '-mark)" opacity="0.56"/>',
      '<path d="M151 58 C166 59 173 67 173 76 C173 85 167 93 154 95 C160 85 160 67 151 58 Z" fill="#050406" opacity="0.78"/>',
      '<path d="M169 74 L180 69 L174 78 L181 83 L168 81 Z" fill="#08070a" opacity="0.9"/>',
      '<path d="M142 60 C153 53 164 60 168 68" fill="none" stroke="#dcc9d0" stroke-opacity="0.16" stroke-width="1.05" stroke-linecap="round"/>',
      '</g>',
      '</svg>'
    ].join('');
  }

  _configureCycle(spider, startedAt, initial) {
    if (!initial) {
      spider.routeIndex += 1 + Math.floor(spider.routeRng() * 3);
    }
    spider.path = this._makePath(spider.routeIndex);
    spider.pauseAt = 0.36 + spider.routeRng() * 0.31;
    spider.entryDuration = 0.7 + spider.routeRng() * 0.42;
    spider.crawlInDuration = 5.1 + spider.routeRng() * 3.7;
    spider.pauseDuration = 1.5 + spider.routeRng() * 2.5;
    spider.crawlOutDuration = 3.5 + spider.routeRng() * 3.0;
    spider.exitDuration = 0.65 + spider.routeRng() * 0.38;
    // Keep density perceptible: a spider only disappears briefly before its
    // next route, rather than leaving an Extreme scene unexpectedly sparse.
    spider.restDuration = 0.45 + spider.routeRng() * 1.15;
    spider.cycleDuration = spider.entryDuration + spider.crawlInDuration + spider.pauseDuration +
      spider.crawlOutDuration + spider.exitDuration + spider.restDuration;
    spider.cycleStartedAt = startedAt;
  }

  _makePath(index) {
    const width = this.width;
    const height = this.height;
    // Shared structural routes make every crawl feel tied to the long
    // wall-to-wall silk, while different routes prevent a repeating loop.
    const paths = [
      { start: { x: 0, y: 0 }, control: { x: width * 0.34, y: height * 0.08 }, end: { x: width, y: height * 0.27 } },
      { start: { x: width, y: 0 }, control: { x: width * 0.62, y: height * 0.13 }, end: { x: 0, y: height * 0.31 } },
      { start: { x: 0, y: height }, control: { x: width * 0.14, y: height * 0.68 }, end: { x: width * 0.23, y: 0 } },
      { start: { x: width, y: height }, control: { x: width * 0.86, y: height * 0.64 }, end: { x: width * 0.77, y: 0 } },
      { start: { x: 0, y: height * 0.64 }, control: { x: width * 0.43, y: height * 0.72 }, end: { x: width, y: height * 0.77 } },
      { start: { x: width, y: height * 0.47 }, control: { x: width * 0.78, y: height * 0.72 }, end: { x: width * 0.67, y: height } },
      { start: { x: 0, y: height * 0.25 }, control: { x: width * 0.2, y: height * 0.52 }, end: { x: width * 0.34, y: height } },
      { start: { x: width * 0.45, y: 0 }, control: { x: width * 0.57, y: height * 0.48 }, end: { x: width * 0.79, y: height } }
    ];
    const path = paths[index % paths.length];
    return {
      start: { ...path.start },
      control: { ...path.control },
      end: { ...path.end }
    };
  }

  _cycleState(spider, currentTime) {
    while (currentTime - spider.cycleStartedAt >= spider.cycleDuration * 1000) {
      this._configureCycle(spider, spider.cycleStartedAt + spider.cycleDuration * 1000, false);
    }

    const elapsed = Math.max(0, currentTime - spider.cycleStartedAt) / 1000;
    let cursor = spider.entryDuration;
    if (elapsed < cursor) {
      const amount = this._easeOutCubic(elapsed / spider.entryDuration);
      return { visible: true, progress: 0.004, opacity: amount * 0.94, activity: 0.42, scale: 0.9 + amount * 0.1 };
    }

    cursor += spider.crawlInDuration;
    if (elapsed < cursor) {
      const amount = this._easeInOutCubic((elapsed - cursor + spider.crawlInDuration) / spider.crawlInDuration);
      return { visible: true, progress: amount * spider.pauseAt, opacity: 0.96, activity: 1, scale: 1, walking: true };
    }

    cursor += spider.pauseDuration;
    if (elapsed < cursor) {
      const idleTime = elapsed - cursor + spider.pauseDuration;
      const drift = Math.sin(idleTime * 1.6 + spider.legOffset) * 0.0022;
      return { visible: true, progress: Math.max(0, Math.min(1, spider.pauseAt + drift)), opacity: 0.96, activity: 0.16, scale: 1.006 };
    }

    cursor += spider.crawlOutDuration;
    if (elapsed < cursor) {
      const amount = this._easeInOutCubic((elapsed - cursor + spider.crawlOutDuration) / spider.crawlOutDuration);
      return {
        visible: true,
        progress: spider.pauseAt + (1 - spider.pauseAt) * amount,
        opacity: 0.96,
        activity: 1,
        scale: 1,
        walking: true
      };
    }

    cursor += spider.exitDuration;
    if (elapsed < cursor) {
      const amount = (elapsed - cursor + spider.exitDuration) / spider.exitDuration;
      return { visible: true, progress: 0.997, opacity: (1 - this._easeInCubic(amount)) * 0.96, activity: 0.56, scale: 1 - amount * 0.11 };
    }

    return { visible: false, progress: 1, opacity: 0, activity: 0 };
  }

  _easeOutCubic(value) {
    return 1 - Math.pow(1 - Math.max(0, Math.min(1, value)), 3);
  }

  _easeInCubic(value) {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * clamped;
  }

  _easeInOutCubic(value) {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped < 0.5
      ? 4 * clamped * clamped * clamped
      : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
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

  _mix(a, b, amount) {
    return {
      x: a.x + (b.x - a.x) * amount,
      y: a.y + (b.y - a.y) * amount
    };
  }

  _legPose(leg, phase, activity) {
    const gait = Math.sin(phase);
    const lift = Math.max(0, Math.sin(phase + 0.38)) * leg.lift * activity;
    const tremor = Math.sin(phase * 1.9 + 0.7) * (0.28 + activity * 0.18);
    const stride = leg.stride * activity;

    return {
      start: { ...leg.start },
      knee: {
        x: leg.knee.x + gait * stride * 0.28,
        y: leg.knee.y - lift * 0.26 + tremor
      },
      ankle: {
        x: leg.ankle.x - gait * stride * 0.43,
        y: leg.ankle.y + lift * 0.34 - tremor * 0.6
      },
      tip: {
        x: leg.tip.x + gait * stride * 0.7,
        y: leg.tip.y - lift + tremor * 0.45
      }
    };
  }

  _legPathD(pose) {
    const c1 = this._mix(pose.start, pose.knee, 0.38);
    const c2 = this._mix(pose.start, pose.knee, 0.82);
    const c3 = this._mix(pose.knee, pose.ankle, 0.35);
    const c4 = this._mix(pose.knee, pose.ankle, 0.79);
    const c5 = this._mix(pose.ankle, pose.tip, 0.38);
    const c6 = this._mix(pose.ankle, pose.tip, 0.84);
    const point = value => value.x.toFixed(1) + ' ' + value.y.toFixed(1);

    return 'M ' + point(pose.start) +
      ' C ' + point(c1) + ' ' + point(c2) + ' ' + point(pose.knee) +
      ' C ' + point(c3) + ' ' + point(c4) + ' ' + point(pose.ankle) +
      ' C ' + point(c5) + ' ' + point(c6) + ' ' + point(pose.tip);
  }

  _updateLegs(spider, currentTime, activity) {
    // Updating at 30fps keeps the gait smooth while remaining negligible on
    // a dense page (at most six spiders × eight SVG paths).
    if (currentTime - spider.lastLegFrame < 32) return;
    spider.lastLegFrame = currentTime;
    const time = currentTime / 1000;
    const cadence = activity > 0.3 ? spider.stepRate : spider.stepRate * 0.36;

    spider.legs.forEach((leg, index) => {
      const pose = this._legPose(leg, time * cadence + leg.phase + spider.legOffset, activity);
      const d = this._legPathD(pose);
      const nodes = spider.legNodes[index];
      if (!nodes) return;

      [nodes.shadow, nodes.main, nodes.highlight].forEach(node => {
        if (node) node.setAttribute('d', d);
      });
      if (nodes.knee) {
        nodes.knee.setAttribute('cx', pose.knee.x.toFixed(1));
        nodes.knee.setAttribute('cy', pose.knee.y.toFixed(1));
      }
      if (nodes.ankle) {
        nodes.ankle.setAttribute('cx', pose.ankle.x.toFixed(1));
        nodes.ankle.setAttribute('cy', pose.ankle.y.toFixed(1));
      }
    });
  }

  update(delta, currentTime) {
    const now = Number.isFinite(currentTime) ? currentTime : performance.now();
    for (const spider of this.spiders) {
      if (spider.fleeing || !spider.element) continue;

      const state = this._cycleState(spider, now);
      if (!state.visible) {
        spider.element.style.setProperty('opacity', '0', 'important');
        continue;
      }

      const point = this._pointAt(spider.path, state.progress);
      const tangent = this._tangentAt(spider.path, state.progress);
      // The artwork faces right, so its body points along the actual route.
      const angle = Math.atan2(tangent.y, tangent.x) * 180 / Math.PI;
      const breathing = Math.sin(now * 0.0037 + spider.legOffset) * 0.012;
      const scrollY = this.reducedMotion ? 0 : this.scrollMotion * 0.07 * spider.scrollWeight;
      const scrollX = this.reducedMotion ? 0 : this.scrollMotion * 0.012 * Math.sin(spider.legOffset);
      const scale = state.scale * (1 + breathing);

      spider.element.style.setProperty('opacity', Math.max(0, Math.min(0.98, state.opacity)).toFixed(3), 'important');
      spider.element.style.setProperty('transform', 'translate3d(' +
        (point.x - spider.size * 0.545 + scrollX).toFixed(2) + 'px,' +
        (point.y - spider.height * 0.5 + scrollY).toFixed(2) + 'px,0) rotate(' +
        angle.toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ')', 'important');
      this._updateLegs(spider, now, state.activity);
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

      if (dx * dx + dy * dy <= (radius + rect.width * 0.34) ** 2) {
        spider.fleeing = true;
        spider.element.classList.add('spw-spider-flee');
        const element = spider.element;
        this.spiders.splice(index, 1);
        setTimeout(() => element.remove(), 650);
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
