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
        try {
          this.ctx = new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
          this.masterGain.connect(this.ctx.destination);
          this._buildNoiseBuffer();
        } catch (e) {}
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _buildNoiseBuffer() {
    if (!this.ctx || this.noiseBuffer) return;
    try {
      // 120ms buffer (only ~5,700 samples) instead of 1.5s (72,000 samples)
      // Completely eliminates synchronous main-thread allocation lag in Safari
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    } catch (e) {}
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
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
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
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
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
    if (!this.ctx || this.ctx.state !== 'running') return;

    // 3 snappy, visceral bounces: lightweight, physical, zero audio hitching on Safari
    const bounces = [
      { delay: 0.0, freq: 360, vol: 0.14, dur: 0.04, noiseVol: 0.08 },
      { delay: 0.12, freq: 260, vol: 0.18, dur: 0.05, noiseVol: 0.11 },
      { delay: 0.25, freq: 150, vol: 0.28, dur: 0.08, noiseVol: 0.18, isFinal: true }
    ];

    bounces.forEach(b => {
      setTimeout(() => {
        if (!this.ctx || this.ctx.state !== 'running') return;
        try {
          const t = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = b.isFinal ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(b.freq, t);
          osc.frequency.exponentialRampToValueAtTime(b.freq * 0.5, t + b.dur);

          gain.gain.setValueAtTime(b.vol, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + b.dur);

          osc.connect(gain);
          gain.connect(this._dest());
          osc.start(t);
          osc.stop(t + b.dur);

          if (this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2000, t);
            filter.Q.setValueAtTime(2.5, t);

            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(b.noiseVol, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

            noise.connect(filter);
            filter.connect(nGain);
            nGain.connect(this._dest());
            noise.start(t);
            noise.stop(t + 0.025);
          }
        } catch (e) {}
      }, b.delay * 1000);
    });
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
  /* TACTILE DESTINATION TOUCHDOWN & SANCTUARY                 */
  /* --------------------------------------------------------- */
  playTileLand(isSafe = false) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    if (isSafe) {
      this.playSafeSpot();
      return;
    }

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
  }

  /* --------------------------------------------------------- */
  /* SAFE SPOT CRYSTAL SANCTUARY CHIME                         */
  /* --------------------------------------------------------- */
  playSafeSpot() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Protective low hum (warm sanctuary shield)
    const hum = this.ctx.createOscillator();
    const hGain = this.ctx.createGain();
    hum.type = 'sine';
    hum.frequency.setValueAtTime(110, t);
    hGain.gain.setValueAtTime(0.2, t);
    hGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    hum.connect(hGain);
    hGain.connect(this._dest());
    hum.start(t);
    hum.stop(t + 0.45);

    // 2. Crystal Singing Bowl Harmonics (C6, G6, C7)
    const crystalNotes = [1046.50, 1567.98, 2093.00];
    crystalNotes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const ct = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ct);
        gain.gain.setValueAtTime(0.18 / (idx + 1), ct);
        gain.gain.exponentialRampToValueAtTime(0.001, ct + 0.55);
        osc.connect(gain);
        gain.connect(this._dest());
        osc.start(ct);
        osc.stop(ct + 0.55);
      }, idx * 35);
    });
  }

  /* --------------------------------------------------------- */
  /* VISCERAL KILL / CAPTURE KNOCKOUT STOMP                    */
  /* --------------------------------------------------------- */
  playCapture() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. LAYER A: DEEP SUB-BASS EARTHQUAKE STOMP
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.42);

    subGain.gain.setValueAtTime(0.85, t);
    subGain.gain.exponentialRampToValueAtTime(0.005, t + 0.42);

    subOsc.connect(subGain);
    subGain.connect(this._dest());
    subOsc.start(t);
    subOsc.stop(t + 0.42);

    // 2. LAYER B: BONE/CERAMIC CRACK TRANSIENT (Explosive piece snap)
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2800, t);
      filter.frequency.exponentialRampToValueAtTime(380, t + 0.18);
      filter.Q.setValueAtTime(2.5, t);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.65, t);
      nGain.gain.exponentialRampToValueAtTime(0.005, t + 0.18);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this._dest());
      noise.start(t);
      noise.stop(t + 0.18);
    }

    // 3. LAYER C: FLYBACK DOPPLER WHISTLE (Victim sent rocketing to base)
    setTimeout(() => {
      if (!this.ctx) return;
      const ct = this.ctx.currentTime;
      const flyOsc = this.ctx.createOscillator();
      const flyGain = this.ctx.createGain();
      flyOsc.type = 'triangle';
      flyOsc.frequency.setValueAtTime(940, ct);
      flyOsc.frequency.exponentialRampToValueAtTime(120, ct + 0.35);

      flyGain.gain.setValueAtTime(0.3, ct);
      flyGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.35);

      flyOsc.connect(flyGain);
      flyGain.connect(this._dest());
      flyOsc.start(ct);
      flyOsc.stop(ct + 0.35);
    }, 45);

    // 4. LAYER D: VICTORY IMPACT CHORD (Rewarding heavy brass slap)
    setTimeout(() => {
      if (!this.ctx) return;
      const ct = this.ctx.currentTime;
      const chord = [440, 554.37, 659.25, 880]; // A Major triumphal punch
      chord.forEach(f => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, ct);
        g.gain.setValueAtTime(0.22, ct);
        g.gain.exponentialRampToValueAtTime(0.005, ct + 0.38);
        o.connect(g);
        g.connect(this._dest());
        o.start(ct);
        o.stop(ct + 0.38);
      });
    }, 100);
  }

  /* --------------------------------------------------------- */
  /* CELESTIAL HOME GOAL GLISSANDO & LOCK CLICK                */
  /* --------------------------------------------------------- */
  playHomeGoal() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Ascending Celestial Harp Glissando (C5 -> E5 -> G5 -> B5 -> C6 -> E6)
    const harpNotes = [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51];
    harpNotes.forEach((f, idx) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const ct = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, ct);
        gain.gain.setValueAtTime(0.25, ct);
        gain.gain.exponentialRampToValueAtTime(0.005, ct + 0.4);
        osc.connect(gain);
        gain.connect(this._dest());
        osc.start(ct);
        osc.stop(ct + 0.4);
      }, idx * 55);
    });

    // 2. Heavy Golden Gate Lock Click at the climax
    setTimeout(() => {
      if (!this.ctx) return;
      const ct = this.ctx.currentTime;
      const click = this.ctx.createOscillator();
      const cGain = this.ctx.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(320, ct);
      click.frequency.exponentialRampToValueAtTime(80, ct + 0.08);
      cGain.gain.setValueAtTime(0.4, ct);
      cGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.08);
      click.connect(cGain);
      cGain.connect(this._dest());
      click.start(ct);
      click.stop(ct + 0.08);
    }, harpNotes.length * 55);
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

// Safari & iOS Web Audio Gesture Unlocker
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (window.sounds) window.sounds.init();
    ['touchstart', 'touchend', 'pointerdown', 'click'].forEach(evt => {
      document.removeEventListener(evt, unlockAudio, true);
    });
  };
  ['touchstart', 'touchend', 'pointerdown', 'click'].forEach(evt => {
    document.addEventListener(evt, unlockAudio, { capture: true, once: true });
  });
}
