/* A gentle, fully procedural soundscape — no samples.
   Hirajōshi-flavoured plucks + warm pad + seasonal ambience. */

export interface AudioEnv {
  tod: number;
  night: number;
  summer: number;
  autumn: number;
  winter: number;
  bloom: number;
  festival: number;
  fw: number;
  river: number;
}

const SCALE = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];

export class VillageAudio {
  enabled = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private padGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private layers: Partial<Record<"wind" | "cicada" | "river" | "murmur", GainNode>> = {};
  private delayWet: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextNote = 0;
  private lastIdx = 2;
  private env: AudioEnv = { tod: 0.1, night: 0, summer: 0, autumn: 0, winter: 0, bloom: 0, festival: 0, fw: 0, river: 0 };

  enable() {
    if (!this.ctx) this.build();
    if (!this.ctx) return;
    this.ctx.resume().catch(() => undefined);
    this.enabled = true;
    this.ramp(this.master!, 0.85, 2.2);
    if (!this.timer) {
      this.nextNote = this.ctx.currentTime + 0.8;
      this.timer = setInterval(() => this.tick(), 240);
    }
  }

  disable() {
    this.enabled = false;
    if (this.ctx && this.master) this.ramp(this.master, 0.0001, 0.6);
  }

  update(env: AudioEnv) {
    this.env = env;
    if (!this.ctx || !this.enabled) return;
    const L = this.layers;
    // wind — always present, breathes a little
    this.ramp(L.wind!, 0.042 + env.winter * 0.03 + env.autumn * 0.018);
    // cicadas on bright summer days
    this.ramp(L.cicada!, env.summer * 0.013 * (1 - env.night));
    // river near water
    this.ramp(L.river!, env.river * 0.05);
    // distant festival warmth
    this.ramp(L.murmur!, env.festival * 0.028 + env.fw * 0.02);
    // pad colour
    if (this.padFilter && this.padGain) {
      this.ramp(this.padFilter, 480 + env.summer * 260 - env.winter * 120 + env.night * 120, 1.2);
      this.ramp(this.padGain, 0.04 + env.winter * 0.012 + env.night * 0.014, 1.2);
    }
  }

