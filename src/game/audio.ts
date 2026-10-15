/** Procedural WebAudio: engine drone, wind, chimes. No external files. */
class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  engGain: GainNode | null = null;
  engOsc: OscillatorNode | null = null;
  engOsc2: OscillatorNode | null = null;
  filter: BiquadFilterNode | null = null;
  windGain: GainNode | null = null;
  volume = 0.6;

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 400;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engOsc = ctx.createOscillator();
    this.engOsc.type = "sawtooth";
    this.engOsc.frequency.value = 60;
    this.engOsc2 = ctx.createOscillator();
    this.engOsc2.type = "triangle";
    this.engOsc2.frequency.value = 91;
    this.engOsc.connect(this.filter);
    this.engOsc2.connect(this.filter);
    this.filter.connect(this.engGain);
    this.engGain.connect(this.master);
    this.engOsc.start();
    this.engOsc2.start();

    // wind noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 700;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    noise.connect(nf);
    nf.connect(this.windGain);
    this.windGain.connect(this.master);
    noise.start();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  update(throttle: number, speed: number, inCabin: boolean) {
    if (!this.ctx || !this.engOsc || !this.engOsc2 || !this.engGain || !this.filter || !this.windGain) return;
    const t = this.ctx.currentTime;
    const damp = inCabin ? 0.45 : 1;
    this.engOsc.frequency.setTargetAtTime(45 + throttle * 70, t, 0.3);
    this.engOsc2.frequency.setTargetAtTime(68 + throttle * 110, t, 0.3);
    this.filter.frequency.setTargetAtTime(inCabin ? 260 : 300 + throttle * 900, t, 0.3);
    this.engGain.gain.setTargetAtTime((0.04 + throttle * 0.12) * damp, t, 0.3);
    this.windGain.gain.setTargetAtTime(Math.min(speed / 250, 1) * 0.08 * damp, t, 0.4);
  }

  tone(freq: number, dur: number, delay = 0, vol = 0.15) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  chime() {
    this.tone(880, 0.9);
    this.tone(660, 1.2, 0.35);
  }
  ding() {
    this.tone(1320, 0.5, 0, 0.08);
  }
  success() {
    this.tone(523, 0.4);
    this.tone(659, 0.4, 0.12);
    this.tone(784, 0.7, 0.24);
  }
}

export const sfx = new Sfx();
