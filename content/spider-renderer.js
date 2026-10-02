/* ============================================================
   Spider Web & Dust — Natural Spider Renderer
   Each crawler is a compact hi-DPI canvas rather than a collection of SVG
   paths. This shields the art from arbitrary site CSS and lets every foot
   use a planted-step gait rather than making the spider visually drift.
   ============================================================ */

class SpiderRenderer {
  constructor(settings) {
    this.settings = settings;
    this.spiders = [];
    this.width = 0;
    this.height = 0;
    this.scrollMotion = 0;
    this.sceneTime = 0;
    this._id = 0;
    // Do not include hostname: one extension setting has one visual identity
    // regardless of the page the user happens to visit.
    this._baseSeed = this._hashString(this._sceneKey());
    this.reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  _sceneKey() {
    return [
      'spw-natural-spider-layout-v5',
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

  _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  _lerp(a, b, amount) {
    return a + (b - a) * amount;
  }

  _fract(value) {
    return value - Math.floor(value);
  }

  onResize(width, height) {
    this.width = width;
    this.height = height;
    this.generateSpiders();
  }

  // Webs flex a little during scroll. Spiders stay planted: moving them with
  // that impulse was a major reason the old treatment read as floating.
  setScrollMotion(impulse) {
    this.scrollMotion = this._clamp(Number(impulse) || 0, -18, 18);
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
    const ageBoost = this._clamp(Number(this.settings._ageIntensity) || 0, 0, 1);
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
    const viewportScale = Math.min(this.width, this.height) * 0.129;
    // Larger than the prior SVG, yet still a decorative foreground detail.
    const baseSize = this._clamp(viewportScale, 82, 136);
    const size = Math.round(this._clamp(baseSize * (0.9 + rng() * 0.2), 80, 142));
    const height = Math.round(size * 0.76);
    const element = document.createElement('div');
    const canvas = document.createElement('canvas');
    const shadow = element.attachShadow({ mode: 'closed' });

    element.className = 'spw-spider';
    element.setAttribute('aria-hidden', 'true');
    element.dataset.spwSpider = 'true';
    element.style.cssText = [
      'position:fixed', 'top:0', 'left:0',
      'width:' + size + 'px', 'height:' + height + 'px',
      'z-index:2147483647', 'pointer-events:none', 'opacity:0', 'display:block',
      'will-change:transform,opacity', 'transform-origin:center center',
      'contain:layout style paint', 'box-sizing:content-box', 'overflow:visible',
      'border:0', 'margin:0', 'padding:0', 'background:transparent'
    ].join(';');
    [
      ['position', 'fixed'], ['top', '0'], ['left', '0'],
      ['width', size + 'px'], ['height', height + 'px'],
      ['z-index', '2147483647'], ['pointer-events', 'none'], ['display', 'block'],
      ['visibility', 'visible'], ['max-width', 'none'], ['max-height', 'none'],
      ['min-width', '0'], ['min-height', '0'], ['box-sizing', 'content-box'],
      ['border', '0'], ['margin', '0'], ['padding', '0'], ['background', 'transparent'],
      ['clip-path', 'none'], ['filter', 'none'], ['mix-blend-mode', 'normal'],
      ['transform-origin', 'center center'], ['transition', 'opacity 120ms linear'],
      ['animation', 'none'], ['opacity', '0']
    ].forEach(([property, value]) => element.style.setProperty(property, value, 'important'));

    canvas.className = 'spw-spider-art spw-spider-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = [
      'display:block', 'width:100%', 'height:100%', 'max-width:none', 'max-height:none',
      'border:0', 'margin:0', 'padding:0', 'background:transparent', 'pointer-events:none',
      'box-sizing:content-box', 'image-rendering:auto', 'transform-origin:center center',
      'will-change:transform,opacity'
    ].join(';');
    [
      ['display', 'block'], ['width', '100%'], ['height', '100%'],
      ['max-width', 'none'], ['max-height', 'none'], ['border', '0'],
      ['margin', '0'], ['padding', '0'], ['background', 'transparent'],
      ['pointer-events', 'none'], ['box-sizing', 'content-box']
    ].forEach(([property, value]) => canvas.style.setProperty(property, value, 'important'));
    shadow.append(canvas);

    const spider = {
      element,
      canvas,
      ctx: null,
      size,
      height,
      pixelRatio: 1,
      legs: this._getLegLayout(),
      specimen: this._makeSpecimen(rng),
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
      legOffset: rng() * Math.PI * 2,
      gaitTime: rng(),
      cadence: 0.38,
      lastDrawFrame: -Infinity,
      fleeing: false
    };

    this._sizeCanvas(spider);
    this._configureCycle(spider, this.sceneTime, true);
    // A page should feel alive on first load, not have every spider enter
    // together from the same edge.
    spider.cycleStartedAt -= spider.cycleDuration * 1000 * (0.12 + rng() * 0.72);
    return spider;
  }

  _sizeCanvas(spider) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    spider.pixelRatio = ratio;
    spider.canvas.width = Math.max(1, Math.round(spider.size * ratio));
    spider.canvas.height = Math.max(1, Math.round(spider.height * ratio));
    spider.ctx = spider.canvas.getContext('2d', { alpha: true, desynchronized: true });
  }

  _makeSpecimen(rng) {
    const hairs = [];
    for (let index = 0; index < 38; index++) {
      hairs.push({
        angle: rng() * Math.PI * 2,
        reach: 0.32 + rng() * 0.62,
        length: 1.2 + rng() * 3.1,
        opacity: 0.09 + rng() * 0.16
      });
    }
    return {
      warmth: 0.82 + rng() * 0.16,
      hairs,
      eyeTint: 0.2 + rng() * 0.12
    };
  }

  _getLegLayout() {
    // Body faces right in native canvas coordinates. All eight legs originate
    // from the cephalothorax area, not the abdomen, for a natural silhouette.
    return [
      { side: -1, shoulder: { x: 15, y: -7 }, knee: { x: 31, y: -21 }, ankle: { x: 48, y: -25 }, foot: { x: 58, y: -30 }, phase: 0.00, stride: 8.2, lift: 4.4, width: 0.94 },
      { side: -1, shoulder: { x: 9, y: -11 }, knee: { x: 10, y: -31 }, ankle: { x: -7, y: -39 }, foot: { x: -24, y: -42 }, phase: 0.50, stride: 8.7, lift: 4.9, width: 1.00 },
      { side: -1, shoulder: { x: -5, y: -13 }, knee: { x: -25, y: -30 }, ankle: { x: -42, y: -37 }, foot: { x: -55, y: -40 }, phase: 0.08, stride: 7.7, lift: 4.2, width: 1.02 },
      { side: -1, shoulder: { x: -17, y: -8 }, knee: { x: -37, y: -17 }, ankle: { x: -51, y: -25 }, foot: { x: -59, y: -31 }, phase: 0.58, stride: 6.9, lift: 3.8, width: 0.89 },
      { side: 1, shoulder: { x: 15, y: 7 }, knee: { x: 31, y: 21 }, ankle: { x: 48, y: 25 }, foot: { x: 58, y: 30 }, phase: 0.50, stride: 8.2, lift: 4.4, width: 0.94 },
      { side: 1, shoulder: { x: 9, y: 11 }, knee: { x: 10, y: 31 }, ankle: { x: -7, y: 39 }, foot: { x: -24, y: 42 }, phase: 0.00, stride: 8.7, lift: 4.9, width: 1.00 },
      { side: 1, shoulder: { x: -5, y: 13 }, knee: { x: -25, y: 30 }, ankle: { x: -42, y: 37 }, foot: { x: -55, y: 40 }, phase: 0.58, stride: 7.7, lift: 4.2, width: 1.02 },
      { side: 1, shoulder: { x: -17, y: 8 }, knee: { x: -37, y: 17 }, ankle: { x: -51, y: 25 }, foot: { x: -59, y: 31 }, phase: 0.08, stride: 6.9, lift: 3.8, width: 0.89 }
    ];
  }

  _configureCycle(spider, startedAt, initial) {
    if (!initial) spider.routeIndex += 1 + Math.floor(spider.routeRng() * 3);
    spider.path = this._makePath(spider.routeIndex);
    spider.pauseAt = 0.36 + spider.routeRng() * 0.31;
    spider.pathLength = this._pathLength(spider.path);
    spider.entryDuration = 0.7 + spider.routeRng() * 0.42;
    // A spider travels at roughly 22–30 screen pixels per second. Earlier
    // routes crossed a desktop viewport in five seconds, so no leg animation
    // could plausibly keep up and the body looked like it was gliding.
    const crawlSpeed = 22 + spider.routeRng() * 8;
    spider.crawlInDuration = Math.max(7.5, spider.pathLength * spider.pauseAt / crawlSpeed);
    spider.pauseDuration = 1.6 + spider.routeRng() * 2.7;
    spider.crawlOutDuration = Math.max(6.5, spider.pathLength * (1 - spider.pauseAt) / crawlSpeed);
    spider.exitDuration = 0.65 + spider.routeRng() * 0.38;
    spider.restDuration = 0.5 + spider.routeRng() * 1.2;
    spider.cycleDuration = spider.entryDuration + spider.crawlInDuration + spider.pauseDuration +
      spider.crawlOutDuration + spider.exitDuration + spider.restDuration;
    spider.cycleStartedAt = startedAt;
  }

  _makePath(index) {
    const width = this.width;
    const height = this.height;
    // Routes intentionally begin/end at a wall boundary or corner. This keeps
    // the spider visually connected to the edge silk instead of appearing as
    // a random sticker placed over page text.
    const paths = [
      { start: { x: 0, y: 0 }, control: { x: width * 0.34, y: height * 0.08 }, end: { x: width, y: height * 0.27 } },
      { start: { x: width, y: 0 }, control: { x: width * 0.63, y: height * 0.13 }, end: { x: 0, y: height * 0.31 } },
      { start: { x: 0, y: height }, control: { x: width * 0.16, y: height * 0.69 }, end: { x: width * 0.24, y: 0 } },
      { start: { x: width, y: height }, control: { x: width * 0.86, y: height * 0.64 }, end: { x: width * 0.77, y: 0 } },
      { start: { x: 0, y: height * 0.64 }, control: { x: width * 0.41, y: height * 0.71 }, end: { x: width, y: height * 0.77 } },
      { start: { x: width, y: height * 0.47 }, control: { x: width * 0.79, y: height * 0.72 }, end: { x: width * 0.67, y: height } },
      { start: { x: 0, y: height * 0.25 }, control: { x: width * 0.21, y: height * 0.52 }, end: { x: width * 0.34, y: height } },
      { start: { x: width * 0.45, y: 0 }, control: { x: width * 0.57, y: height * 0.48 }, end: { x: width * 0.79, y: height } }
    ];
    const path = paths[index % paths.length];
    return { start: { ...path.start }, control: { ...path.control }, end: { ...path.end } };
  }

  _cycleState(spider, currentTime) {
    while (currentTime - spider.cycleStartedAt >= spider.cycleDuration * 1000) {
      this._configureCycle(spider, spider.cycleStartedAt + spider.cycleDuration * 1000, false);
    }

    const elapsed = Math.max(0, currentTime - spider.cycleStartedAt) / 1000;
    let cursor = spider.entryDuration;
    if (elapsed < cursor) {
      const amount = this._easeOutCubic(elapsed / spider.entryDuration);
      return { visible: true, progress: 0.004, opacity: amount * 0.94, scale: 0.9 + amount * 0.1, walking: false };
    }

    cursor += spider.crawlInDuration;
    if (elapsed < cursor) {
      const phase = (elapsed - cursor + spider.crawlInDuration) / spider.crawlInDuration;
      const amount = this._easeInOutCubic(phase);
      return {
        visible: true,
        progress: amount * spider.pauseAt,
        opacity: 0.96,
        scale: 1,
        walking: true,
        travelFraction: spider.pauseAt,
        travelDuration: spider.crawlInDuration,
        gaitFactor: Math.max(0.28, this._easeInOutCubicVelocity(phase) / 3)
      };
    }

    cursor += spider.pauseDuration;
    if (elapsed < cursor) {
      // No whole-element sinusoidal "idle" movement: only forelegs twitch.
      return { visible: true, progress: spider.pauseAt, opacity: 0.96, scale: 1, walking: false };
    }

    cursor += spider.crawlOutDuration;
    if (elapsed < cursor) {
      const phase = (elapsed - cursor + spider.crawlOutDuration) / spider.crawlOutDuration;
      const amount = this._easeInOutCubic(phase);
      return {
        visible: true,
        progress: spider.pauseAt + (1 - spider.pauseAt) * amount,
        opacity: 0.96,
        scale: 1,
        walking: true,
        travelFraction: 1 - spider.pauseAt,
        travelDuration: spider.crawlOutDuration,
        gaitFactor: Math.max(0.28, this._easeInOutCubicVelocity(phase) / 3)
      };
    }

    cursor += spider.exitDuration;
    if (elapsed < cursor) {
      const amount = (elapsed - cursor + spider.exitDuration) / spider.exitDuration;
      return { visible: true, progress: 0.997, opacity: (1 - this._easeInCubic(amount)) * 0.96, scale: 1 - amount * 0.11, walking: false };
    }

    return { visible: false, progress: 1, opacity: 0, scale: 1, walking: false };
  }

  _easeOutCubic(value) {
    return 1 - Math.pow(1 - this._clamp(value, 0, 1), 3);
  }

  _easeInCubic(value) {
    const clamped = this._clamp(value, 0, 1);
    return clamped * clamped * clamped;
  }

  _easeInOutCubic(value) {
    const clamped = this._clamp(value, 0, 1);
    return clamped < 0.5 ? 4 * clamped * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
  }

  _easeInOutCubicVelocity(value) {
    const clamped = this._clamp(value, 0, 1);
    return clamped < 0.5
      ? 12 * clamped * clamped
      : 3 * Math.pow(-2 * clamped + 2, 2);
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

  _pathLength(path) {
    let total = 0;
    let previous = this._pointAt(path, 0);
    // A small deterministic sample is plenty for cadence, and avoids storing
    // a DOM path simply to calculate its length.
    for (let index = 1; index <= 18; index++) {
      const point = this._pointAt(path, index / 18);
      total += Math.hypot(point.x - previous.x, point.y - previous.y);
      previous = point;
    }
    return total;
  }

  _getCadence(spider, state) {
    if (!state.walking) return 0.38;
    const travelSpeed = (spider.pathLength || this._pathLength(spider.path)) *
      (state.travelFraction || 0) / Math.max(0.1, state.travelDuration || 1);
    const scaleStride = Math.max(14, spider.size * 0.14);
    return this._clamp(
      (travelSpeed / scaleStride) * (state.gaitFactor || 1),
      0.42,
      2.55
    );
  }

  _legPose(spider, leg, currentTime, walking, cadence) {
    const seconds = currentTime / 1000;
    const cycleClock = walking ? spider.gaitTime : seconds * cadence;
    const cycle = this._fract(cycleClock + leg.phase + spider.legOffset / (Math.PI * 2));
    let footOffset = 0;
    let lift = 0;

    if (walking) {
      // Stance: the foot moves front-to-back relative to the body (planted
      // against the screen). Swing: it lifts inward, returns forward, lands.
      if (cycle < 0.62) {
        footOffset = leg.stride * (0.5 - cycle / 0.62);
      } else {
        const swing = (cycle - 0.62) / 0.38;
        footOffset = leg.stride * (-0.5 + swing);
        lift = Math.sin(Math.PI * swing) * leg.lift;
      }
    } else {
      const leading = leg.shoulder.x > 0;
      const twitch = Math.sin(seconds * (leading ? 1.55 : 0.72) + leg.phase * 4 + spider.legOffset);
      footOffset = leading ? twitch * 0.72 : twitch * 0.16;
      lift = leading ? Math.max(0, twitch) * 0.82 : 0;
    }

    const flex = lift * 0.28;
    return {
      shoulder: { ...leg.shoulder },
      knee: { x: leg.knee.x + footOffset * 0.17, y: leg.knee.y - leg.side * flex * 0.26 },
      ankle: { x: leg.ankle.x + footOffset * 0.48, y: leg.ankle.y - leg.side * flex * 0.52 },
      foot: { x: leg.foot.x + footOffset, y: leg.foot.y - leg.side * lift }
    };
  }

  _traceLeg(ctx, pose) {
    ctx.beginPath();
    ctx.moveTo(pose.shoulder.x, pose.shoulder.y);
    ctx.quadraticCurveTo(this._lerp(pose.shoulder.x, pose.knee.x, 0.56), this._lerp(pose.shoulder.y, pose.knee.y, 0.56), pose.knee.x, pose.knee.y);
    ctx.quadraticCurveTo(this._lerp(pose.knee.x, pose.ankle.x, 0.52), this._lerp(pose.knee.y, pose.ankle.y, 0.52), pose.ankle.x, pose.ankle.y);
    ctx.quadraticCurveTo(this._lerp(pose.ankle.x, pose.foot.x, 0.55), this._lerp(pose.ankle.y, pose.foot.y, 0.55), pose.foot.x, pose.foot.y);
  }

  _drawLeg(ctx, pose, leg, specimen) {
    ctx.save();
    ctx.translate(1.25, 1.85);
    this._traceLeg(ctx, pose);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.58)';
    ctx.lineWidth = 5.3 * leg.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    const gradient = ctx.createLinearGradient(pose.shoulder.x, pose.shoulder.y, pose.foot.x, pose.foot.y);
    gradient.addColorStop(0, 'rgba(104, 76, 53, 0.98)');
    gradient.addColorStop(0.24, 'rgba(50, 35, 24, 0.98)');
    gradient.addColorStop(0.72, 'rgba(19, 14, 11, 0.99)');
    gradient.addColorStop(1, 'rgba(5, 4, 3, 0.98)');
    this._traceLeg(ctx, pose);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3.35 * leg.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    this._traceLeg(ctx, pose);
    ctx.strokeStyle = 'rgba(218, 192, 152, ' + (0.105 * specimen.warmth).toFixed(3) + ')';
    ctx.lineWidth = 0.64 * leg.width;
    ctx.stroke();

    [pose.knee, pose.ankle].forEach((joint, jointIndex) => {
      ctx.beginPath();
      ctx.arc(joint.x, joint.y, jointIndex ? 1.68 : 2.04, 0, Math.PI * 2);
      ctx.fillStyle = jointIndex ? '#1b120d' : '#25180f';
      ctx.fill();
      ctx.strokeStyle = 'rgba(207, 170, 124, 0.14)';
      ctx.lineWidth = 0.42;
      ctx.stroke();
    });

    [0.28, 0.63].forEach((amount, bristleIndex) => {
      const from = bristleIndex === 0 ? pose.shoulder : pose.knee;
      const to = bristleIndex === 0 ? pose.knee : pose.ankle;
      const x = this._lerp(from.x, to.x, amount);
      const y = this._lerp(from.y, to.y, amount);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length * leg.side;
      const ny = dx / length * leg.side;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + nx * (2.5 + bristleIndex), y + ny * (2.5 + bristleIndex));
      ctx.strokeStyle = 'rgba(188, 151, 108, 0.16)';
      ctx.lineWidth = 0.48;
      ctx.stroke();
    });
  }

