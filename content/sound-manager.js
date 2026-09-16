/* ============================================================
   Spider Web & Dust — Sound Manager
   Procedural audio via Web Audio API — no external files needed.
   ============================================================ */

class SoundManager {
  constructor(settings) {
    this.settings = settings;
    this.audioCtx = null;
    this.masterGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.connect(this.audioCtx.destination);
      this.updateVolume();
      this.initialized = true;
    } catch (e) {
      console.warn('Spider Web & Dust: Web Audio API not available');
    }
  }

  updateVolume() {
    if (this.masterGain) {
      this.masterGain.gain.value = this.settings.soundEnabled ? this.settings.soundVolume : 0;
    }
  }

  updateSettings(settings) {
    this.settings = settings;
    this.updateVolume();
  }

  // Ensure audio context is resumed (needs user gesture)
  async ensureResumed() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (e) {
        // Ignore
      }
    }
  }

  // ── Sound Effects ────────────────────────────────────

  playWhoosh() {
    if (!this.canPlay()) return;
    this.ensureResumed();

    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const duration = 0.25;

    // Filtered noise burst for whoosh
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const envelope = Math.sin(t * Math.PI) * (1 - t * 0.5);
      data[i] = (Math.random() * 2 - 1) * envelope * 0.3;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;

    // Sweep the frequency
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.linearRampToValueAtTime(400, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);
    source.stop(now + duration);
  }

  playWebSnap() {
    if (!this.canPlay()) return;
    this.ensureResumed();

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Quick high-pitched pluck sound
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000 + Math.random() * 1000, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playSparkle() {
    if (!this.canPlay()) return;
    this.ensureResumed();

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Chime — multiple harmonics
    const freqs = [2600, 3200, 4000, 4800];
    const duration = 0.4;

    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freqs[i] + Math.random() * 200;

      const gain = ctx.createGain();
      const startTime = now + i * 0.04;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.04, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);
    }
  }

  playComplete() {
    if (!this.canPlay()) return;
    this.ensureResumed();

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Ascending arpeggio fanfare
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const noteDuration = 0.15;

    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = notes[i];

      const gain = ctx.createGain();
      const startTime = now + i * noteDuration;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.1, startTime + 0.03);
      gain.gain.setValueAtTime(0.1, startTime + noteDuration * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + noteDuration + 0.4);
    }

    // Add sparkle layer on top
    setTimeout(() => this.playSparkle(), notes.length * noteDuration * 1000);
  }

  canPlay() {
    return this.initialized && this.settings.soundEnabled && this.audioCtx;
  }
}

window.__spiderSoundManager = SoundManager;
