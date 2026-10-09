// Procedural Web Audio ambience

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.birdTimer = 5 + Math.random() * 8;
    this.branchTimer = 12 + Math.random() * 20;
    this.riverTarget = 0;
    this.stepBuf = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    this._startWind();
    this._startRiver();
    this.ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _noiseBuffer(seconds, brown) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.4;
      } else {
        d[i] = w;
      }
    }
    return buf;
  }

  _startWind() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(5, true);
    src.loop = true;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    lp.Q.value = 0.7;

    const g = this.ctx.createGain();
    g.gain.value = 0.10;

    src.connect(lp);
    lp.connect(g);
    g.connect(this.master);

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.055;
    const lfoAmt = this.ctx.createGain();
    lfoAmt.gain.value = 150;
    lfo.connect(lfoAmt);
    lfoAmt.connect(lp.frequency);
    lfo.start();

    const lfo2 = this.ctx.createOscillator();
    lfo2.type = 'sine';
    lfo2.frequency.value = 0.031;
    const lfo2Amt = this.ctx.createGain();
    lfo2Amt.gain.value = 0.035;
    lfo2.connect(lfo2Amt);
    lfo2Amt.connect(g.gain);
    lfo2.start();

    src.start();
    this.windGain = g;
  }

  _startRiver() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(5, false);
    src.loop = true;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1050;
    bp.Q.value = 0.85;

    const g = this.ctx.createGain();
    g.gain.value = 0.0;

    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start();

    this.riverGain = g;
  }

  setRiver(x, z) {
    if (!this.ready) return;
    const cx = Math.sin(z * 0.021) * 24 + Math.sin(z * 0.0071 + 1.7) * 10 + 2;
    const dist = Math.abs(x - cx);
    const near = Math.max(0, 1 - dist / 34);
    this.riverTarget = near * near * 0.13;
  }

  _bird() {
    const t = this.ctx.currentTime;
    const f0 = 1700 + Math.random() * 1500;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.55, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.85, t + 0.15);

    const mod = this.ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = 38 + Math.random() * 22;
    const modAmt = this.ctx.createGain();
    modAmt.gain.value = 90;
    mod.connect(modAmt);
    modAmt.connect(osc.frequency);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

    osc.connect(g);
    g.connect(this.master);
    osc.start(t); osc.stop(t + 0.24);
    mod.start(t); mod.stop(t + 0.24);
  }

  _branch() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const f = 180 + Math.random() * 260;
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.35, t + 0.09);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.055, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

    osc.connect(g);
    g.connect(this.master);
    osc.start(t); osc.stop(t + 0.2);
  }

  footstep(volume = 1.0) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (!this.stepBuf) this.stepBuf = this._noiseBuffer(0.25, false);

    const src = this.ctx.createBufferSource();
    src.buffer = this.stepBuf;
    src.playbackRate.value = 0.85 + Math.random() * 0.35;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 320 + Math.random() * 380;
    bp.Q.value = 1.1;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.11 * volume, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.22);
  }

  update(dt) {
    if (!this.ready) return;

    // River gain smoothing
    const cur = this.riverGain.gain.value;
    this.riverGain.gain.value = cur + (this.riverTarget - cur) * Math.min(1, dt * 1.5);

    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 9 + Math.random() * 26;
      this._bird();
    }

    this.branchTimer -= dt;
    if (this.branchTimer <= 0) {
      this.branchTimer = 18 + Math.random() * 40;
      this._branch();
    }
  }
}