  _drawGroundShadow(ctx) {
    ctx.save();
    ctx.translate(-1.4, 7.2);
    ctx.scale(1, 0.35);
    ctx.beginPath();
    ctx.ellipse(-4, 0, 39, 17, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
    ctx.shadowBlur = 7;
    ctx.fill();
    ctx.restore();
  }

  _drawBody(ctx, spider, currentTime, walking, cadence) {
    const specimen = spider.specimen;
    const seconds = currentTime / 1000;
    const breath = Math.sin(seconds * 2.1 + spider.legOffset) * (walking ? 0.25 : 0.48);
    ctx.save();
    ctx.translate(0, breath);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.68)';
    ctx.shadowBlur = 4.1;
    ctx.shadowOffsetX = 1.2;
    ctx.shadowOffsetY = 2.2;

    const abdomen = ctx.createRadialGradient(-21, -8, 2, -12, 0, 29);
    abdomen.addColorStop(0, 'rgba(139, 103, 69, ' + (0.86 * specimen.warmth).toFixed(3) + ')');
    abdomen.addColorStop(0.18, 'rgba(82, 56, 37, 0.98)');
    abdomen.addColorStop(0.56, 'rgba(36, 24, 16, 0.99)');
    abdomen.addColorStop(1, 'rgba(8, 6, 5, 1)');
    ctx.beginPath();
    ctx.ellipse(-13, 0, 26, 17.1, -0.045, 0, Math.PI * 2);
    ctx.fillStyle = abdomen;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(201, 163, 118, 0.18)';
    ctx.stroke();

    const thorax = ctx.createRadialGradient(13, -7, 1, 18, 0, 18);
    thorax.addColorStop(0, 'rgba(112, 80, 52, 0.9)');
    thorax.addColorStop(0.31, 'rgba(59, 39, 25, 0.99)');
    thorax.addColorStop(0.78, 'rgba(18, 12, 9, 1)');
    thorax.addColorStop(1, 'rgba(4, 3, 2, 1)');
    ctx.beginPath();
    ctx.ellipse(17, 0, 15.2, 12.7, 0.04, 0, Math.PI * 2);
    ctx.fillStyle = thorax;
    ctx.fill();
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = 'rgba(193, 151, 109, 0.15)';
    ctx.stroke();
    ctx.restore();

    // Natural low-key markings and hair, not bright widow-style graphics.
    ctx.save();
    ctx.strokeStyle = 'rgba(12, 8, 6, 0.58)';
    ctx.lineWidth = 1.35;
    ctx.lineCap = 'round';
    [-17, -9, -1].forEach((x, index) => {
      ctx.beginPath();
      ctx.moveTo(x - 4, -6 + index * 0.15);
      ctx.quadraticCurveTo(x, 0, x - 4, 6 - index * 0.15);
      ctx.stroke();
    });
    specimen.hairs.forEach(hair => {
      const rx = Math.cos(hair.angle) * 23 * hair.reach;
      const ry = Math.sin(hair.angle) * 14 * hair.reach;
      const nx = Math.cos(hair.angle);
      const ny = Math.sin(hair.angle);
      ctx.beginPath();
      ctx.moveTo(-13 + rx, ry);
      ctx.lineTo(-13 + rx + nx * hair.length, ry + ny * hair.length);
      ctx.strokeStyle = 'rgba(226, 197, 151, ' + hair.opacity.toFixed(3) + ')';
      ctx.lineWidth = 0.34;
      ctx.stroke();
    });
    ctx.restore();

    [-3.3, 3.3].forEach((y, index) => {
      ctx.beginPath();
      ctx.ellipse(28.2, y, 1.55 - index * 0.08, 1.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#090605';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(28.55, y - 0.22, 0.34, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(193, 161, 104, ' + specimen.eyeTint.toFixed(3) + ')';
      ctx.fill();
    });

    const probe = walking ? Math.sin(spider.gaitTime * Math.PI * 2) * 1.2 : Math.sin(seconds * 1.6) * 0.45;
    [-1, 1].forEach(side => {
      ctx.beginPath();
      ctx.moveTo(27.5, side * 4.7);
      ctx.quadraticCurveTo(33.2, side * (8 + probe * 0.22), 38.3, side * (9.2 + probe * 0.48));
      ctx.strokeStyle = 'rgba(22, 14, 10, 0.96)';
      ctx.lineWidth = 2.35;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(35.6, side * 8.4);
      ctx.lineTo(39.6, side * (11 + probe * 0.48));
      ctx.strokeStyle = 'rgba(164, 126, 84, 0.18)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });
  }

  _drawSpider(spider, currentTime, state) {
    const ctx = spider.ctx;
    if (!ctx) return;
    ctx.setTransform(spider.pixelRatio, 0, 0, spider.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, spider.size, spider.height);
    ctx.save();
    ctx.translate(spider.size / 2, spider.height / 2);
    // Keep a little transparent breathing room around the longest feet and
    // their shadow, so rotations never clip a leg at the canvas edge.
    ctx.scale(spider.size / 140, spider.size / 140);
    this._drawGroundShadow(ctx);
    const cadence = Number.isFinite(spider.cadence)
      ? spider.cadence
      : this._getCadence(spider, state);
    const poses = spider.legs.map(leg => this._legPose(spider, leg, currentTime, Boolean(state.walking), cadence));
    poses.forEach((pose, index) => this._drawLeg(ctx, pose, spider.legs[index], spider.specimen));
    this._drawBody(ctx, spider, currentTime, Boolean(state.walking), cadence);
    ctx.restore();
  }

  update(delta, currentTime) {
    // OverlayCanvas already applies the user's animation-speed preference to
    // delta. A scene-local clock means spider cycles and gait honor it too.
    const elapsed = this._clamp(Number(delta) || 0, 0, 0.1);
    this.sceneTime += elapsed * 1000;
    const now = this.sceneTime;
    for (const spider of this.spiders) {
      if (spider.fleeing || !spider.element) continue;
      const state = this._cycleState(spider, now);
      if (!state.visible) {
        spider.element.style.setProperty('opacity', '0', 'important');
        continue;
      }

      const point = this._pointAt(spider.path, state.progress);
      const tangent = this._tangentAt(spider.path, state.progress);
      const angle = Math.atan2(tangent.y, tangent.x) * 180 / Math.PI;
      const scale = state.scale;
      spider.cadence = this._getCadence(spider, state);
      if (state.walking) spider.gaitTime += elapsed * spider.cadence;
      spider.element.style.setProperty('opacity', this._clamp(state.opacity, 0, 0.98).toFixed(3), 'important');
      // Explicit true-centre pivot fixes the prior size*.545 alignment bug.
      spider.element.style.setProperty('transform', 'translate3d(' +
        (point.x - spider.size * 0.5).toFixed(2) + 'px,' +
        (point.y - spider.height * 0.5).toFixed(2) + 'px,0) rotate(' +
        angle.toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ')', 'important');

      // Six small canvases at 40fps are cheap, and the visibly continuous
      // gait is worth more than the SVG attribute churn it replaces.
      if (now - spider.lastDrawFrame >= 25) {
        spider.lastDrawFrame = now;
        this._drawSpider(spider, now, state);
      }
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
        // Keep the flee motion local to the isolated canvas. Web Animations
        // does not depend on page stylesheets or a site's CSP accepting an
        // injected <style> tag.
        if (typeof spider.canvas?.animate === 'function') {
          spider.canvas.animate([
            { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
            { opacity: 0.88, transform: 'translate3d(16px, -10px, 0) scale(0.93)', offset: 0.58 },
            { opacity: 0, transform: 'translate3d(42px, -30px, 0) scale(0.66)' }
          ], {
            duration: 620,
            easing: 'cubic-bezier(.22,.78,.3,1)',
            fill: 'forwards'
          });
        }
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
