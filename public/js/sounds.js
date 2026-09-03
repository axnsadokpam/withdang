class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = localStorage.getItem('ludo_muted') === 'true';
    this.noiseBuffer = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
        this._buildNoiseBuffer();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _buildNoiseBuffer() {
    if (!this.ctx || this.noiseBuffer) return;
    const bufferSize = this.ctx.sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('ludo_muted', this.muted);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
    }
    return this.muted;
  }

  _dest() {
    return this.masterGain || (this.ctx ? this.ctx.destination : null);
  }

  /* --------------------------------------------------------- */
  /* REALISTIC TUMBLING DICE CLATTER                          */
  /* --------------------------------------------------------- */
  
  
  playReactionPop() {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(1150, now + 0.08);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.11);
    } catch (e) {}
  }

  playDiceShake(intensity = 0.5) {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220 + intensity * 260, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);

      gain.gain.setValueAtTime(0.12 * intensity, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.045);
    } catch (e) {}
  }

  playDiceRoll(power = 1.0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const bounceCount = 6 + Math.floor(Math.random() * 3);

    for (let i = 0; i < bounceCount; i++) {
      const delay = Math.pow(i / bounceCount, 1.4) * 0.48; // accelerating/decelerating rhythm
      setTimeout(() => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const isFinal = i === bounceCount - 1;

        // Acoustic wood/acrylic clack
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isFinal ? 'triangle' : 'sine';
        const baseFreq = isFinal ? 140 : 280 + Math.random() * 220;
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t + (isFinal ? 0.09 : 0.04));

        const vol = isFinal ? 0.28 : 0.12 + Math.random() * 0.08;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + (isFinal ? 0.09 : 0.04));

        osc.connect(gain);
        gain.connect(this._dest());
        osc.start(t);
        osc.stop(t + (isFinal ? 0.09 : 0.04));

        // Noise click component (hard die surface)
        if (this.noiseBuffer) {
          const noise = this.ctx.createBufferSource();
          noise.buffer = this.noiseBuffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1800 + Math.random() * 800, t);
          filter.Q.setValueAtTime(3, t);

          const nGain = this.ctx.createGain();
          nGain.gain.setValueAtTime(isFinal ? 0.2 : 0.08, t);
          nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

          noise.connect(filter);
          filter.connect(nGain);
          nGain.connect(this._dest());
          noise.start(t);
          noise.stop(t + 0.03);
        }
      }, delay * 1000);
    }
  }

  /* --------------------------------------------------------- */
  /* MELODIC ASCENDING PENTATONIC TILE HOPS                    */
  /* --------------------------------------------------------- */
  playHop(stepIdx = 0, totalSteps = 6) {
    this.playHopStep(stepIdx + 1, totalSteps);
  }

  playHopStep(stepIdx, totalSteps) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Ascending A Major Pentatonic Scale: A4, B4, C#5, E5, F#5, A5, B5
    const scale = [440, 493.88, 554.37, 659.25, 739.99, 880, 987.77];
    const freq = scale[Math.min(stepIdx - 1, scale.length - 1)] || 440;

    // Body resonance (wooden mallet on stone)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.96, t + 0.08);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.002, t + 0.08);

    osc.connect(gain);
    gain.connect(this._dest());
    osc.start(t);
    osc.stop(t + 0.08);

    // Warm second harmonic for acoustic presence
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, t);
    gain2.gain.setValueAtTime(0.06, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc2.connect(gain2);
    gain2.connect(this._dest());
    osc2.start(t);
    osc2.stop(t + 0.04);
  }

  /* --------------------------------------------------------- */
  /* TACTILE DESTINATION TOUCHDOWN                             */
  /* --------------------------------------------------------- */
  playTileLand(isSafe = false) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Weighted acoustic thud (ceramic piece firmly seating into felt)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.005, t + 0.12);

    osc.connect(gain);
    gain.connect(this._dest());
    osc.start(t);
    osc.stop(t + 0.12);

    // If safe star tile, trigger soothing celeste chime chord (E6, G#6, B6)
    if (isSafe) {
      const chimeNotes = [1318.5, 1661.2, 1975.5];
      chimeNotes.forEach((f, idx) => {
        setTimeout(() => {
          if (!this.ctx) return;
          const ct = this.ctx.currentTime;
          const chime = this.ctx.createOscillator();
          const cGain = this.ctx.createGain();
          chime.type = 'sine';
          chime.frequency.setValueAtTime(f, ct);
          cGain.gain.setValueAtTime(0.12, ct);
          cGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.38);
          chime.connect(cGain);
          cGain.connect(this._dest());
          chime.start(ct);
          chime.stop(ct + 0.38);
        }, idx * 45);
      });
    }
  }

  /* --------------------------------------------------------- */
  /* CINEMATIC KILL / CAPTURE KNOCKOUT STOMP                   */
  /* --------------------------------------------------------- */
  playCapture() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. LAYER A: DEEP SUB-BASS SHOCK IMPACT (Earthquake thud)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, t);
    subOsc.frequency.exponentialRampToValueAtTime(30, t + 0.38);

    subGain.gain.setValueAtTime(0.65, t);
    subGain.gain.exponentialRampToValueAtTime(0.005, t + 0.38);

    subOsc.connect(subGain);
    subGain.connect(this._dest());
    subOsc.start(t);
    subOsc.stop(t + 0.38);

    // 2. LAYER B: EXPLOSIVE STONE SHATTER / CRUNCH (Filtered transient crunch)
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, t);
      filter.frequency.exponentialRampToValueAtTime(450, t + 0.22);
      filter.Q.setValueAtTime(2, t);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.45, t);
      nGain.gain.exponentialRampToValueAtTime(0.005, t + 0.22);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this._dest());
      noise.start(t);
      noise.stop(t + 0.22);
    }

    // 3. LAYER C: FLYBACK DESCENDING WHISTLE (Victim launched across board)
    setTimeout(() => {
      if (!this.ctx) return;
      const ct = this.ctx.currentTime;
      const flyOsc = this.ctx.createOscillator();
      const flyGain = this.ctx.createGain();
      flyOsc.type = 'triangle';
      flyOsc.frequency.setValueAtTime(880, ct);
      flyOsc.frequency.exponentialRampToValueAtTime(140, ct + 0.32);

      flyGain.gain.setValueAtTime(0.25, ct);
      flyGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.32);

      flyOsc.connect(flyGain);
      flyGain.connect(this._dest());
      flyOsc.start(ct);
      flyOsc.stop(ct + 0.32);
    }, 60);

    // 4. LAYER D: TRIUMPHANT POWER CHORD (Victor's reward stinger)
    setTimeout(() => {
      if (!this.ctx) return;
      const ct = this.ctx.currentTime;
      const chord = [523.25, 659.25, 783.99]; // C Major punch
      chord.forEach(f => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, ct);
        g.gain.setValueAtTime(0.18, ct);
        g.gain.exponentialRampToValueAtTime(0.005, ct + 0.35);
        o.connect(g);
        g.connect(this._dest());
        o.start(ct);
        o.stop(ct + 0.35);
      });
    }, 120);
  }

  /* --------------------------------------------------------- */
  /* HEROIC PRISON-BREAK (ROLLING A 6 & EXITING BASE)          */
  /* --------------------------------------------------------- */
  playBaseExit() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [392.0, 523.25, 659.25, 783.99]; // G4 -> C5 -> E5 -> G5 trumpet fanfare
    notes.forEach((f, idx) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const ct = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, ct);
        gain.gain.setValueAtTime(0.24, ct);
        gain.gain.exponentialRampToValueAtTime(0.01, ct + 0.22);
        osc.connect(gain);
        gain.connect(this._dest());
        osc.start(ct);
        osc.stop(ct + 0.22);
      }, idx * 60);
    });
  }

  /* --------------------------------------------------------- */
  /* GRAND VICTORY FANFARE WITH CELEBRATION CHIMES             */
  /* --------------------------------------------------------- */
  playWin() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // Radiant C-Major brass cadence
    const brassNotes = [
      { f: 523.25, d: 0.18, t: 0 },
      { f: 523.25, d: 0.18, t: 160 },
      { f: 523.25, d: 0.18, t: 320 },
      { f: 659.25, d: 0.24, t: 480 },
      { f: 783.99, d: 0.28, t: 720 },
      { f: 1046.50, d: 0.65, t: 1000 }
    ];

    brassNotes.forEach(({ f, d, t: delay }) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const ct = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, ct);

        // Lowpass filter for warm royal brass feel
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, ct);

        gain.gain.setValueAtTime(0.3, ct);
        gain.gain.exponentialRampToValueAtTime(0.005, ct + d);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this._dest());
        osc.start(ct);
        osc.stop(ct + d);
      }, delay);
    });
  }

  /* --------------------------------------------------------- */
  /* URGENT TICKING & REMATCH READY CHIME                      */
  /* --------------------------------------------------------- */
  playTimerTick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980, t);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    osc.connect(gain);
    gain.connect(this._dest());
    osc.start(t);
    osc.stop(t + 0.025);
  }

  playRematch() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const ct = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ct);
        gain.gain.setValueAtTime(0.22, ct);
        gain.gain.exponentialRampToValueAtTime(0.005, ct + 0.28);
        osc.connect(gain);
        gain.connect(this._dest());
        osc.start(ct);
        osc.stop(ct + 0.28);
      }, idx * 80);
    });
  }

  playMove() {
    this.playTileLand(false);
  }
}

