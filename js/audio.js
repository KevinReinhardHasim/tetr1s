// Sound effects synthesised with Web Audio, so the game ships without audio files.
// Browsers only allow audio after a click or key press; unlock() is called from the first one.
(function (TR) {
  'use strict';
  const S = TR.Sfx = {
    ctx: null, master: null, vol: .6, noiseBuf: null,
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    },
    setVol(v) { this.vol = v; if (this.master) this.master.gain.value = v; },
    tone(f, dur, type, vol, slide, delay) {
      const c = this.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol || .2, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .03);
    },
    noise(dur, f0, f1, vol, delay) {
      const c = this.ctx, t = c.currentTime + (delay || 0), src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noiseBuf; bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * .3); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(bp); bp.connect(g); g.connect(this.master); src.start(t); src.stop(t + dur + .03);
    },
    arp(notes, dur, type, vol, step) { notes.forEach((f, i) => this.tone(f, dur, type, vol, null, i * step)); },
    play(name, n) {
      if (!this.ctx || this.vol <= 0) return;
      switch (name) {
        case 'move': this.tone(1100, .03, 'square', .035); break;
        case 'rotate': this.tone(620, .05, 'triangle', .08, 820); break;
        case 'lock': this.tone(180, .08, 'sine', .16, 90); break;
        case 'hard': this.tone(150, .1, 'sine', .24, 60); this.noise(.06, 900, 300, .06); break;
        case 'hold': this.tone(500, .06, 'triangle', .1, 720); break;
        case 'deny': this.tone(150, .08, 'square', .05); break;
        case 'clear': this.arp([523, 659, 784, 1047].slice(0, Math.max(2, n || 1)), .14, 'triangle', .11, .05); break;
        case 'quad': this.arp([523, 659, 784, 1047, 1319], .2, 'triangle', .12, .045); break;
        case 'tspin': this.arp([440, 587, 880, 1175], .18, 'square', .06, .05); break;
        case 'flipwarn': this.tone(880, .08, 'square', .05); this.tone(880, .08, 'square', .05, null, .14); break;
        case 'flip': this.noise(.7, 300, 2600, .1); this.tone(220, .6, 'sine', .07, 440); break;
        case 'hit': this.tone(260, .12, 'square', .08, 120); break;
        case 'attack': this.tone(70, .35, 'sawtooth', .1, 45); break;
        case 'garbage': this.tone(110, .1, 'square', .07, 80); this.tone(110, .1, 'square', .07, 80, .08); break;
        case 'level': this.arp([392, 523, 659, 784], .12, 'square', .05, .07); break;
        case 'win': this.arp([523, 659, 784, 1047, 1319], .25, 'triangle', .11, .09); break;
        case 'over': this.arp([392, 330, 262, 196], .25, 'triangle', .11, .12); break;
        case 'beep': this.tone(660, .12, 'square', .07); break;
        case 'go': this.tone(990, .25, 'square', .08); break;
        case 'select': this.tone(880, .04, 'square', .04); break;
      }
    }
  };
})(window.TR);