  boom(strength: number) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const s = Math.min(1, strength);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise();
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(750, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + 1.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2 * s, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    src.connect(lp).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 1.5);
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(92, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.8);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.14 * s, t + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(og).connect(this.master!);
    osc.start(t);
    osc.stop(t + 1);
  }

  /* ------------------------------------------------ internals */
  private ramp(node: AudioParam | GainNode | BiquadFilterNode, v: number, dur = 0.5) {
    const param =
      node instanceof GainNode ? node.gain
      : node instanceof BiquadFilterNode ? node.frequency
      : (node as AudioParam);
    const t = this.ctx!.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(v, t + dur);
  }

  private noise(): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const len = this.ctx!.sampleRate * 2;
    const buf = this.ctx!.createBuffer(1, len, this.ctx!.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = (w * 0.4 + last * 2.2) * 0.5;
    }
    this.noiseBuf = buf;
    return buf;
  }

  private loopLayer(freq: number, q: number, type: BiquadFilterType = "bandpass"): GainNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise();
    src.loop = true;
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx!.createGain();
    g.gain.value = 0.0001;
    src.connect(f).connect(g).connect(this.master!);
    src.start();
    return g;
  }

  private build() {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(c.destination);

    // space: gentle feedback delay for the plucks
    const delay = c.createDelay(1.2);
    delay.delayTime.value = 0.34;
    const fb = c.createGain();
    fb.gain.value = 0.32;
    const wet = c.createGain();
    wet.gain.value = 0.4;
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(this.master);
    this.delayWet = wet;

    // warm pad — two detuned triangles through a soft lowpass
    this.padFilter = c.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.frequency.value = 560;
    this.padGain = c.createGain();
    this.padGain.gain.value = 0.04;
    [220, 329.63, 440.9].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      o.detune.value = i * 4 - 4;
      const og = c.createGain();
      og.gain.value = 0.4;
      o.connect(og).connect(this.padFilter!);
      o.start();
      // slow breathing
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.017;
      const lg = c.createGain();
      lg.gain.value = 0.14;
      lfo.connect(lg).connect(og.gain);
      lfo.start();
    });
    this.padFilter.connect(this.padGain).connect(this.master);

    this.layers.wind = this.loopLayer(320, 0.55);
    this.layers.cicada = this.loopLayer(5200, 7);
    this.layers.river = this.loopLayer(520, 0.4, "lowpass");
    this.layers.murmur = this.loopLayer(240, 0.5, "lowpass");
    // cicada shimmer
    const lfo = c.createOscillator();
    lfo.frequency.value = 13;
    const lg = c.createGain();
    lg.gain.value = 0.008;
    lfo.connect(lg).connect(this.layers.cicada.gain);
    lfo.start();
  }

  private pluck(t: number, freq: number, vol: number, pan = 0) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    const o2 = c.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2.001;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
    const g2 = c.createGain();
    g2.gain.value = 0.18;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2100;
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    if (p) p.pan.value = pan;
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(lp);
    if (p) { lp.connect(p); p.connect(this.master!); p.connect(this.delayWet!); }
    else { lp.connect(this.master!); lp.connect(this.delayWet!); }
    o.start(t); o2.start(t);
    o.stop(t + 2.5); o2.stop(t + 2.5);
  }

  private chirp(t: number) {
    const c = this.ctx!;
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator();
      const g = c.createGain();
      const t0 = t + i * 0.11;
      o.frequency.setValueAtTime(2300 + Math.random() * 500, t0);
      o.frequency.exponentialRampToValueAtTime(3300 + Math.random() * 600, t0 + 0.06);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.016, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
      o.connect(g).connect(this.master!);
      o.start(t0);
      o.stop(t0 + 0.1);
    }
  }

  private cricket(t: number) {
    const c = this.ctx!;
    [0, 0.13].forEach((off) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = 4300;
      g.gain.setValueAtTime(0.0001, t + off);
      g.gain.exponentialRampToValueAtTime(0.005, t + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.08);
      o.connect(g).connect(this.master!);
      o.start(t + off);
      o.stop(t + off + 0.1);
    });
  }

  private bell(t: number) {
    const c = this.ctx!;
    const f = SCALE[Math.floor(Math.random() * SCALE.length)] * 2;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.012, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g).connect(this.delayWet!);
    o.start(t);
    o.stop(t + 1.7);
  }

  private tick() {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const now = c.currentTime;
    const e = this.env;

    while (this.nextNote < now + 0.7) {
      const t = this.nextNote;
      // melody density follows the day
      const sparse = 2.6 + e.winter * 1.6 + e.night * 1.2 - e.festival * 1.1 - e.bloom * 0.4;
      const step = sparse * (0.7 + Math.random() * 0.7);
      // random walk through the scale
      this.lastIdx = Math.max(0, Math.min(SCALE.length - 1, this.lastIdx + Math.floor(Math.random() * 3) - 1));
      const octave = e.winter > 0.5 ? 0.5 : e.night > 0.5 ? 0.5 : 1;
      this.pluck(t, SCALE[this.lastIdx] * octave, 0.05 + Math.random() * 0.03, Math.random() * 1 - 0.5);
      if (e.festival > 0.3 && Math.random() < 0.5) this.bell(t + 0.4);
      this.nextNote = t + step;
    }

    if (e.night < 0.25 && e.winter < 0.6 && Math.random() < 0.16) this.chirp(now + 0.1);
    if (e.night > 0.4 && Math.random() < 0.22) this.cricket(now + 0.1);
    if (e.bloom > 0.4 && Math.random() < 0.08) this.bell(now + 0.2);
  }
}