/* --------------------------------------------------------- */
/* ARENA VOICE ANNOUNCER (Dynamic Excitement Tuning)         */
/* --------------------------------------------------------- */
class ArenaAnnouncer {
  constructor() {
    this.enabled = localStorage.getItem('ludo_announcer') === 'true';
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voice = null;
    this.initVoice();
  }

  initVoice() {
    if (!this.synth) return;
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      if (!voices || voices.length === 0) return;
      this.voice = voices.find(v => v.lang && v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Arthur'))) || voices.find(v => v.lang && v.lang.startsWith('en')) || voices[0];
    };
    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('ludo_announcer', this.enabled);
    if (this.enabled) {
      this.speak("Announcer online");
    }
    return this.enabled;
  }

  speak(text, priority = false) {
    if (!this.enabled || !this.synth) return;
    if (priority) {
      try { this.synth.cancel(); } catch (e) {}
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.voice) utterance.voice = this.voice;
      utterance.rate = 1.08;
      utterance.pitch = 1.05;
      utterance.volume = 0.95;
      this.synth.speak(utterance);
    } catch (e) {
      console.warn('[Announcer] Speech error:', e);
    }
  }

  announceRoll(roll, playerName, getsBonus = false) {
    if (roll === 6) {
      this.speak(getsBonus ? "Six! Extra roll!" : "Six!");
    } else {
      const numbers = ["", "One", "Two", "Three", "Four", "Five", "Six"];
      this.speak(numbers[roll] || String(roll));
    }
  }

  announceCapture(capturingPlayer, capturedPlayer) {
    const lines = [
      "Direct hit! " + (capturedPlayer || "Pawn") + " knocked out!",
      "Boom! " + (capturedPlayer || "Pawn") + " sent back to base!",
      "Eliminated! Clean strike by " + (capturingPlayer || "Player") + "!"
    ];
    const pick = lines[Math.floor(Math.random() * lines.length)];
    this.speak(pick, true);
  }

  announceWin(winnerName) {
    this.speak("Victory! " + winnerName + " conquers the arena!", true);
  }
}

window.SoundManager = SoundManager;
window.sounds = new SoundManager();
window.ArenaAnnouncer = ArenaAnnouncer;
window.announcer = new ArenaAnnouncer();
