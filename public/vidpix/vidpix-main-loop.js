// Vid Pix Emulator - Main Loop & Variables
// Translated from VID PIX NTSC v1.2.2.spin main loop

// Import graphics and sprites
// const gr = new VidPixGraphics('vidpix-canvas');
// const sprites = require('./sprites.js');

class VidPixMainLoop {
    constructor(graphics) {
        this.gr = graphics;
        
        // Main variables (exact translations from Spin)
        this.scalar_l = 0;        // left channel (0-16)
        this.scalar_r = 0;        // right channel (0-16)  
        this.scalar_bigd = 0;     // derived from scalar_r
        this.totalavg = 0;        // average of channels
        this.j = 1;               // frame counter (1-32)
        this.h = 0;               // every 4 frames counter (0-7)
        this.k = 0;               // global counter (0-0x1FFF)
        this.displayroutine = 0;  // current pattern (0-62)
        
        // Additional state variables from original
        this.rotateflag = false;  // alternating rotations
        this.changebit = false;   // alternating patterns
        this.ADC_AVG = 35;        // ADC averaging parameter (Spin used 35/75/105 often)
        this.delayflag = 0;       // delay timing flag (set to 1 by delay timer)
        this.p = 10;              // pack selection (1-10), default to "All items" like Spin
        this.str1 = 33;           // character cycling (starts at '!')
        this.str2 = 33;           // random character 1
        this.str3 = 33;           // random character 2
        this.lastrand = 0;        // random number state
        
        // Temporary variables for complex patterns
        this.tt0 = 0; this.tt1 = 0; this.tt2 = 0; this.tt3 = 0;
        this.tt4 = 0; this.tt5 = 0; this.tt6 = 0; this.tt7 = 0;
        this.tt8 = 0; this.tt9 = 0; this.tt10 = 0; this.tt11 = 0;
        this.tt12 = 0; this.tt13 = 0; this.tt14 = 0; this.tt15 = 0;
        
        // Animation frame ID for stopping
        this.animationId = null;
        this.isRunning = false;
        // Frame rate control (fast/medium/slow)
        this.frameRateMode = 'fast';
        this.targetFrameMs = 1000/60; // ~16.7ms
        this.lastFrameTime = 0;
        // Auto pattern cycling (OFF by default)
        this.autoPattern = false;
        this.lastAutoSwitch = performance.now();
        this.autoIntervalMs = 3000; // approx 3s between switches
        this.autoNextEligibleAt = performance.now(); // next time auto can switch (random delaygate)
        this.delayTimerId = null; // timer ID for delay cog simulation
        
        // Audio sensitivity multiplier
        this.audioSensitivity = 0.6;  // gentler default; UI range 0.05..1.5
        this.beatMode = 'edm';        // default to EDM; available: kick, edm, hiphop, rock, dnb
        // External ADC feed (Web Audio API)
        this.useExternalADC = false;
        this._externalLeft = 0;
        this._externalRight = 0;
        
        this.gr.log("VidPix Main Loop initialized with 63 display routines");
    }
    
    // Simulate ADC input (replace with real audio input later)
    simulateADCInput() {
        const time = Date.now() / 1000;
        let baseRight = 0, baseLeft = 0;
        // helper envelopes
        const envKick = (bpm, t = time) => {
            const period = 60 / bpm; const ph = (t % period) / period;
            return ph < 0.1 ? (1 - (ph / 0.1)) : 0; // short decay
        };
        const envSnare = (bpm, t = time, beatOffset = 0.5) => {
            const period = 60 / bpm; const ph = ((t + beatOffset * period) % period) / period;
            return ph < 0.06 ? (1 - (ph / 0.06)) * 0.8 : 0;
        };
        const envHat = (bpm, t = time, div = 2) => { // div=2 -> 8ths, 4 -> 16ths
            const per = (60 / bpm) / div; const ph = (t % per) / per;
            return ph < 0.02 ? (1 - (ph / 0.02)) * 0.5 : 0;
        };
        const clamp4096 = (v) => Math.max(0, Math.min(4096, v|0));
        
        switch (this.beatMode) {
            case 'kick': {
                // 120 BPM 4/4 kick with decay
                const env = envKick(120);
                baseRight = baseLeft = Math.floor(env * 4096 * 0.5);
                break;
            }
            case 'breaks': {
                // 130 BPM broken pattern
                const seq = [1,0,0.6,0, 0.8,0,1,0, 0.6,0,0.6,0, 1,0,0.8,0];
                const idx = Math.floor((time * 8) % seq.length);
                const env = seq[idx];
                baseLeft = Math.floor(env * 4096 * 0.4);
                baseRight = Math.floor(env * 4096 * 0.5);
                break;
            }
            case 'pulses': {
                const pulse = (Math.random() < 0.05) ? (0.6 + Math.random() * 0.4) : 0.1;
                baseLeft = Math.floor(pulse * 4096 * 0.4);
                baseRight = Math.floor(pulse * 4096 * 0.4);
                break;
            }
            case 'edm': {
                // 128 BPM: strong kick + sidechained pad + hats
                const bpm = 128;
                const k = envKick(bpm);
                const padR = (Math.sin(time * 2.2) * 0.5 + 0.5) * (1 - k);
                const padL = (Math.cos(time * 1.9) * 0.5 + 0.5) * (1 - k);
                const h = envHat(bpm, time, 4);
                const sub = k * 0.8 + padR * 0.3;
                baseRight = clamp4096((sub + h * 0.2) * 4096 * 0.6);
                baseLeft  = clamp4096(((k * 0.75) + padL * 0.35 + h * 0.15) * 4096 * 0.6);
                break;
            }
            case 'hiphop': {
                // ~90 BPM boom-bap: swung hats, kick early, snare on 2 and 4
                const bpm = 90;
                const k = envKick(bpm);
                const s = envSnare(bpm);
                const s2 = envSnare(bpm, time, 1.5); // 4th beat
                // swung hats (triplet feel)
                const hat = envHat(bpm, time * 0.98, 3) * 0.6 + envHat(bpm, time * 1.02, 6) * 0.4;
                const low = (Math.sin(time * 1.0) * 0.5 + 0.5) * 0.2; // room tone
                baseLeft  = clamp4096(((k * 0.9) + hat * 0.25 + low) * 4096 * 0.6);
                baseRight = clamp4096(((s * 0.8) + s2 * 0.8 + hat * 0.35 + low) * 4096 * 0.6);
                break;
            }
            case 'rock': {
                // 120 BPM: kick on 1/3, snare on 2/4, steady 8th hats
                const bpm = 120;
                const k = envKick(bpm) + envKick(bpm, time + 0.5 * (60/bpm)); // beats 1 and 3
                const s = envSnare(bpm) + envSnare(bpm, time, 1.5); // beats 2 and 4
                const hat = envHat(bpm, time, 2);
                baseLeft  = clamp4096(((k * 0.8) + hat * 0.25) * 4096 * 0.6);
                baseRight = clamp4096(((s * 0.9) + hat * 0.25) * 4096 * 0.6);
                break;
            }
            case 'dnb': {
                // 174 BPM: fast sub + snare on 2/4 + busy hats
                const bpm = 174;
                const k = envKick(bpm);
                const s = envSnare(bpm) + envSnare(bpm, time, 1.5);
                const hat = envHat(bpm, time, 4) + envHat(bpm, time * 1.03, 8) * 0.6;
                const sub = (Math.sin(time * 3.1) * 0.5 + 0.5) * 0.4;
                baseLeft  = clamp4096(((k * 0.9) + hat * 0.4 + sub * 0.6) * 4096 * 0.6);
                baseRight = clamp4096(((s * 0.9) + hat * 0.5 + sub * 0.5) * 4096 * 0.6);
                break;
            }
            default: {
                // sine/ambient
                baseRight = Math.floor((Math.sin(time * 2) * 0.5 + 0.5) * 4096 * 0.25) + Math.floor(Math.random() * 512);
                baseLeft  = Math.floor((Math.cos(time * 1.5) * 0.5 + 0.5) * 4096 * 0.25) + Math.floor(Math.random() * 512);
            }
        }
        
        // Apply sensitivity multiplier
        const rightADCavg = Math.floor(baseRight * this.audioSensitivity);
        const leftADCavg = Math.floor(baseLeft * this.audioSensitivity);
        
        // Clamp to valid ADC range (0-4095)
        return { 
            rightADCavg: Math.min(4095, Math.max(0, rightADCavg)), 
            leftADCavg: Math.min(4095, Math.max(0, leftADCavg))
        };
    }
    
    // Random number generator (Spin-compatible behavior, returning 1..sigdigs)
    randomgen(sigdigs) {
        const n = Math.max(1, (sigdigs | 0));
        if (!this._randSeed) {
            this._randSeed = (Date.now() ^ ((this.k | 0) << 16)) >>> 0;
        }
        // LCG PRNG
        this._randSeed = (1664525 * this._randSeed + 1013904223) >>> 0;
        let var1 = (this._randSeed % n) + 1; // 1..n
        if (var1 === this.lastrand) {
            this._randSeed = (1664525 * this._randSeed + 1013904223) >>> 0;
            var1 = (this._randSeed % n) + 1;
        }
        this.lastrand = var1;
        return var1;
    }
    
    // Main loop iteration (called every frame)
    update() {
        // Retrieve ADC L and R values, build pixel scalar values
        const { rightADCavg, leftADCavg } = this.useExternalADC ?
            { rightADCavg: this._externalRight, leftADCavg: this._externalLeft } :
            this.simulateADCInput();
        
        // Exact scalar calculations from Spin code
        this.scalar_r = Math.floor((rightADCavg * 16) / 4096);
        this.scalar_l = Math.floor((leftADCavg * 16) / 4096);
        this.scalar_bigd = Math.floor(((this.scalar_r) * 2) / 5) + 16;
        this.totalavg = Math.floor((this.scalar_r + this.scalar_l) / 2);
        
        // Change orientation every 9 frames (j//9 == 0)
        if (this.j % 9 === 0) {
            this.rotateflag = !this.rotateflag;
        }
        
        // Clear screen and execute current display routine
        this.gr.clear();
        
        // Execute the current display routine
        this.executeDisplayRoutine();
        
        // Update frame counters (exact translation from Spin)
        if (this.j === 32) {  // each pattern has 32 frames it can use
            this.j = 1;
        } else {
            this.j++;
        }
        
        if (this.h === 8) {   // this counter is used by patterns that change images every 4 frames
            this.h = 0;
        } else if ((this.j + 1) % 4 === 0) {
            this.h++;
        }
        
        // Character cycling for text patterns
        if (this.str1 === 127) {  // used by the character assassination pack to cycle through characters
            this.str1 = 33;
        } else {
            this.str1++;
        }
        
        if (this.str1 < 63) {    // used by the character assassination pack to show semi random characters
            this.str2 = this.str1 + this.randomgen(32);
            this.str3 = this.str1 + this.randomgen(32);
        } else {
            this.str2 = this.str1 - this.randomgen(32);
            this.str3 = this.str1 - this.randomgen(32);
        }
        
        // Global counter
        if (this.k === 0x1FFF) {
            this.k = 0;
        } else {
            this.k++;
        }
        
        // Log current state periodically
        if (this.k % 1000 === 0) {
            this.gr.log(`Frame ${this.k}: Pattern ${this.displayroutine}, Audio L:${this.scalar_l} R:${this.scalar_r} Avg:${this.totalavg}`);
        }
        
        // Auto pattern cycling (exact Spin parity: if ina[5] <> 0 and totalavg > 2 and delayflag==1)
        if (this.autoPattern) {
            // Spin: if totalavg > 2 and delayflag==1 then choose new routine and reset delay
            if (this.totalavg > 2 && this.delayflag === 1) {
                let newPattern = this.pickAutoPattern();
                let tries = 0;
                while (!this.isPatternImplemented(newPattern) && tries < 32) {
                    newPattern = this.pickAutoPattern();
                    tries++;
                }
                // apply palette/frame-rate mapping like Spin
                this.applyAutoPaletteAndFrameRate(newPattern);
                this.setDisplayRoutine(newPattern);
                // reset delayflag and start new delay timer (like Spin's cognew(delay(@delayflag, 0), @delayStack))
                this.delayflag = 0;
                this.startDelayTimer();
            }
        }
    }

    // Toggle external ADC usage
    setUseExternalADC(enabled) { this.useExternalADC = !!enabled; }
    // Feed external ADC sample (0..4095 per channel)
    feedExternalADC({ leftADCavg, rightADCavg }) {
        // Apply sensitivity multiplier like simulateADCInput() does
        const l = Math.min(4095, Math.max(0, Math.floor((leftADCavg|0) * this.audioSensitivity)));
        const r = Math.min(4095, Math.max(0, Math.floor((rightADCavg|0) * this.audioSensitivity)));
        this._externalLeft = l;
        this._externalRight = r;
    }
    
    // Execute the current display routine (main switch statement)
    executeDisplayRoutine() {
        switch(this.displayroutine) {
            case 0:  this.displayRoutine0(); break;
            case 1:  this.displayRoutine1(); break;
            case 2:  this.displayRoutine2(); break;
            case 3:  this.displayRoutine3(); break;
            case 4:  this.displayRoutine4(); break;
            case 5:  this.displayRoutine5(); break;
            case 6:  this.displayRoutine6(); break;
            case 7:  this.displayRoutine7(); break;
            case 8:  this.displayRoutine8(); break;
            case 9:  this.displayRoutine9(); break;
            case 10: this.displayRoutine10(); break;
            case 11: this.displayRoutine11(); break;
            case 12: this.displayRoutine12(); break;
            case 13: this.displayRoutine13(); break;
            case 14: this.displayRoutine14(); break;
            case 15: this.displayRoutine15(); break;
            case 16: this.displayRoutine16(); break;
            case 17: this.displayRoutine17(); break;
            case 18: this.displayRoutine18(); break;
            case 19: this.displayRoutine19(); break;
            case 20: this.displayRoutine20(); break;
            case 21: this.displayRoutine21(); break;
            case 22: this.displayRoutine22(); break;
            case 23: this.displayRoutine23(); break;
            case 24: this.displayRoutine24(); break;
            case 25: this.displayRoutine25(); break;
            case 26: this.displayRoutine26(); break;
            case 27: this.displayRoutine27(); break;
            case 28: this.displayRoutine28(); break;
            case 29: this.displayRoutine29(); break;
            case 30: this.displayRoutine30(); break;
            case 31: this.displayRoutine31(); break;
            case 32: this.displayRoutine32(); break;
            case 33: this.displayRoutine33(); break;
            case 34: this.displayRoutine34(); break;
            case 35: this.displayRoutine35(); break;
            case 36: this.displayRoutine36(); break;
            case 37: this.displayRoutine37(); break;
            case 38: this.displayRoutine38(); break;
            case 39: this.displayRoutine39(); break;
            case 40: this.displayRoutine40(); break;
            case 41: this.displayRoutine41(); break;
            case 42: this.displayRoutine42(); break;
            case 43: this.displayRoutine43(); break;
            case 44: this.displayRoutine44(); break;
            case 45: this.displayRoutine45(); break;  // Lissajous/oscilloscope-like cross plot
            case 46: this.displayRoutine46(); break;  // Polar bar meter: 16 spokes with audio length
            case 47: this.displayRoutine47(); break;  // Atari 2600 Winamp-style star visualizer
            case 48: this.displayRoutine48(); break;  // Pong: Classic Pong with score tracking
            case 49: this.displayRoutine49(); break;  // Snake: audio-reactive path, food targets
            case 50: this.displayRoutine50(); break;  // Breakout: audio-reactive with paddle and bricks
            case 51: this.displayRoutine51(); break;  // Space Invaders Symphony
            case 52: this.displayRoutine52(); break;  // Audio Rally: Neon synth top-down road
            case 53: this.displayRoutine53(); break;  // SkiFree - Flow mode
            case 54: this.displayRoutine54(); break;  // SkiFree - Slalom mode
            case 55: this.displayRoutine55(); break;  // Tetris-style falling blocks
            case 56: this.displayRoutine56(); break;  // Gibson wireframe data city
            case 57: this.displayRoutine57(); break;  // Hackers movie terminal
            case 58: this.displayRoutine58(); break;  // Spectrum Analyzer with peak-hold decay
            case 59: this.displayRoutine59(); break;  // Spectrum Waterfall
            case 60: this.displayRoutine60(); break;  // Frequency Cityscape
            case 61: this.displayRoutine61(); break;  // ASCII Skull/Mask Strobe
            case 62: this.displayRoutine62(); break;  // Matrix Digital Rain
            default:
                this.gr.log(`Unknown display routine: ${this.displayroutine}`);
                this.displayroutine = 0; // Reset to safe default
                break;
        }
    }

    // Determine whether a given pattern routine is implemented
    isPatternImplemented(p) {
        const method = this[`displayRoutine${p}`];
        if (typeof method !== 'function') return false;
        try {
            const src = Function.prototype.toString.call(method);
            // Consider it implemented if it uses any gr.* call other than log
            // e.g., gr.pix, gr.line, gr.text, gr.arc, gr.width, gr.colorwidth, etc.
            const usesNonLogGr = /this\\.gr\\\.(?!log\b)/.test(src);
            return usesNonLogGr;
        } catch (_) {
            // Fallback: assume implemented if function exists
            return true;
        }
    }

    // Safe setter that skips unimplemented patterns
    setDisplayRoutine(routine) {
        let p = routine | 0;
        if (p < 0) p = 0; if (p > 62) p = 62;
        const start = p;
        for (let i = 0; i < 63; i++) {
            const cand = (start + i) % 63;
            if (this.isPatternImplemented(cand)) { this.displayroutine = cand; return; }
        }
        this.displayroutine = 0;
    }

    nextPattern() {
        const start = (this.displayroutine + 1) % 63;
        for (let i = 0; i < 63; i++) {
            const cand = (start + i) % 63;
            if (this.isPatternImplemented(cand)) { this.setDisplayRoutine(cand); return; }
        }
    }

    previousPattern() {
        const start = (this.displayroutine - 1 + 63) % 63;
        for (let i = 0; i < 63; i++) {
            const cand = (start - i + 63*2) % 63;
            if (this.isPatternImplemented(cand)) { this.setDisplayRoutine(cand); return; }
        }
    }

    // Choose next pattern according to Spin's auto mode pack logic (exact 1:1 translation)
    pickAutoPattern() {
        // Exact translation from Spin lines 388-422
        if (this.p === 1) {
            // Pack 1: patterns 0-7
            return (this.randomgen(8) - 1);  // 0..7
        } else if (this.p === 2) {
            // Pack 2: patterns 8-15  
            return (this.randomgen(8) + 7);  // 8..15
        } else if (this.p === 3) {
            // Pack 3: patterns 16-23
            return (this.randomgen(8) + 15); // 16..23
        } else if (this.p === 4) {
            // Pack 4: patterns 24-31
            return (this.randomgen(8) + 23); // 24..31
        } else if (this.p === 5) {
            // Pack 5: patterns 32-39
            return (this.randomgen(8) + 31); // 32..39
        } else if (this.p === 6) {
            // Pack 6: patterns 40-43 (holidays)
            return (this.randomgen(4) + 39); // 40..43
        } else if (this.p === 7) {
            // Pack 7: Oscilloscope Dreams (45,46,47 and 58-60)
            const tmp = (this.randomgen(6) - 1); // 0..5
            if (tmp < 3) {
                return 45 + tmp;  // 45..47
            } else {
                return 58 + (tmp - 3);  // 58..60
            }
        } else if (this.p === 8) {
            // Pack 8: Neon Arcade (48-55)
            return ((this.randomgen(8) - 1) + 48); // 48..55
        } else if (this.p === 9) {
            // Pack 9: Hack the Planet (56-57, 61-62)
            const tmp = (this.randomgen(4) - 1); // 0..3
            if (tmp === 0) return 56;
            else if (tmp === 1) return 57;
            else if (tmp === 2) return 61;
            else return 62;
        } else {
            // Pack 10: All items excluding Holidays (40..43) and 44
            let tmp = (this.randomgen(56) - 1); // 0..55
            if (tmp >= 40) tmp = tmp + 5;       // skip 40..44 -> 45..60
            return tmp; // 0..39, 45..60
        }
    }

    // Apply palette and frame-rate assignments as in Spin after choosing new pattern (exact 1:1 translation)
    applyAutoPaletteAndFrameRate(pattern) {
        // Exact translation from Spin lines 425-455
        let i; // palette index variable like Spin
        
        if (pattern > 15 && pattern < 24) {
            // arcade classics 16..23: i := displayroutine + 14
            i = pattern + 14;
            this.ADC_AVG = 105; // slow down the frame rate for clearer animation
        } else if (pattern > 38 && pattern < 45) {
            // 39..44: i := displayroutine - 2  
            i = pattern - 2;
        } else if (pattern >= 45) {
            // 45+: i := randomgen(32)
            i = this.randomgen(32);
            // centralized frame rate assignment for 45-60 (exact Spin logic)
            if (pattern === 45 || pattern === 46 || pattern === 55 || pattern === 58 || pattern === 59 || pattern === 60) {
                this.ADC_AVG = 35;   // Oscilloscope Dreams + Spectrum - Fast
            } else if (pattern === 48 || pattern === 49 || pattern === 50) {
                this.ADC_AVG = 105;  // Games - Slow
            } else if (pattern === 51 || pattern === 52) {
                this.ADC_AVG = 75;   // Arcade Action - Medium
            } else if (pattern === 53 || pattern === 54) {
                this.ADC_AVG = 35;   // SkiFree variants - Fast
            } else if (pattern === 56) {
                this.ADC_AVG = 35;   // Wireframe City - Fast
            } else if (pattern === 57) {
                this.ADC_AVG = 105;  // Hackers Terminal - Slow
            } else if (pattern === 61) {
                this.ADC_AVG = 75;   // Skull Strobe - Medium
            } else if (pattern === 62) {
                this.ADC_AVG = 35;   // Matrix Rain - Fast
            } else {
                this.ADC_AVG = 35;   // default fast
            }
        } else {
            // everything else: i := randomgen(32)
            i = this.randomgen(32);
            this.ADC_AVG = 105; // speed up the frame rate
        }
        
        // SetAreaColor(0,0,TV_HC-1,TV_VC-1,i) - apply palette if not locked
        if (this.gr && !this.gr.paletteLocked) {
            // Clamp to subset 0..29 per user restriction
            const clampedPalette = Math.max(0, Math.min(29, i|0));
            this.gr.setAreaColor(0, 0, 7, 5, clampedPalette);
        }
    }

    // Start delay timer (like Spin's cognew(delay(@delayflag, 0), @delayStack))
    startDelayTimer() {
        // Clear any existing timer
        if (this.delayTimerId) {
            clearTimeout(this.delayTimerId);
        }
        
        // Spin's delay function: if mult==0, mult := randomgen(32), then waitcnt(DELAYUNIT*mult + cnt)
        // DELAYUNIT = 10_000_000 (1/8 second), so delay is random(1..32) * 125ms
        const mult = this.randomgen(32); // 1..32
        const delayMs = mult * 125; // 125ms * random(1..32)
        
        this.delayTimerId = setTimeout(() => {
            this.delayflag = 1; // byte[delayflagAddr]:=1
            this.delayTimerId = null;
        }, delayMs);
    }
    
    // Random delay calculation (kept for compatibility)
    autoRandomDelayMs() {
        // Spin's delay uses DELAYUNIT = 10_000_000 (~1/8s) * random(1..32)
        // We'll approximate with 125ms * random(1..32)
        const units = (this.randomgen(32)); // 1..32
        return 125 * units;
    }
    
    // Display routines 0-7 (exact translations from Spin code)
    displayRoutine0() {
        // Lines 513-514: if j//2== 0 changebit := !changebit
        if (this.j % 2 === 0) {
            this.changebit = !this.changebit;
        }
        
        // Line 516: gr.width(scalar_r+16)
        this.gr.width(this.scalar_r + 16);
        
        // Lines 517-520: if changebit==0 ... else
        if (this.changebit === false) {
            this.gr.pix(0, 0, 0, 'pixdeftriclear2a');
        } else {
            this.gr.pix(0, 0, 0, 'pixdeftriclear2b');
        }
        
        // Lines 522-523: gr.width(scalar_l+16) gr.pix(0, 0, 0, @pixdefsmall1)
        this.gr.width(this.scalar_l + 16);
        this.gr.pix(0, 0, 0, 'pixdefsmall1');
        
        // Lines 525-528: if totalavg <> 0
        if (this.totalavg !== 0) {
            this.gr.width(Math.floor(this.totalavg / 2) + 16);
            this.gr.pix(-45, 0, 0, 'pixdeftriclear3');
            this.gr.pix(45, 0, 0, 'pixdeftriclear3');
        }
    }
    
    displayRoutine1() {
        // Lines 533-534: if j//2== 0 changebit := !changebit
        if (this.j % 2 === 0) {
            this.changebit = !this.changebit;
            
            // Lines 536-537: gr.width(scalar_l+16) gr.pix(0, 0, 1, @pixdefsmall2)
            this.gr.width(this.scalar_l + 16);
            this.gr.pix(0, 0, 1, 'pixdefsmall2');
        } else {
            // Line 540: gr.width(scalar_bigd)
            this.gr.width(this.scalar_bigd);
        }
        
        // Line 542: gr.width(scalar_r+16)
        this.gr.width(this.scalar_r + 16);
        
        // Lines 543-546: if changebit==0 ... else
        if (this.changebit === false) {
            this.gr.pix(0, 0, 0, 'pixdeftriclear2a');
        } else {
            this.gr.pix(0, 0, 0, 'pixdeftriclear2b');
        }
        
        // Lines 548-549: gr.width(scalar_l+16) gr.pix(0, 0, 0, @pixdefsmall1)
        this.gr.width(this.scalar_l + 16);
        this.gr.pix(0, 0, 0, 'pixdefsmall1');
    }
    
    displayRoutine2() {
        // Lines 554-555: if j//2== 0 changebit := !changebit
        if (this.j % 2 === 0) {
            this.changebit = !this.changebit;
            
            // Lines 557-558: gr.width(scalar_l) gr.pix(0, 0, 1, @pixdefsmall1)
            this.gr.width(this.scalar_l);
            this.gr.pix(0, 0, 1, 'pixdefsmall1');
        } else {
            // Line 561: gr.width(scalar_bigd)
            this.gr.width(this.scalar_bigd);
        }
        
        // Line 563: gr.width(scalar_r)
        this.gr.width(this.scalar_r);
        
        // Lines 564-567: if changebit==0 ... else
        if (this.changebit === false) {
            this.gr.pix(0, 0, 0, 'pixdeftriclear2a');
        } else {
            this.gr.pix(0, 0, 0, 'pixdeftriclear2b');
        }
        
        // Lines 569-570: gr.width(scalar_l) gr.pix(0, 0, 0, @pixdefsmall1)
        this.gr.width(this.scalar_l);
        this.gr.pix(0, 0, 0, 'pixdefsmall1');
    }
    
    displayRoutine3() {
        // Lines 575-576: gr.width(scalar_l+16) gr.pix(0, 0, 0, @pixdeftriclear1)
        this.gr.width(this.scalar_l + 16);
        this.gr.pix(0, 0, 0, 'pixdeftriclear1');
        
        // Line 578: gr.width(scalar_r+16)
        this.gr.width(this.scalar_r + 16);
        
        // Lines 579-582: if rotateflag ... else
        if (this.rotateflag) {
            this.gr.pix(0, 0, 0, 'pixdeftriclear2a');
        } else {
            this.gr.pix(0, 0, 1, 'pixdeftriclear2b');
        }
    }
    
    displayRoutine4() {
        // Lines 586-587: gr.width(scalar_r+16) gr.pix(0, 0, 0, @pixdeftriclear2)
        this.gr.width(this.scalar_r + 16);
        this.gr.pix(0, 0, 0, 'pixdeftriclear2');
        
        // Lines 589-590: gr.width(scalar_l+16) gr.pix(0, 0, 0, @pixdeftriclear1)
        this.gr.width(this.scalar_l + 16);
        this.gr.pix(0, 0, 0, 'pixdeftriclear1');
        
        // Lines 593-598: if totalavg <> 0
        if (this.totalavg !== 0) {
            this.gr.width(Math.floor(this.totalavg / 2) + 16);
            this.gr.pix(-45, 0, 0, 'pixdeftriclear3');
            this.gr.pix(45, 0, 0, 'pixdeftriclear3');
            this.gr.pix(0, 45, 0, 'pixdeftriclear3');
            this.gr.pix(0, -45, 0, 'pixdeftriclear3');
        }
    }
    
    displayRoutine5() {
        // Lines 602-603: gr.width(scalar_r+16) gr.pix(0, 0, 0, @pixdeftriclear2)
        this.gr.width(this.scalar_r + 16);
        this.gr.pix(0, 0, 0, 'pixdeftriclear2');
        
        // Lines 605-606: gr.width(scalar_l+16) gr.pix(0, 0, 0, @pixdeftriclear1)
        this.gr.width(this.scalar_l + 16);
        this.gr.pix(0, 0, 0, 'pixdeftriclear1');
        
        // Lines 608-617: if totalavg <> 0
        if (this.totalavg !== 0) {
            this.gr.width(Math.floor(this.totalavg / 2) + 16);
            this.gr.pix(-45, -45, 0, 'pixdeftriclear2');
            this.gr.pix(-45, 0, 0, 'pixdeftriclear3');
            this.gr.pix(45, 45, 0, 'pixdeftriclear2');
            this.gr.pix(45, 0, 0, 'pixdeftriclear3');
            this.gr.pix(-45, 45, 0, 'pixdeftriclear2');
            this.gr.pix(0, 45, 0, 'pixdeftriclear3');
            this.gr.pix(45, -45, 0, 'pixdeftriclear2');
            this.gr.pix(0, -45, 0, 'pixdeftriclear3');
        }
    }
    
    displayRoutine6() {
        // Lines 620-621: gr.width(scalar_r+16) gr.pix(0, 0, 0, @pixdeftriclear2)
        this.gr.width(this.scalar_r + 16);
        this.gr.pix(0, 0, 0, 'pixdeftriclear2');
        
        // Lines 623-624: gr.width(scalar_l+16) gr.pix(0, 0, 0, @pixdeftriclear1)
        this.gr.width(this.scalar_l + 16);
        this.gr.pix(0, 0, 0, 'pixdeftriclear1');
        
        // Lines 626-629: if totalavg <> 0
        if (this.totalavg !== 0) {
            this.gr.width(Math.floor(this.totalavg / 2));
            this.gr.pix(0, 45, 0, 'pixdeftriclear3');
            this.gr.pix(0, -45, 0, 'pixdeftriclear3');
        }
    }
    
    displayRoutine7() {
        // Lines 633-634: gr.width(scalar_l) gr.pix(0, 0, 0, @pixdeftriclear1)
        this.gr.width(this.scalar_l);
        this.gr.pix(0, 0, 0, 'pixdeftriclear1');
        
        // Lines 636-637: gr.width(scalar_r+16) gr.pix(0, 0, 0, @pixdeftriclear2)
        this.gr.width(this.scalar_r + 16);
        this.gr.pix(0, 0, 0, 'pixdeftriclear2');
        
        // Lines 639-645: if totalavg <> 0
        if (this.totalavg !== 0) {
            this.gr.width(Math.floor(this.totalavg / 2) + 16);
            this.gr.pix(-45, 0, 0, 'pixdeftriclear2');
            this.gr.pix(45, 0, 0, 'pixdeftriclear2');
            this.gr.width(Math.floor(this.totalavg / 8));
            this.gr.pix(0, 45, 0, 'pixdeftriclear3');
            this.gr.pix(0, -45, 0, 'pixdeftriclear3');
        }
    }
    
    // Convert character code to single character string
    charToString(charCode) {
        return String.fromCharCode(charCode);
    }
    
    // Placeholder methods for display routines (8-62)
    displayRoutine8() {
        // SPIN lines 648-675
        if (this.j % 4 === 0) {
            this.changebit = !this.changebit;
        }
        this.gr.width(this.scalar_r + 16);
        if (this.changebit === false) {
            this.gr.pix(0, 25, 0, 'pixdeftriclear2a');
            this.gr.pix(0, -25, 0, 'pixdeftriclear2a');
        } else {
            this.gr.pix(0, 25, 0, 'pixdeftriclear2b');
            this.gr.pix(0, -25, 0, 'pixdeftriclear2b');
        }
        this.gr.width(this.scalar_l + 16);
        this.gr.pix(0, 25, 0, 'pixdefsmall1');
        this.gr.pix(0, -25, 0, 'pixdefsmall1');
        if (this.totalavg !== 0) {
            this.gr.width(Math.floor(this.totalavg / 2) + 16);
            this.gr.pix(-45, 25, 0, 'pixdeftriclear3');
            this.gr.pix(45, -25, 0, 'pixdeftriclear3');
            this.gr.pix(-45, -25, 0, 'pixdeftriclear3');
            this.gr.pix(45, 25, 0, 'pixdeftriclear3');
            this.gr.width(this.totalavg + 16);
            this.gr.pix(-45, 25, 0, 'pixdefhollow1');
            this.gr.pix(45, -25, 0, 'pixdefhollow1');
            this.gr.pix(-45, -25, 0, 'pixdefhollow1');
            this.gr.pix(45, 25, 0, 'pixdefhollow1');
        }
    }
    displayRoutine9() {
        // SPIN lines 677-705
        if (this.scalar_l > 0.5) {
            this.gr.width(this.totalavg + 16);
            this.gr.pix(0, this.totalavg * 8, 0, 'pixdefhollow3');
            this.gr.pix(0, -this.totalavg * 8, 0, 'pixdefhollow3');
        }
        if (this.scalar_l > 2) {
            this.gr.width(this.totalavg + 16);
            this.gr.pix(0, this.totalavg * 16, 0, 'pixdefhollow3');
            this.gr.pix(0, -this.totalavg * 16, 0, 'pixdefhollow3');
        }
        if (this.j % 2 === 0) {
            this.changebit = !this.changebit;
            this.gr.width(this.scalar_l + 16);
            this.gr.pix(0, 0, 1, 'pixdefsmall2');
        } else {
            this.gr.width(this.scalar_bigd);
        }
        this.gr.width(this.scalar_r + 16);
        if (this.changebit === false) {
            this.gr.pix(0, 0, 0, 'pixdeftriclear2a');
        } else {
            this.gr.pix(0, 0, 0, 'pixdeftriclear2b');
        }
        this.gr.width(this.scalar_l + 16);
        this.gr.pix(0, 0, 0, 'pixdefsmall1');
    }
    displayRoutine10() {
        // SPIN lines 709-731
        this.gr.width(this.totalavg + 16);
        this.gr.pix(-35, 0, 0, 'pixdeftriclear3');
        this.gr.pix(35, 0, 0, 'pixdeftriclear3');
        if (this.j % 2 === 0) {
            this.changebit = !this.changebit;
            this.gr.width(this.scalar_l);
            this.gr.pix(0, 0, 1, 'pixdefsmall1');
        } else {
            this.gr.width(this.scalar_bigd);
        }
        this.gr.width(this.scalar_r);
        if (this.changebit === false) {
            this.gr.pix(0, 0, 0, 'pixdeftriclear2a');
        } else {
            this.gr.pix(0, 0, 0, 'pixdeftriclear2b');
        }
        this.gr.width(this.scalar_l);
        this.gr.pix(0, 0, 0, 'pixdefsmall1');
    }
    displayRoutine11() {
        // SPIN lines 735-758 (stripes)
        this.gr.width(this.scalar_l + 16);
        this.gr.pix(0, 0, 0, 'pixdefhollow3');
        this.gr.pix(45, 0, 0, 'pixdefhollow3');
        this.gr.pix(0, 45, 0, 'pixdefhollow3');
        this.gr.pix(-45, 0, 0, 'pixdefhollow3');
        this.gr.pix(0, -45, 0, 'pixdefhollow3');
        this.gr.pix(45, 45, 0, 'pixdefhollow3');
        this.gr.pix(-45, 45, 0, 'pixdefhollow3');
        this.gr.pix(-45, -45, 0, 'pixdefhollow3');
        this.gr.pix(45, -45, 0, 'pixdefhollow3');
        this.gr.width(this.scalar_r + 16);
        this.gr.pix(0, 0, 0, 'pixdefsmall2');
        this.gr.pix(45, 0, 0, 'pixdefsmall1');
        this.gr.pix(0, 45, 0, 'pixdefsmall1');
        this.gr.pix(-45, 0, 0, 'pixdefsmall1');
        this.gr.pix(0, -45, 0, 'pixdefsmall1');
        this.gr.pix(45, 45, 0, 'pixdefsmall2');
        this.gr.pix(-45, 45, 0, 'pixdefsmall2');
        this.gr.pix(-45, -45, 0, 'pixdefsmall2');
        this.gr.pix(45, -45, 0, 'pixdefsmall2');
    }
    displayRoutine12() {
        // SPIN lines 762-780 (multiples2)
        this.gr.width(this.scalar_l + 16);
        this.gr.pix(0, 0, 0, 'pixdeftriclear1');
        this.gr.width(this.scalar_r + 16);
        if (this.rotateflag) {
            this.gr.pix(0, 0, 0, 'pixdeftriclear2a');
        } else {
            this.gr.pix(0, 0, 1, 'pixdeftriclear2b');
        }
        if (this.totalavg !== 0) {
            this.gr.width(Math.floor(this.totalavg / 2) + 16);
            this.gr.pix(-45, 0, 0, 'pixdeftriclear3');
            this.gr.pix(45, 0, 0, 'pixdeftriclear3');
            this.gr.pix(0, 45, 0, 'pixdeftriclear3');
            this.gr.pix(0, -45, 0, 'pixdeftriclear3');
        }
    }
    displayRoutine13() {
        // SPIN lines 783-806 (multiples4)
        this.gr.width(this.scalar_r + 16);
        this.gr.pix(0, 0, 0, 'pixdeftriclear2');
        this.gr.width(this.totalavg + 16);
        this.gr.pix(-(this.scalar_r * 4 + 24), -(this.scalar_r * 4 + 24), 0, 'pixdeftriclear2');
        this.gr.pix(-(this.scalar_r * 4 + 24), 0, 0, 'pixdeftriclear3');
        this.gr.pix((this.scalar_r * 4 + 24), (this.scalar_r * 4 + 24), 0, 'pixdeftriclear2');
        this.gr.pix((this.scalar_r * 4 + 24), 0, 0, 'pixdeftriclear3');
        this.gr.pix(-(this.scalar_r * 4 + 24), (this.scalar_r * 4 + 24), 0, 'pixdeftriclear2');
        this.gr.pix(0, (this.scalar_r * 4 + 24), 0, 'pixdeftriclear3');
        this.gr.pix((this.scalar_r * 4 + 24), -(this.scalar_r * 4 + 24), 0, 'pixdeftriclear2');
        this.gr.pix(0, -(this.scalar_r * 4 + 24), 0, 'pixdeftriclear3');
        this.gr.width(this.scalar_l + 16);
        this.gr.pix(0, 0, 0, 'pixdeftriclear1');
    }
    displayRoutine14() {
        // SPIN lines 808-827 (multiples5)
        this.gr.width(this.scalar_l + 16);
        this.gr.pix(0, 0, 0, 'pixdeftriclear1');
        this.gr.width(this.scalar_r + 16);
        this.gr.pix(0, 0, 0, 'pixdefhollow3');
        if (this.scalar_r > 2) {
            this.gr.width(Math.floor(this.scalar_r / 4) + 16);
            this.gr.pix(0, 0, 0, 'pixdefhollow3');
        }
        if (this.totalavg !== 0) {
            this.gr.width(Math.floor(this.totalavg / 2));
            this.gr.pix(0, 45, 0, 'pixdeftriclear3');
            this.gr.pix(0, -45, 0, 'pixdeftriclear3');
            this.gr.pix(0, 45, 0, 'pixdefhollow2');
            this.gr.pix(0, -45, 0, 'pixdefhollow2');
        }
    }
    displayRoutine15() {
        // SPIN lines 830-847 (multiples7)
        this.gr.width(this.scalar_l);
        this.gr.pix(0, 0, 0, 'pixdeftriclear1');
        this.gr.width(this.scalar_r + 16);
        this.gr.pix(0, 0, 0, 'pixdeftriclear2');
        if (this.totalavg !== 0) {
            this.gr.width(Math.floor(this.totalavg / 2) + 1);
            this.gr.pix(-45, 0, 0, 'pixdeftriclear3');
            this.gr.pix(45, 0, 0, 'pixdeftriclear3');
            this.gr.width(Math.floor(this.totalavg / 2) + 16);
            this.gr.pix(-45, 0, 0, 'pixdeftriclear2');
            this.gr.pix(45, 0, 0, 'pixdeftriclear2');
        }
    }
    displayRoutine16() {
        // Spin lines 850-879: Link sprites pattern
        if (this.j < 4 || (this.j > 7 && this.j < 12) || (this.j > 15 && this.j < 20) || (this.j > 23 && this.j < 28)) {
            this.gr.width(Math.floor(this.totalavg / 2) + 16);
            this.gr.pix(0, 45, 4, 'link2');
            this.gr.pix(-45, 0, 4, 'link2');
            this.gr.pix(45, 0, 4, 'link2');
            this.gr.pix(0, -45, 4, 'link2');
            this.gr.pix(-45, 45, 0, 'link1');
            this.gr.pix(45, 45, 0, 'link1');
            this.gr.pix(-45, -45, 0, 'link1');
            this.gr.pix(45, -45, 0, 'link1');
            
            this.gr.width(this.scalar_l + 16);
            this.gr.pix(0, 0, 0, 'link1');
        } else {
            this.gr.width(Math.floor(this.totalavg / 2) + 16);
            this.gr.pix(0, 45, 4, 'link1');
            this.gr.pix(-45, 0, 4, 'link1');
            this.gr.pix(45, 0, 4, 'link1');
            this.gr.pix(0, -45, 4, 'link1');
            this.gr.pix(-45, 45, 0, 'link2');
            this.gr.pix(45, 45, 0, 'link2');
            this.gr.pix(-45, -45, 0, 'link2');
            this.gr.pix(45, -45, 0, 'link2');
            
            this.gr.width(this.scalar_l + 16);
            this.gr.pix(0, 0, 0, 'link2');
        }
    }
    displayRoutine17() {
        // Spin lines 881-897: Mario/Mushroom sprites pattern
        this.gr.width(Math.floor(this.scalar_r / 3) + 16);
        this.gr.pix(-45, -45, 0, 'mushroom');
        this.gr.pix(-45, 0, 0, 'mushroom');
        this.gr.pix(45, 45, 0, 'mushroom');
        this.gr.pix(45, 0, 0, 'mushroom');
        this.gr.pix(-45, 45, 0, 'mushroom');
        this.gr.pix(0, 45, 0, 'mushroom');
        this.gr.pix(45, -45, 0, 'mushroom');
        this.gr.pix(0, -45, 0, 'mushroom');
        
        this.gr.width(this.scalar_l + 16);
        if ((this.j % 4) === 0 || ((this.j - 1) % 4) === 0) {
            this.gr.pix(0, 0, 0, 'mario');
        } else {
            this.gr.pix(0, 0, 0, 'mariojump');
        }
    }
    displayRoutine18() {
        // Spin lines 899-966: Pac-Man sprites pattern
        if (this.h === 0 || this.h === 4) {
            this.gr.width(this.scalar_l + 16);
            this.gr.pix(0, 0, 0, 'pacman3');
            this.gr.pix(-45, 0, 0, 'pacmanfood');
            
            if (this.scalar_l < 1) {
                this.gr.pix(((this.scalar_l * 8) + 25), 0, 0, 'pacmanghost1b');
            } else {
                this.gr.pix(((this.scalar_l * 8) + 25), 0, 0, 'pacmandead1b');
            }
            
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(0, 30, 4, 'pacman3');
            this.gr.pix(0, -30, 4, 'pacman3');
            this.gr.pix(45, 30, 4, 'pacmanfood');
            this.gr.pix(45, -30, 4, 'pacmanfood');
            
            if (this.scalar_l < 1) {
                this.gr.pix(-((this.scalar_l * 8) + 25), -30, 4, 'pacmanghost1b');
                this.gr.pix(-((this.scalar_l * 8) + 25), 30, 4, 'pacmanghost1b');
            } else {
                this.gr.pix(-((this.scalar_l * 8) + 25), -30, 4, 'pacmandead1b');
                this.gr.pix(-((this.scalar_l * 8) + 25), 30, 4, 'pacmandead1b');
            }
        } else if (this.h === 2 || this.h === 6) {
            this.gr.width(this.scalar_l + 16);
            this.gr.pix(0, 0, 0, 'pacman1');
            
            if (this.scalar_l < 1) {
                this.gr.pix(((this.scalar_l * 8) + 25), 0, 0, 'pacmanghost1b');
            } else {
                this.gr.pix(((this.scalar_l * 8) + 25), 0, 0, 'pacmandead1b');
            }
            
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(0, 30, 4, 'pacman1');
            this.gr.pix(0, -30, 4, 'pacman1');
            
            if (this.scalar_l < 1) {
                this.gr.pix(-((this.scalar_l * 8) + 25), 30, 4, 'pacmanghost1b');
                this.gr.pix(-((this.scalar_l * 8) + 25), -30, 4, 'pacmanghost1b');
            } else {
                this.gr.pix(-((this.scalar_l * 8) + 25), -30, 4, 'pacmandead1b');
                this.gr.pix(-((this.scalar_l * 8) + 25), 30, 4, 'pacmandead1b');
            }
        } else {
            this.gr.width(this.scalar_l + 16);
            this.gr.pix(0, 0, 0, 'pacman2');
            this.gr.pix(-30, 0, 0, 'pacmanfood');
            
            if (this.scalar_l < 1) {
                this.gr.pix(((this.scalar_l * 8) + 25), 0, 0, 'pacmanghost1a');
            } else {
                this.gr.pix(((this.scalar_l * 8) + 25), 0, 0, 'pacmandead1a');
            }
            
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(0, 30, 4, 'pacman2');
            this.gr.pix(0, -30, 4, 'pacman2');
            this.gr.pix(30, 30, 4, 'pacmanfood');
            this.gr.pix(30, -30, 4, 'pacmanfood');
            
            if (this.scalar_l < 1) {
                this.gr.pix(-((this.scalar_l * 8) + 25), 30, 4, 'pacmanghost1a');
                this.gr.pix(-((this.scalar_l * 8) + 25), -30, 4, 'pacmanghost1a');
            } else {
                this.gr.pix(-((this.scalar_l * 8) + 25), -30, 4, 'pacmandead1a');
                this.gr.pix(-((this.scalar_l * 8) + 25), 30, 4, 'pacmandead1a');
            }
        }
    }
    displayRoutine19() {
        // Spin lines 968-996: Space Invaders sprites pattern
        this.gr.width(this.scalar_l + 16);
        
        if ((this.j % 4) === 0 || ((this.j - 1) % 4) === 0) {
            this.gr.width(this.scalar_bigd);
            this.gr.pix(-40, 0, 0, 'SpaceInvaders4');
            this.gr.pix(40, 0, 0, 'SpaceInvaders4');
            this.gr.pix(0, 40, 0, 'SpaceInvaders4');
            this.gr.pix(0, -40, 0, 'SpaceInvaders4');
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(-40, -40, 0, 'SpaceInvaders1');
            this.gr.pix(40, 40, 0, 'SpaceInvaders1');
            this.gr.pix(-40, 40, 0, 'SpaceInvaders1');
            this.gr.pix(40, -40, 0, 'SpaceInvaders1');
            this.gr.pix(0, 0, 0, 'SpaceInvaders1');
        } else {
            this.gr.width(this.scalar_bigd);
            this.gr.pix(-40, 0, 0, 'SpaceInvaders3');
            this.gr.pix(40, 0, 0, 'SpaceInvaders3');
            this.gr.pix(0, 40, 0, 'SpaceInvaders3');
            this.gr.pix(0, -40, 0, 'SpaceInvaders3');
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(-40, -40, 0, 'SpaceInvaders2');
            this.gr.pix(40, 40, 0, 'SpaceInvaders2');
            this.gr.pix(-40, 40, 0, 'SpaceInvaders2');
            this.gr.pix(40, -40, 0, 'SpaceInvaders2');
            this.gr.pix(0, 0, 0, 'SpaceInvaders2');
        }
    }
    displayRoutine20() {
        // Spin lines 999-1014: Galaga sprites pattern
        this.gr.width(this.totalavg + 16);
        if ((this.j % 4) === 0 || ((this.j - 1) % 4) === 0) {
            this.gr.pix(-40, 25, 0, 'galagamoth1');
            this.gr.pix(0, 25, 0, 'galagamoth2');
            this.gr.pix(40, 25, 0, 'galagamoth1');
        } else {
            this.gr.pix(-40, 25, 0, 'galagamoth2');
            this.gr.pix(0, 25, 0, 'galagamoth1');
            this.gr.pix(40, 25, 0, 'galagamoth2');
        }
        
        this.gr.width(this.scalar_r + 16);
        if (this.j < 16) {
            this.gr.pix(this.j * 4 - 32, -10, 0, 'galaga');
        } else {
            this.gr.pix(-this.j * 4 + 96, -10, 0, 'galaga');
        }
    }
    displayRoutine21() {
        // Spin lines 1018-1057: Dig Dug sprites pattern
        this.gr.width(this.scalar_l);
        if ((this.j % 4) === 0 || ((this.j - 1) % 4) === 0) {
            this.gr.pix(40, 40, 4, 'digdug1');
            this.gr.pix(40, -40, 4, 'digdug1');
            this.gr.pix(-40, 40, 4, 'digdug1');
            this.gr.pix(-40, -40, 4, 'digdug1');
        } else {
            this.gr.pix(40, 40, 4, 'digdug2');
            this.gr.pix(40, -40, 4, 'digdug2');
            this.gr.pix(-40, 40, 4, 'digdug2');
            this.gr.pix(-40, -40, 4, 'digdug2');
        }
        this.gr.width(this.scalar_r + 16);
        if (this.j < 16) {
            if ((this.j % 4) === 0 || ((this.j - 1) % 4) === 0) {
                this.gr.pix(-15, 0, 4, 'digdug3');
            } else {
                this.gr.pix(-15, 0, 4, 'digdug4');
            }
            if (this.j < 4) {
                this.gr.pix(0, -2, 2, 'digdugharpoon');
                this.gr.pix(15, 0, 0, 'fygar3');
            } else if (this.j > 3 && this.j < 8) {
                this.gr.pix(0, -2, 2, 'digdugharpoon');
                this.gr.pix(15, 0, 0, 'fygar4');
            } else if (this.j > 7 && this.j < 12) {
                this.gr.pix(0, -2, 2, 'digdugharpoon');
                this.gr.pix(15, 0, 0, 'fygar5');
            } else {
                this.gr.pix(15, 0, 0, 'fygar6');
            }
        } else {
            if (this.j > 31) {
                this.gr.pix(-10, -2, 4, 'digdugharpoon');
                this.gr.pix(this.j * 2 - 79, 0, 4, 'digdug5');
                this.gr.pix(15, 0, 0, 'fygar1');
            } else if ((this.j % 4) === 0 || ((this.j - 1) % 4) === 0) {
                this.gr.pix(this.j * 2 - 79, 0, 4, 'digdug1');
                this.gr.pix(-this.j * 2 + 79, 0, 0, 'fygar1');
            } else {
                this.gr.pix(this.j * 2 - 79, 0, 4, 'digdug2');
                this.gr.pix(-this.j * 2 + 79, 0, 0, 'fygar2');
            }
        }
    }
    displayRoutine22() {
        // Spin lines 1059-1104: Bubble Bobble sprites pattern
        if ((this.j % 8) === 0 || ((this.j - 1) % 8) === 0) {
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(40, 40, 0, 'bubble4');
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(40, -40, 0, 'bubble4');
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(-40, 40, 0, 'bubble4');
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(-40, -40, 0, 'bubble4');
            this.gr.width(this.totalavg + 16);
            this.gr.pix(0, 0, 0, 'bubblebobble1');
        } else if (((this.j - 2) % 8) === 0 || ((this.j - 3) % 8) === 0) {
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(10, 10, 0, 'bubble1');
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(10, -10, 0, 'bubble1');
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(-10, 10, 0, 'bubble1');
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(-10, -10, 0, 'bubble1');
            this.gr.width(this.totalavg + 16);
            this.gr.pix(0, 0, 0, 'bubblebobble2');
        } else if (((this.j - 4) % 8) === 0 || ((this.j - 5) % 8) === 0) {
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(20, 20, 0, 'bubble2');
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(20, -20, 0, 'bubble2');
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(-20, 20, 0, 'bubble2');
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(-20, -20, 0, 'bubble2');
            this.gr.width(this.totalavg + 16);
            this.gr.pix(0, 0, 0, 'bubblebobble1');
        } else if (((this.j - 6) % 8) === 0 || ((this.j - 7) % 8) === 0) {
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(30, 30, 0, 'bubble3');
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(30, -30, 0, 'bubble3');
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(-30, 30, 0, 'bubble3');
            this.gr.width(this.scalar_r + 16);
            this.gr.pix(-30, -30, 0, 'bubble3');
            this.gr.width(this.totalavg + 16);
            this.gr.pix(0, 0, 0, 'bubblebobble3');
        }
    }
    displayRoutine23() {
        // Spin lines 1107-1140: Final Fantasy sprites pattern
        // Four 8-frame windows cycling two frames each, with outer four sprites and centered main sprite
        if ((this.j % 8) === 0 || ((this.j - 1) % 8) === 0) {
            this.gr.width(Math.floor(this.totalavg / 2) + 16);
            this.gr.pix(45, 0, 0, 'finalfantasy3');
            this.gr.pix(-45, 0, 0, 'finalfantasy3');
            this.gr.pix(0, 45, 0, 'finalfantasy3');
            this.gr.pix(0, -45, 0, 'finalfantasy3');
            this.gr.width(this.scalar_l + 16);
            this.gr.pix(0, 0, 0, 'finalfantasy1');
        } else if (((this.j - 2) % 8) === 0 || ((this.j - 3) % 8) === 0) {
            this.gr.width(Math.floor(this.totalavg / 2) + 16);
            this.gr.pix(45, 0, 0, 'finalfantasy4');
            this.gr.pix(-45, 0, 0, 'finalfantasy4');
            this.gr.pix(0, 45, 0, 'finalfantasy4');
            this.gr.pix(0, -45, 0, 'finalfantasy4');
            this.gr.width(this.scalar_l + 16);
            this.gr.pix(0, 0, 0, 'finalfantasy2');
        } else if (((this.j - 4) % 8) === 0 || ((this.j - 5) % 8) === 0) {
            this.gr.width(Math.floor(this.totalavg / 2) + 16);
            this.gr.pix(45, 0, 0, 'finalfantasy1');
            this.gr.pix(-45, 0, 0, 'finalfantasy1');
            this.gr.pix(0, 45, 0, 'finalfantasy1');
            this.gr.pix(0, -45, 0, 'finalfantasy1');
            this.gr.width(this.scalar_l + 16);
            this.gr.pix(0, 0, 0, 'finalfantasy3');
        } else if (((this.j - 6) % 8) === 0 || ((this.j - 7) % 8) === 0) {
            this.gr.width(Math.floor(this.totalavg / 2) + 16);
            this.gr.pix(45, 0, 0, 'finalfantasy2');
            this.gr.pix(-45, 0, 0, 'finalfantasy2');
            this.gr.pix(0, 45, 0, 'finalfantasy2');
            this.gr.pix(0, -45, 0, 'finalfantasy2');
            this.gr.width(this.scalar_l + 16);
            this.gr.pix(0, 0, 0, 'finalfantasy4');
        }
    }
    displayRoutine24() {
        // Pattern 24: Text visualization (lines 1142-1158 from VID PIX NTSC v1.2.2.spin)
        // Safety checks to prevent browser crashes
        if (this.scalar_l > 50 || this.scalar_r > 50) {
            console.warn("Pattern 24: Scalar values too high, limiting to prevent crash");
            return;
        }
        
        // gr.width(0)
        try { this.gr.width(0); } catch(e) { console.error('Pattern24 width error', e); return; }
        
        // Limit text scale to prevent excessive rendering
        const safeScalarL = Math.max(1, Math.min(5, Math.floor(this.scalar_l/2) + 1));
        const safeScalarR = Math.max(1, Math.min(5, Math.floor(this.scalar_r/2) + 1));
        
        // Draw all 13 columns (-6..6) distributed across frames to avoid stalls
        const columns = 13; // -6..6
        const perFrame = 3; // render 3 columns per frame
        const startIndex = ((this.j - 1) * perFrame) % columns; // 0..12 rotating window
        for (let i = 0; i < perFrame; i++) {
            const qIndex = (startIndex + i) % columns;
            const q = -6 + qIndex;
            // gr.textmode(scalar_l/2+1, scalar_r/2+1, 6, %0101)
            // Guard text parameters to prevent runaway rendering
            const xs = Math.max(1, Math.min(4, safeScalarL));
            const ys = Math.max(1, Math.min(4, safeScalarR));
            try { this.gr.textmode(xs, ys, 6, 0b0101); } catch(e) { console.error('Pattern24 textmode error', e); return; }
            
            // Ensure character codes are valid
            const char1 = this.charToString(Math.max(33, Math.min(126, this.str1)));
            const char2 = this.charToString(Math.max(33, Math.min(126, this.str2)));
            const char3 = this.charToString(Math.max(33, Math.min(126, this.str3)));
            
            // gr.color(1) - White text
            try { this.gr.color(1); } catch(e) { console.error('Pattern24 color1', e); return; }
            // gr.text(q*15, 0, @str1)
            try { this.gr.text(q * 15, 0, char1); } catch(e) { console.error('Pattern24 text a', e); return; }
            // gr.text(q*20, 10*scalar_l, @str2) - limit y offset
            try { this.gr.text(q * 20, Math.max(-40, Math.min(40, 10 * xs)), char2); } catch(e) { console.error('Pattern24 text b', e); return; }
            // gr.text(q*25, -10*scalar_l, @str3)
            try { this.gr.text(q * 25, Math.max(-40, Math.min(40, -10 * xs)), char3); } catch(e) { console.error('Pattern24 text c', e); return; }
            
            // gr.color(2) - Red text
            try { this.gr.color(2); } catch(e) { console.error('Pattern24 color2', e); return; }
            // gr.text(q*15, 30, @str1)
            try { this.gr.text(q * 15, 30, char1); } catch(e) { console.error('Pattern24 text d', e); return; }
            // gr.text(q*20, 30+10*scalar_l, @str2)
            try { this.gr.text(q * 20, Math.max(-40, Math.min(40, 30 + 10 * xs)), char2); } catch(e) { console.error('Pattern24 text e', e); return; }
            // gr.text(q*25, 30-10*scalar_l, @str3)
            try { this.gr.text(q * 25, Math.max(-40, Math.min(40, 30 - 10 * xs)), char3); } catch(e) { console.error('Pattern24 text f', e); return; }
            
            // gr.color(3) - Green text
            try { this.gr.color(3); } catch(e) { console.error('Pattern24 color3', e); return; }
            // gr.text(q*15, -30, @str1)
            try { this.gr.text(q * 15, -30, char1); } catch(e) { console.error('Pattern24 text g', e); return; }
            // gr.text(q*20, -30+10*scalar_l, @str2)
            try { this.gr.text(q * 20, Math.max(-40, Math.min(40, -30 + 10 * xs)), char2); } catch(e) { console.error('Pattern24 text h', e); return; }
            // gr.text(q*25, -30-10*scalar_l, @str3)
            try { this.gr.text(q * 25, Math.max(-40, Math.min(40, -30 - 10 * xs)), char3); } catch(e) { console.error('Pattern24 text i', e); return; }
        }
    }
    displayRoutine25() {
        // Spin lines 1161-1172
        this.gr.width(0);
        const xs = Math.floor(this.scalar_l / 2) + 1;
        const ys = Math.floor(this.scalar_r / 2) + 1;
        const char1 = this.charToString(Math.max(33, Math.min(126, this.str1)));
        const char2 = this.charToString(Math.max(33, Math.min(126, this.str2)));
        const char3 = this.charToString(Math.max(33, Math.min(126, this.str3)));
        for (let q = -6; q <= 6; q++) {
            this.gr.textmode(xs, ys, 6, 0b0101);
            this.gr.color(1);
            this.gr.text(0, q * 15, char1);
            this.gr.text(5 * this.scalar_l, q * 20, char2);
            this.gr.text(-5 * this.scalar_l, q * 25, char3);
            this.gr.color(2);
            this.gr.text(q * 15, 0, char1);
            this.gr.text(q * 20, 5 * this.scalar_l, char2);
            this.gr.text(q * 25, -5 * this.scalar_l, char3);
        }
    }
    displayRoutine26() {
        // Spin lines 1177-1192
        this.gr.width(0);
        const xs = Math.floor(this.scalar_l / 2) + 1;
        const ys = Math.floor(this.scalar_r / 2) + 1;
        const char1 = this.charToString(Math.max(33, Math.min(126, this.str1)));
        const char2 = this.charToString(Math.max(33, Math.min(126, this.str2)));
        const char3 = this.charToString(Math.max(33, Math.min(126, this.str3)));
        for (let q = -6; q <= 6; q++) {
            this.gr.textmode(xs, ys, 6, 0b0101);
            this.gr.color(1);
            this.gr.text(0, q * 15, char1);
            this.gr.text(5 * this.scalar_l, q * 20, char2);
            this.gr.text(-5 * this.scalar_l, q * 25, char3);
            this.gr.color(2);
            this.gr.text(30, q * 15, char1);
            this.gr.text(30 + 5 * this.scalar_l, q * 20, char2);
            this.gr.text(30 - 5 * this.scalar_l, q * 25, char3);
            this.gr.color(3);
            this.gr.text(-30, q * 15, char1);
            this.gr.text(-30 + 5 * this.scalar_l, q * 20, char2);
            this.gr.text(-30 - 5 * this.scalar_l, q * 25, char3);
        }
    }
    displayRoutine27() {
        // Spin lines 1197-1204
        this.gr.width(0);
        const xs = Math.floor(this.scalar_l / 2) + 1;
        const ys = Math.floor(this.scalar_r / 2) + 1;
        const char2 = this.charToString(Math.max(33, Math.min(126, this.str2)));
        for (let q = 0; q <= 12; q++) {
            this.gr.textmode(xs, ys, 6, 0b0101);
            this.gr.color(1);
            this.gr.textarc(0, 0, 30, 30, q * 683, char2);
            this.gr.color(2);
            this.gr.textarc(0, 0, 15 + 5 * this.scalar_l, 15 + 5 * this.scalar_l, q * 683, this.charToString(Math.max(33, Math.min(126, this.str3))));
        }
    }
    displayRoutine28() {
        // Spin lines 1208-1216
        this.gr.width(0);
        const xs = Math.floor(this.scalar_l / 2) + 1;
        const ys = Math.floor(this.scalar_r / 2) + 1;
        const s2 = this.charToString(Math.max(33, Math.min(126, this.str2)));
        const s3 = this.charToString(Math.max(33, Math.min(126, this.str3)));
        for (let q = 0; q <= 12; q++) {
            this.gr.textmode(xs, ys, 6, 0b0101);
            this.gr.color(1);
            this.gr.textarc(0, 0, 15 + 5 * this.scalar_l, 15 + 5 * this.scalar_l, q * 683, s2);
            this.gr.color(2);
            this.gr.textarc(-45, 0, 15, 15, q * 683, s3);
            this.gr.textarc(45, 0, 15, 15, q * 683, s3);
        }
    }
    displayRoutine29() {
        // Spin lines 1219-1223
        this.gr.width(0);
        const xs = this.scalar_l * 2 + 1;
        const ys = this.scalar_r * 2 + 1;
        this.gr.textmode(xs, ys, 6, 0b0101);
        this.gr.color(1);  // Missing color call from Spin line 1222 (implicit)
        const s2 = this.charToString(Math.max(33, Math.min(126, this.str2)));
        this.gr.text(0, 0, s2);
    }
    displayRoutine30() {
        // Spin lines 1225-1236
        this.gr.width(0);
        const xs = Math.floor(this.scalar_l / 2) + 1;
        const ys = Math.floor(this.scalar_r / 2) + 1;
        const s1 = this.charToString(Math.max(33, Math.min(126, this.str1)));
        const s2 = this.charToString(Math.max(33, Math.min(126, this.str2)));
        const s3 = this.charToString(Math.max(33, Math.min(126, this.str3)));
        for (let q = -1; q <= 1; q++) {
            this.gr.textmode(xs, ys, 6, 0b0101);
            this.gr.color(1);
            this.gr.text(q * 15, 0, s1);
            this.gr.color(2);
            this.gr.text(q * 15 - 5 * this.scalar_l, 5 * this.scalar_l, s2);
            this.gr.text(q * 15 + 5 * this.scalar_l, -5 * this.scalar_l, s3);
            this.gr.color(3);
            this.gr.text(q * 15 + 5 * this.scalar_l, 5 * this.scalar_l, s2);
            this.gr.text(q * 15 - 5 * this.scalar_l, -5 * this.scalar_l, s3);
        }
    }
    displayRoutine31() {
        // Spin lines 1239-1252
        this.gr.width(0);
        const xs = this.scalar_l * 2 + 1;
        const ys = this.scalar_r * 2 + 1;
        this.gr.textmode(xs, ys, 6, 0b0101);
        const s2 = this.charToString(Math.max(33, Math.min(126, this.str2)));
        const s3 = this.charToString(Math.max(33, Math.min(126, this.str3)));
        this.gr.color(1);
        this.gr.text(0, 0, s2);
        this.gr.color(2);
        this.gr.text(0, 30, s2);
        this.gr.text(0, -30, s2);
        this.gr.text(-30, 0, s2);
        this.gr.text(30, 0, s2);
        this.gr.color(3);
        this.gr.text(30, 30, s3);
        this.gr.text(30, -30, s3);
        this.gr.text(-30, 30, s3);
        this.gr.text(-30, -30, s3);
    }
    displayRoutine32() {
        // Spin 32:
        // gr.colorwidth(scalar_l+1,scalar_r/4)
        // repeat r from -1 to 1
        //    gr.vec(0, r*40, scalar_l*500, 0, @vecdef)
        //
        // vecdef pattern: 0°(len5), 90°(len3), 180°(len5), 270°(len3), 360°(len5)
        const gr = this.gr;
        gr.colorwidth(this.scalar_l + 1, Math.floor(this.scalar_r / 4));
        for (let r = -1; r <= 1; r++) {
            const cx = 0;
            const cy = r * 40;
            const baseScale = this.scalar_l * 500; // match Spin's scalar_l*500
            const degToA = (deg) => Math.floor((deg * 8191) / 360);
            
            // Replicate vecdef pattern: cardinal spokes with alternating lengths
            // 0° (East), length 5
            gr.vecarc(cx, cy, 5, 5, degToA(0), baseScale, degToA(0), 'vecdef');
            // 90° (North), length 3  
            gr.vecarc(cx, cy, 3, 3, degToA(90), baseScale, degToA(90), 'vecdef');
            // 180° (West), length 5
            gr.vecarc(cx, cy, 5, 5, degToA(180), baseScale, degToA(180), 'vecdef');
            // 270° (South), length 3
            gr.vecarc(cx, cy, 3, 3, degToA(270), baseScale, degToA(270), 'vecdef');
        }
    }
    displayRoutine33() {
        // Spin 33:
        // gr.colorwidth(scalar_l+1,scalar_r/4)
        // repeat r from -2 to 2
        //    gr.vec(r*40, 0, scalar_l*300+$100, 0, @vecdef2)
        //    gr.vec(r*40+20, 40, scalar_l*300+$100, 0, @vecdef2)
        //    gr.vec(r*40+20, -40, scalar_l*300+$100, 0, @vecdef2)
        //
        // vecdef2 pattern: all cardinal directions (0°,90°,180°,270°,360°) with length 5
        const gr = this.gr;
        gr.colorwidth(this.scalar_l + 1, Math.floor(this.scalar_r / 4));
        const baseScale = this.scalar_l * 300 + 0x100; // match Spin's scalar_l*300+$100
        const degToA = (deg) => Math.floor((deg * 8191) / 360);
        
        for (let r = -2; r <= 2; r++) {
            // Center row: gr.vec(r*40, 0, scalar_l*300+$100, 0, @vecdef2)
            const x1 = r * 40;
            gr.vecarc(x1, 0, 5, 5, degToA(0), baseScale, degToA(0), 'vecdef2');
            gr.vecarc(x1, 0, 5, 5, degToA(90), baseScale, degToA(90), 'vecdef2');
            gr.vecarc(x1, 0, 5, 5, degToA(180), baseScale, degToA(180), 'vecdef2');
            gr.vecarc(x1, 0, 5, 5, degToA(270), baseScale, degToA(270), 'vecdef2');
            
            // Upper row: gr.vec(r*40+20, 40, scalar_l*300+$100, 0, @vecdef2)
            const x2 = r * 40 + 20;
            gr.vecarc(x2, 40, 5, 5, degToA(0), baseScale, degToA(0), 'vecdef2');
            gr.vecarc(x2, 40, 5, 5, degToA(90), baseScale, degToA(90), 'vecdef2');
            gr.vecarc(x2, 40, 5, 5, degToA(180), baseScale, degToA(180), 'vecdef2');
            gr.vecarc(x2, 40, 5, 5, degToA(270), baseScale, degToA(270), 'vecdef2');
            
            // Lower row: gr.vec(r*40+20, -40, scalar_l*300+$100, 0, @vecdef2)
            gr.vecarc(x2, -40, 5, 5, degToA(0), baseScale, degToA(0), 'vecdef2');
            gr.vecarc(x2, -40, 5, 5, degToA(90), baseScale, degToA(90), 'vecdef2');
            gr.vecarc(x2, -40, 5, 5, degToA(180), baseScale, degToA(180), 'vecdef2');
            gr.vecarc(x2, -40, 5, 5, degToA(270), baseScale, degToA(270), 'vecdef2');
        }
    }
    displayRoutine34() {
        // Spin 34:
        // gr.colorwidth(scalar_l+1, 0)
        // repeat r from 0 to 2
        //   if j//2==0
        //      gr.vec(0, 0, scalar_l*500+$100, k*100+r*scalar_r*500, @vecdef3)
        //   else
        //      gr.vec(0, 0, scalar_l*500+$100, k*100+r*scalar_r*500, @vecdef3)
        const gr = this.gr;
        const baseScaleBase = this.scalar_l * 500 + 0x100;
        const addA = (a, b) => (a + b) & 0x1FFF; // 0..8191 wrap
        const degToA = (deg) => Math.floor((deg * 8191) / 360);
        gr.colorwidth(this.scalar_l + 1, 0);
        for (let rr = 0; rr <= 2; rr++) {
            const rotA = (this.k * 100 + rr * this.scalar_r * 500) & 0x1FFF;
            const baseScale = baseScaleBase; // same both branches
            // vecdef3 angles: 90°, 210°, 330°, 90° with length 3
            gr.vecarc(0, 0, 3, 3, addA(rotA, degToA(90)), baseScale, addA(rotA, degToA(90)), 'vecdef3');
            gr.vecarc(0, 0, 3, 3, addA(rotA, degToA(210)), baseScale, addA(rotA, degToA(210)), 'vecdef3');
            gr.vecarc(0, 0, 3, 3, addA(rotA, degToA(330)), baseScale, addA(rotA, degToA(330)), 'vecdef3');
            gr.vecarc(0, 0, 3, 3, addA(rotA, degToA(90)), baseScale, addA(rotA, degToA(90)), 'vecdef3');
        }
    }
    displayRoutine35() {
        // Spin 35:
        // gr.colorwidth(scalar_l+1,0)
        // repeat r from -4 to 4
        //    gr.vec(r*20, 0, scalar_l*100+$100, 0, @vecdef4)
        const gr = this.gr;
        const baseScale = this.scalar_l * 100 + 0x100;
        const degToA = (deg) => Math.floor((deg * 8191) / 360);
        gr.colorwidth(this.scalar_l + 1, 0);
        for (let rr = -4; rr <= 4; rr++) {
            const cx = rr * 20;
            // vecdef4 sequence: 0° len3, 90° len15, 180° len3, 270° len15, 0° len3
            gr.vecarc(cx, 0, 3, 3, degToA(0), baseScale, degToA(0), 'vecdef4');
            gr.vecarc(cx, 0, 15, 15, degToA(90), baseScale, degToA(90), 'vecdef4');
            gr.vecarc(cx, 0, 3, 3, degToA(180), baseScale, degToA(180), 'vecdef4');
            gr.vecarc(cx, 0, 15, 15, degToA(270), baseScale, degToA(270), 'vecdef4');
            gr.vecarc(cx, 0, 3, 3, degToA(0), baseScale, degToA(0), 'vecdef4');
        }
    }
    displayRoutine36() {
        // Spin 36:
        // gr.colorwidth(scalar_l+1, scalar_l/5)
        // gr.arc (0, 0, scalar_r*5, scalar_r*5, k*400, scalar_r*10, $60, 2)
        this.gr.colorwidth(this.scalar_l + 1, Math.floor(this.scalar_l / 5));
        this.gr.arc(0, 0, this.scalar_r * 5, this.scalar_r * 5, this.k * 400, this.scalar_r * 10, 0x60, 2);
    }
    displayRoutine37() {
        // Spin 37:
        // gr.colorwidth(scalar_r+1, 0)
        //   plot/line star pattern using scalar_l, scalar_r
        const gr = this.gr;
        gr.colorwidth(this.scalar_r + 1, 0);
        gr.plot(0, 0);
        gr.line(-this.scalar_l * 5, this.scalar_r * 5);
        gr.plot(0, 0);
        gr.line(-this.scalar_l * 5, -this.scalar_r * 5);
        gr.plot(0, 0);
        gr.line(this.scalar_l * 5, this.scalar_r * 5);
        gr.plot(0, 0);
        gr.line(this.scalar_l * 5, -this.scalar_r * 5);
        gr.plot(-this.scalar_l, this.scalar_r);
        gr.line(-this.scalar_l * 5, this.scalar_r * 5);
        gr.plot(-this.scalar_l, -this.scalar_r);
        gr.line(-this.scalar_l * 5, -this.scalar_r * 5);
        gr.plot(this.scalar_l, this.scalar_r);
        gr.line(this.scalar_l * 5, this.scalar_r * 5);
        gr.plot(this.scalar_l, -this.scalar_r);
        gr.line(this.scalar_l * 5, -this.scalar_r * 5);
    }
    displayRoutine38() {
        // Spin 38:
        // gr.colorwidth(scalar_l+1, 0)
        // gr.arc (scalar_l*10-50, scalar_r*10-40, scalar_l*10, scalar_r*10, k*100, 600, $4, 3)
        this.gr.colorwidth(this.scalar_l + 1, 0);
        this.gr.arc(this.scalar_l * 10 - 50, this.scalar_r * 10 - 40, this.scalar_l * 10, this.scalar_r * 10, this.k * 100, 600, 0x4, 3);
    }
    displayRoutine39() {
        // Spin 39:
        // gr.colorwidth(scalar_l+1, scalar_r*5)
        // gr.arc (0, 0, scalar_l*5, scalar_r*5, k*100, scalar_r*600, $4, 0)
        this.gr.colorwidth(this.scalar_l + 1, this.scalar_r * 5);
        this.gr.arc(0, 0, this.scalar_l * 5, this.scalar_r * 5, this.k * 100, this.scalar_r * 600, 0x4, 0);
    }
    displayRoutine40() {
        // Spin 40:
        // ADC_AVG := 75 (frame rate hint on hardware; no-op here)
        // if scalar_r =< 2
        //   gr.width(16+scalar_r)
        // else
        //   gr.width(18)
        // if h == 0..7 -> draw fire1..fire8 at (0,-36)
        // gr.width(19)
        // gr.pix(0, -scalar_l*2+16, 0, @santa)
        // gr.pix(0, 0, 0, @fireplace)
        const gr = this.gr;
        if (this.scalar_r <= 2) {
            gr.width(16 + this.scalar_r);
        } else {
            gr.width(18);
        }
        // Adjust fire position to center flames in fireplace opening
        // Fire sprites are 32px tall with most flame detail in upper portion
        const fireY = -20; // Move fire up to better center flames in fireplace
        if (this.h === 0) {
            gr.pix(0, fireY, 0, 'fire1');
        } else if (this.h === 1) {
            gr.pix(0, fireY, 0, 'fire2');
        } else if (this.h === 2) {
            gr.pix(0, fireY, 0, 'fire3');
        } else if (this.h === 3) {
            gr.pix(0, fireY, 0, 'fire4');
        } else if (this.h === 4) {
            gr.pix(0, fireY, 0, 'fire5');
        } else if (this.h === 5) {
            gr.pix(0, fireY, 0, 'fire6');
        } else if (this.h === 6) {
            gr.pix(0, fireY, 0, 'fire7');
        } else if (this.h === 7) {
            gr.pix(0, fireY, 0, 'fire8');
        }
        gr.width(19);
        gr.pix(0, -this.scalar_l * 2 + 16, 0, 'santa');
        gr.pix(0, 0, 0, 'fireplace');
    }
    displayRoutine41() {
        // Spin 41:
        // repeat r from 0 to 6
        //   gr.color(3)
        //   gr.vecarc(-1,19,(15+scalar_r)*2,(15+scalar_r)*2,-($3ff*r+$bfd),$100*(scalar_r+1)*2,-$3ff*r+$3ff,@vecdef5)
        // q := randomgen(16)
        // r := randomgen(16)
        // gr.vec(q*8-64, r*4-32, $100*(scalar_l)/8, $3ff, @vecdef5)
        // gr.vec(q*8-64, r*4-32, $100*(scalar_l)/8, $BFD, @vecdef5)
        // gr.width(16)
        // gr.pix(-3, -32, 0, @leglampleg)
        // gr.pix(0, 26, 0, @leglampshade)
        //
        // vecdef5 pattern: 0°(len1), 180°(len1) - simple horizontal line
        const gr = this.gr;
        
        // Ring of vector arcs (seven iterations: 0 to 6)
        for (let r = 0; r <= 6; r++) {
            gr.color(3);
            const xr = (15 + this.scalar_r) * 2;
            const yr = (15 + this.scalar_r) * 2;
            const startAngle = -((0x3FF * r) + 0xBFD);
            const vecScale = (0x100 * (this.scalar_r + 1)) * 2;
            const endAngle = (-(0x3FF * r)) + 0x3FF;
            gr.vecarc(-1, 19, xr, yr, startAngle, vecScale, endAngle, 'vecdef5');
        }
        
        // Two random vector lines using vecdef5 at specific angles
        const q = this.randomgen(16);
        const r = this.randomgen(16);
        const vx = q * 8 - 64;
        const vy = r * 4 - 32;
        const scale = Math.floor((0x100 * this.scalar_l) / 8);
        
        // Use vecarc as surrogate for vec - vecdef5 is a simple horizontal line pattern
        // First vec call: angle $3FF
        gr.vecarc(vx, vy, 1, 1, 0x3FF, scale, 0x3FF, 'vecdef5');
        // Second vec call: angle $BFD  
        gr.vecarc(vx, vy, 1, 1, 0xBFD, scale, 0xBFD, 'vecdef5');
        
        // Draw leg lamp sprites with adjusted positioning for tall sprites
        gr.width(16);
        gr.pix(-3, -32 + 32, 0, 'leglampleg');  // Adjust for 65px tall sprite
        gr.pix(0, 26, 0, 'leglampshade');
    }
    displayRoutine42() {
        // Spin 42: Fireplace scene with stockings
        const gr = this.gr;
        
        // ADC_AVG := 50 (frame rate control in original)
        
        // Draw alternating vecdef7/8 vertical lines
        gr.color(3);
        for (let r = -5; r <= 4; r++) {
            if ((r % 2) === 0) {
                gr.vecarc(0, r * 10, 0, 0, 0, 0x100, 0, 'vecdef7');
            } else {
                gr.vecarc(0, r * 10, 0, 0, 0, 0x100, 0, 'vecdef8');
            }
        }
        
        // Fire animation with adjusted positioning for 32px tall sprites
        gr.width(16 + this.scalar_r);
        const fireY = -32;  // Match SPIN positioning exactly
        if (this.h === 0) gr.pix(0, fireY, 0, 'fire1');
        else if (this.h === 1) gr.pix(0, fireY, 0, 'fire2');
        else if (this.h === 2) gr.pix(0, fireY, 0, 'fire3');
        else if (this.h === 3) gr.pix(0, fireY, 0, 'fire4');
        else if (this.h === 4) gr.pix(0, fireY, 0, 'fire5');
        else if (this.h === 5) gr.pix(0, fireY, 0, 'fire6');
        else if (this.h === 6) gr.pix(0, fireY, 0, 'fire7');
        else gr.pix(0, fireY, 0, 'fire8');
        // Logs
        gr.width(17);
        gr.pix(0, -33, 0, 'logs');
        // Fireplace top arc
        gr.width(16);
        gr.color(1);
        gr.arc(0, 95, 90, 60, 0, 0x17, 360, 2);
        // Stockings hung along the arc (simulate pixarc by point sampling)
        const toRad = (a) => (a / 8192) * Math.PI * 2;
        for (let rr = -3; rr <= 5; rr++) {
            const a = (0x155 * rr) - 0x7FF - (this.scalar_l * 0x2D);
            const ang = toRad(a & 0x1FFF);
            const x = Math.round(0 + 90 * Math.cos(ang));
            const y = Math.round(85 + 60 * Math.sin(ang));
            gr.width(16);
            gr.pix(x, y, 0, 'stocking');
        }
    }
    displayRoutine43() {
        // Spin 43: Random gnomes spread
        const gr = this.gr;
        gr.width(16);
        for (let r = this.scalar_r * 3; r >= 0; r--) {
            const x = (16 * this.randomgen(8)) - 73;
            const y = (11 * this.randomgen(8)) - 48;
            gr.pix(x, y, 0, 'gnome');
        }
    }
    displayRoutine44() {
        // Spin 44: YHDOD easter egg
        const gr = this.gr;
        gr.pix(0, -20, 0, 'yhdod');
        if ((this.j % 2) === 0) { gr.width(16); gr.pix(0, 0, 0, 'easteregg1'); }
        else { gr.pix(0, 0, 0, 'easteregg2'); }
    }
    displayRoutine45() {
        const gr = this.gr;
        // Lissajous/oscilloscope-like cross plot
        gr.colorwidth(this.scalar_l + 1, Math.floor(this.scalar_r / 6));
        const i = (this.scalar_l + 1);
        const h = (this.scalar_r + 1);
        for (let rr = 0; rr <= 7; rr++) {
            const xr = this.scalar_l * 6 + 10 + rr * 4;
            const yr = this.scalar_r * 6 + 10 + rr * 3;
            const angStart = (this.k * (50 + i * 3) + rr * 180);
            const angLen = this.scalar_l * 12 + 256;
            gr.arc(0, 0, xr, yr, angStart, angLen, 0x120, 0);
        }
        gr.plot(0, 0); gr.line(this.scalar_l * 5 + this.totalavg, 0);
        gr.plot(0, 0); gr.line(0, this.scalar_r * 5 + this.totalavg);
        if (this.totalavg > this.prevavg + 5 && this.totalavg > 8 && !gr.paletteLocked) {
            gr.setAreaColor(0, 0, 7, 5, Math.max(0, Math.min(29, (i + this.j) & 0x3F)));
        }
        this.prevavg = this.totalavg;
    }
    displayRoutine46() {
        const gr = this.gr;
        if (this.j === 1) { this.p46_q = 0; }
        gr.colorwidth(this.scalar_l + 2, Math.floor(this.scalar_r / 5));
        if (this.p46_q < this.totalavg * 24) this.p46_q = this.totalavg * 24; else this.p46_q = Math.max(0, this.p46_q - 8);
        const p = (this.scalar_l - this.scalar_r) * 6 + this.j * 20;
        for (let rr = 0; rr < 16; rr++) {
            const radius = this.p46_q + rr * 4;
            gr.vecarc(0, 0, radius, radius, (0x80 * rr) + p, 0x100 + this.scalar_l * 6, (0x80 * rr) + p + 0x40, 'vecdef5');
        }
    }
    displayRoutine47() {
        const gr = this.gr;
        if (this.j === 1) { this.prevavg = this.totalavg; this.p47_q = 0; this.p47_p = 0; }
        this.p47_q = Math.floor(this.totalavg / 4) * 6 + 10;
        if ((this.j % 4) === 0) { this.p47_p += 0x100; if (this.p47_p >= 0x800) this.p47_p -= 0x800; }
        const i = (Math.floor(this.j / 8)) & 3;
        if (!gr.paletteLocked) gr.setAreaColor(0, 0, 7, 5, Math.max(0, Math.min(29, (i * 8 + 32) & 0x3F)));
        gr.colorwidth(1 + (i & 1), 0);
        gr.width(4);
        for (let rr = 0; rr < 16; rr++) {
            const h = (0x80 * rr) + this.p47_p;
            const l = this.p47_q + ((rr & 1) * 12);
            gr.vecarc(0, 0, l, l, h, 0x120, h + 0x20, 'vecdef5');
            gr.vecarc(0, 0, Math.floor(l / 2), Math.floor(l / 2), h + 0x400, 0x120, h + 0x400 + 0x20, 'vecdef5');
        }
        if (this.totalavg > this.prevavg + 6 && this.totalavg > 12) {
            gr.colorwidth(3, 0);
            gr.width(8);
            gr.plot(-62, -46); gr.line(124, 0);
            gr.plot(-62, 46);  gr.line(124, 0);
            gr.plot(-62, -46); gr.line(0, 92);
            gr.plot(62, -46);  gr.line(0, 92);
        }
        this.prevavg = this.totalavg;
    }
    displayRoutine48() {
        // Pong: Classic Pong with score tracking and authentic visuals
        const gr = this.gr;
        if (this.j === 1) {
            this.p48_xs = 0;      // ball x
            this.p48_ys = 0;      // ball y
            this.p48_tmp = 1;     // x dir: 1 or -1
            this.p48_r = 1;       // y dir: 1 or -1
            this.p48_q = 2;       // base speed
            this.p48_l = 0;       // paddle hit timer
            this.pong_score1 = 0; // left
            this.pong_score2 = 0; // right
            this.prevavg = this.totalavg;
        }
        // Paddle positions from audio
        this.pong_p1y = Math.max(-35, Math.min(30, (this.scalar_l * 3) - 24));
        this.pong_p2y = Math.max(-35, Math.min(30, (this.scalar_r * 3) - 24));
        // Paddles with pulse on strong beats
        gr.colorwidth(1, 0);
        gr.width(this.totalavg > 10 ? 8 : 6);
        gr.plot(-60, this.pong_p1y - 12); gr.line(0, 24);
        gr.width(this.totalavg > 10 ? 8 : 6);
        gr.plot(60, this.pong_p2y - 12); gr.line(0, 24);
        // Court boundaries
        gr.colorwidth(1, 0);
        gr.plot(-64, -38); gr.line(128, 0);
        gr.plot(-64, 38);  gr.line(128, 0);
        // Move ball every other frame
        if ((this.j % 2) === 0) {
            this.p48_q = 2 + Math.floor(this.totalavg / 8);
            this.p48_q = Math.max(2, Math.min(6, this.p48_q));
            this.p48_xs += this.p48_tmp * this.p48_q;
            this.p48_ys += this.p48_r * this.p48_q;
            // Top/bottom bounce
            if (this.p48_ys > 35 || this.p48_ys < -35) {
                this.p48_r = -this.p48_r;
                this.p48_ys = Math.max(-34, Math.min(34, this.p48_ys));
            }
            // Left paddle collision (visual x=-60, width ~6)
            if (this.p48_xs <= -54 && this.p48_xs >= -60) {
                if (this.p48_ys >= this.pong_p1y - 12 && this.p48_ys <= this.pong_p1y + 12) {
                    this.p48_tmp = 1;
                    this.p48_xs = -54;
                    this.p48_l = 6;
                    if (this.p48_ys < this.pong_p1y - 5) this.p48_r = -2;
                    else if (this.p48_ys > this.pong_p1y + 5) this.p48_r = 2;
                }
            }
            // Right paddle collision (visual x=60)
            if (this.p48_xs >= 54 && this.p48_xs <= 60) {
                if (this.p48_ys >= this.pong_p2y - 12 && this.p48_ys <= this.pong_p2y + 12) {
                    this.p48_tmp = -1;
                    this.p48_xs = 54;
                    this.p48_l = 6;
                    if (this.p48_ys < this.pong_p2y - 5) this.p48_r = -2;
                    else if (this.p48_ys > this.pong_p2y + 5) this.p48_r = 2;
                }
            }
            // Scoring
            if (this.p48_xs < -75) {
                this.pong_score2 = (this.pong_score2|0) + 1;
                this.p48_tmp = 1; this.p48_xs = 0; this.p48_ys = 0;
                this.p48_r = ((this.randomgen(2) * 2) - 3) * 1; // -1 or 1
                this.p48_q = 2; this.p48_l = 0;
            } else if (this.p48_xs > 75) {
                this.pong_score1 = (this.pong_score1|0) + 1;
                this.p48_tmp = -1; this.p48_xs = 0; this.p48_ys = 0;
                this.p48_r = ((this.randomgen(2) * 2) - 3) * 1;
                this.p48_q = 2; this.p48_l = 0;
            }
        }
        // Center dotted line
        gr.colorwidth(1, 0);
        for (let hh = -8; hh <= 8; hh++) {
            if ((hh % 2) === 0) { gr.plot(0, hh * 6); gr.line(0, 3); }
        }
        // Scores
        if ((this.pong_score1|0) === 0) { gr.width(16); gr.pix(-40, -42, 0, 'pixdeftriclear1'); }
        else if (this.pong_score1 === 1) { gr.width(12); gr.plot(-42, -42); gr.line(0, 16); }
        else if (this.pong_score1 === 2) { gr.width(8); gr.pix(-42, -42, 0, 'pixdeftriclear2'); }
        else if (this.pong_score1 === 3) { gr.width(8); gr.pix(-42, -42, 0, 'pixdeftriclear3'); }
        else if (this.pong_score1 === 4) { gr.width(10); gr.text(-42, -42, "4"); }
        else if (this.pong_score1 >= 5) { gr.width(10); gr.text(-42, -42, "5"); }
        if ((this.pong_score2|0) === 0) { gr.width(16); gr.pix(40, -42, 0, 'pixdeftriclear1'); }
        else if (this.pong_score2 === 1) { gr.width(12); gr.plot(42, -42); gr.line(0, 16); }
        else if (this.pong_score2 === 2) { gr.width(8); gr.pix(42, -42, 0, 'pixdeftriclear2'); }
        else if (this.pong_score2 === 3) { gr.width(8); gr.pix(42, -42, 0, 'pixdeftriclear3'); }
        else if (this.pong_score2 === 4) { gr.width(10); gr.text(42, -42, "4"); }
        else if (this.pong_score2 >= 5) { gr.width(10); gr.text(42, -42, "5"); }
        // Ball
        gr.width(8); gr.pix(this.p48_xs, this.p48_ys, 0, 'pixdefsmall1');
        // Paddle hit effect
        if (this.p48_l > 0) { gr.width(12); gr.pix(this.p48_xs, this.p48_ys, 0, 'pixdeftriclear1'); this.p48_l--; }
        // Beat flash
        if (this.totalavg > this.prevavg + 4 && this.totalavg > 6) { gr.width(32); gr.pix(0, 0, 0, 'pixdefhollow1'); }
        this.prevavg = this.totalavg;
        // Win reset
        if ((this.pong_score1|0) >= 5) {
            gr.width(0); gr.textmode(1,1,6,0b0101); gr.color(1); gr.text(-30, 0, "WIN!");
            this.pong_score1 = 0; this.pong_score2 = 0;
        } else if ((this.pong_score2|0) >= 5) {
            gr.width(0); gr.textmode(1,1,6,0b0101); gr.color(1); gr.text(30, 0, "WIN!");
            this.pong_score1 = 0; this.pong_score2 = 0;
        }
    }
    displayRoutine49() {
        const gr = this.gr;
        // Snake: audio-reactive path, food targets, growth and effects
        if (this.j === 1) {
            this.snake_len = 10;
            this.snake_phase = 0;
            this.snake_foodx = -30;
            this.snake_foody = 0;
            this.snake_foodcd = 0;
            this.prevavg = this.totalavg;
        }
        if ((this.j % 2) === 0) {
            this.snake_phase = this.snake_phase + (1 + Math.floor(this.totalavg / 6));
        }
        // compute head position with bounds
        let q = this.snake_phase;
        let xs = (this.scalar_l * 5 + 20) * (((q * 73) & 0x3FF) - 0x200) / 0x200;
        let ys = (this.scalar_r * 5 + 20) * (((q * 41) & 0x3FF) - 0x200) / 0x200;
        xs = Math.max(-60, Math.min(60, xs));
        ys = Math.max(-40, Math.min(40, ys));
        // maybe relocate food on beat with cooldown
        if (this.snake_foodcd > 0) this.snake_foodcd = this.snake_foodcd - 1;
        if (this.totalavg > this.prevavg + 5 && this.totalavg > 10 && this.snake_foodcd === 0 && (this.randomgen(2) === 1)) {
            this.snake_foodx = Math.max(-36, Math.min(36, (this.randomgen(7) - 3) * 12));
            this.snake_foody = Math.max(-24, Math.min(24, (this.randomgen(7) - 3) * 8));
            this.snake_foodcd = 16;
        }
        this.prevavg = this.totalavg;
        // draw snake segments tail->head
        for (let r = 0; r <= this.snake_len - 1; r++) {
            q = this.snake_phase - r * 3;
            let i = (this.scalar_l * 5 + 20) * (((q * 73) & 0x3FF) - 0x200) / 0x200;
            let h = (this.scalar_r * 5 + 20) * (((q * 41) & 0x3FF) - 0x200) / 0x200;
            i = Math.max(-60, Math.min(60, i));
            h = Math.max(-40, Math.min(40, h));
            if (r === 0) {
                gr.width(6 + Math.floor(this.scalar_r / 3));
                gr.pix(i, h, 0, 'pixdefsmall2');
            } else {
                gr.width(4 + Math.floor((this.snake_len - r) / 3));
                gr.pix(i, h, 0, 'pixdefsmall1');
            }
        }
        // draw food
        gr.width(10 + Math.floor(this.scalar_l / 4));
        gr.pix(this.snake_foodx, this.snake_foody, 0, 'pixdefhollow2');
        // pickup
        if (xs > this.snake_foodx - 8 && xs < this.snake_foodx + 8 && ys > this.snake_foody - 8 && ys < this.snake_foody + 8) {
            this.snake_len = Math.min(30, this.snake_len + 2);
            gr.width(18);
            gr.pix(this.snake_foodx, this.snake_foody, 0, 'pixdeftriclear1');
            this.snake_foodx = Math.max(-36, Math.min(36, (this.randomgen(7) - 3) * 12));
            this.snake_foody = Math.max(-24, Math.min(24, (this.randomgen(7) - 3) * 8));
            this.snake_foodcd = 12;
        }
    }
    
    displayRoutine50() {
        // Spin 50: Breakout
        const gr = this.gr;
        if (this.j === 1) {
            this.p50_xs = 0;     // ball x
            this.p50_ys = 35;    // ball y
            this.p50_tmp = 1;    // x dir
            this.p50_r = 0;      // y vel (resting on paddle)
            this.p50_q = 0;      // paddle x
            this.prevavg = this.totalavg;
            this.p50_bricks = 0xFF; // 8 bricks bitmask
        }
        // Beat detection: launch ball upward on beat if on paddle
        if (this.totalavg > this.prevavg + 3 && this.totalavg > 5) {
            if (this.p50_ys > 30) {
                this.p50_r = -(3 + Math.floor(this.totalavg / 4));
            }
        }
        this.prevavg = this.totalavg;
        // Paddle position (audio)
        this.p50_q = Math.max(-50, Math.min(50, (this.scalar_l - this.scalar_r) * 3));
        // Physics every other frame
        if ((this.j % 2) === 0) {
            if (this.p50_r === 0 && this.p50_ys >= 35) {
                this.p50_xs = this.p50_q;
            } else {
                this.p50_xs += (this.p50_tmp * 2);
                this.p50_ys += this.p50_r;
            }
            // Walls
            if (this.p50_xs > 60 || this.p50_xs < -60) { this.p50_tmp = -this.p50_tmp; this.p50_xs = Math.max(-60, Math.min(60, this.p50_xs)); }
            if (this.p50_ys < -40) { this.p50_r = -this.p50_r; this.p50_ys = -40; }
            // Paddle bounce
            if (this.p50_ys >= 38 && this.p50_ys <= 40) {
                if (this.p50_xs >= this.p50_q - 12 && this.p50_xs <= this.p50_q + 12) {
                    this.p50_r = -Math.abs(this.p50_r) || -3;
                    if (this.p50_xs < this.p50_q - 6) this.p50_tmp = -2; else if (this.p50_xs > this.p50_q + 6) this.p50_tmp = 2;
                } else if (this.p50_ys > 40) {
                    // Missed paddle: reset
                    this.p50_xs = this.p50_q; this.p50_ys = 35; this.p50_r = 0; this.p50_tmp = ((this.randomgen(2) * 2) - 3);
                }
            }
        }
        // Brick collisions
        if (this.p50_ys < -20 && this.p50_ys > -30) {
            if (this.p50_xs > -40 && this.p50_xs < -20 && (this.p50_bricks & 0x80)) { this.p50_bricks &= 0x7F; this.p50_r = -this.p50_r; }
            else if (this.p50_xs > -20 && this.p50_xs < 0 && (this.p50_bricks & 0x40)) { this.p50_bricks &= 0xBF; this.p50_r = -this.p50_r; }
            else if (this.p50_xs > 0 && this.p50_xs < 20 && (this.p50_bricks & 0x20)) { this.p50_bricks &= 0xDF; this.p50_r = -this.p50_r; }
            else if (this.p50_xs > 20 && this.p50_xs < 40 && (this.p50_bricks & 0x10)) { this.p50_bricks &= 0xEF; this.p50_r = -this.p50_r; }
        } else if (this.p50_ys < -5 && this.p50_ys > -15) {
            if (this.p50_xs > -40 && this.p50_xs < -20 && (this.p50_bricks & 0x08)) { this.p50_bricks &= 0xF7; this.p50_r = -this.p50_r; }
            else if (this.p50_xs > -20 && this.p50_xs < 0 && (this.p50_bricks & 0x04)) { this.p50_bricks &= 0xFB; this.p50_r = -this.p50_r; }
            else if (this.p50_xs > 0 && this.p50_xs < 20 && (this.p50_bricks & 0x02)) { this.p50_bricks &= 0xFD; this.p50_r = -this.p50_r; }
            else if (this.p50_xs > 20 && this.p50_xs < 40 && (this.p50_bricks & 0x01)) { this.p50_bricks &= 0xFE; this.p50_r = -this.p50_r; }
        }
        // Draw bricks (two rows)
        gr.width(16 + Math.floor(this.scalar_l / 2));
        if (this.p50_bricks & 0x80) gr.pix(-30, -25, 0, 'pixdefhollow1');
        if (this.p50_bricks & 0x40) gr.pix(-10, -25, 0, 'pixdefhollow2');
        if (this.p50_bricks & 0x20) gr.pix(10, -25, 0, 'pixdefhollow3');
        if (this.p50_bricks & 0x10) gr.pix(30, -25, 0, 'pixdefhollow1');
        gr.width(16 + Math.floor(this.scalar_r / 2));
        if (this.p50_bricks & 0x08) gr.pix(-30, -10, 0, 'pixdefhollow2');
        if (this.p50_bricks & 0x04) gr.pix(-10, -10, 0, 'pixdefhollow3');
        if (this.p50_bricks & 0x02) gr.pix(10, -10, 0, 'pixdefhollow1');
        if (this.p50_bricks & 0x01) gr.pix(30, -10, 0, 'pixdefhollow2');
        // Paddle
        gr.width(4); gr.colorwidth(2, 0);
        gr.plot(this.p50_q - 12, 38); gr.line(24, 0);
        gr.plot(this.p50_q, 38); gr.line(0, 3);
        // Ball trail
        if (this.p50_r !== 0 || ((this.p50_tmp !== 0) && (this.j % 2) === 0)) { gr.width(12); gr.pix(this.p50_xs - this.p50_tmp * 2, this.p50_ys - this.p50_r, 0, 'pixdefhollow1'); }
        // Ball
        gr.width(16); gr.pix(this.p50_xs, this.p50_ys, 0, 'pixdefsmall1');
        // Reset bricks if all destroyed
        if (this.p50_bricks === 0) this.p50_bricks = 0xFF;
    }
    displayRoutine51() {
        const gr = this.gr;
        // Space Invaders Symphony - audio reactive formation with marching, shields and effects
        if (this.j === 1) {
            this.p51_xs = 0;            // xs in Spin
            this.p51_ys = 0;            // ys in Spin
            this.p51_tmp = 1;           // tmp (direction) in Spin
            this.p51_q = 50;            // q (laser y) in Spin
            this.prevavg = this.totalavg;
            this.p51_inv_top = 0b11111;
            this.p51_inv_mid = 0b11111;
            this.p51_inv_bot = 0b11111;
            this.p51_rally_cd = 0;      // rally_cd (laser cooldown) in Spin
        }
        // horizontal motion and gentle descent
        this.p51_xs = this.p51_xs + Math.floor(this.totalavg / 4) * this.p51_tmp;
        if (this.p51_xs > 20 || this.p51_xs < -20) {
            this.p51_tmp = -this.p51_tmp;
            this.p51_ys = this.p51_ys + 5;
            if (this.p51_ys > 30) this.p51_ys = 30;
        }
        // keep prevavg fresh roughly each animation step
        if ((this.j % 4) === 0) {
            this.prevavg = this.totalavg;
        }
        // formation spacing pulse with scalar_l
        const l = this.scalar_l;  // l in Spin
        // draw 3 rows x 5 columns
        for (let r = 0; r <= 4; r++) {
            const p = r * 20 + (l - 8);
            // top row: 3/4 alternating
            gr.width(16);
            if ((this.p51_inv_top & (1 << r)) !== 0) {
                if ((this.j % 4) === 0) gr.pix(this.p51_xs + p - 40, this.p51_ys - 25, 0, 'SpaceInvaders3');
                else gr.pix(this.p51_xs + p - 40, this.p51_ys - 25, 0, 'SpaceInvaders4');
            }
            // middle row: 1/2 alternating
            if ((this.p51_inv_mid & (1 << r)) !== 0) {
                if ((this.j % 4) === 0) gr.pix(this.p51_xs + p - 40, this.p51_ys - 5, 0, 'SpaceInvaders1');
                else gr.pix(this.p51_xs + p - 40, this.p51_ys - 5, 0, 'SpaceInvaders2');
            }
            // bottom row: 1/2 alternating
            if ((this.p51_inv_bot & (1 << r)) !== 0) {
                if ((this.j % 4) === 0) gr.pix(this.p51_xs + p - 40, this.p51_ys + 15, 0, 'SpaceInvaders1');
                else gr.pix(this.p51_xs + p - 40, this.p51_ys + 15, 0, 'SpaceInvaders2');
            }
        }
        // strong beat dive: choose column by h
        if (this.totalavg > 10) {
            let r = Math.floor((this.h & 7) / 2); // map 0..7 -> 0..3
            if (r > 4) r = 4;
            const p = r * 20 + (l - 8);
            if ((this.j % 2) === 0) {
                gr.pix(this.p51_xs + p - 40, this.p51_ys + 25, 0, 'SpaceInvaders2');
            }
        }
        // player ship at bottom
        gr.width(16);
        let i = (this.scalar_l - this.scalar_r) * 4;
        if (i < -60) i = -60;
        if (i > 60) i = 60;
        gr.pix(i, 35, 0, 'galaga');
        // laser: beat onset with cooldown
        if (this.p51_rally_cd > 0) this.p51_rally_cd = this.p51_rally_cd - 1;
        if (this.totalavg > this.prevavg + 3 && this.p51_q >= 50 && this.p51_rally_cd === 0) {
            this.p51_q = 34;  // start just above ship
            this.p51_rally_cd = 8;
        }
        // advance laser
        if (this.p51_q < 50) {
            gr.colorwidth(1, Math.floor(this.scalar_r / 4));
            gr.plot(i, this.p51_q);
            gr.line(0, -3);
            this.p51_q = this.p51_q - 3;
            // simple shield row visual
            if (this.p51_q === 15 || this.p51_q === 16) {
                gr.width(10);
                for (let p = -1; p <= 1; p++) gr.pix(p * 20, 20, 0, 'pixdefhollow3');
            }
            // hit detection against columns (visual knock-outs)
            if (this.p51_q < this.p51_ys + 20 && this.p51_q > this.p51_ys - 30) {
                let r = Math.max(0, Math.min(4, Math.floor((i - this.p51_xs + 40) / 20)));
                if ((this.p51_inv_bot & (1 << r)) !== 0) this.p51_inv_bot = this.p51_inv_bot & ~(1 << r);
                else if ((this.p51_inv_mid & (1 << r)) !== 0) this.p51_inv_mid = this.p51_inv_mid & ~(1 << r);
                else if ((this.p51_inv_top & (1 << r)) !== 0) this.p51_inv_top = this.p51_inv_top & ~(1 << r);
                this.p51_q = 50; // reset laser
            }
        }
        // slow descent for authentic space invaders feel
        if ((this.j % 8) === 0) this.p51_ys = this.p51_ys + 1;
        // reset invaders if all cleared
        if (this.p51_inv_top === 0 && this.p51_inv_mid === 0 && this.p51_inv_bot === 0) {
            this.p51_inv_top = 0b11111;
            this.p51_inv_mid = 0b11111;
            this.p51_inv_bot = 0b11111;
            this.p51_ys = -10;
            this.p51_rally_cd = 0;
        }
    }
    displayRoutine52() {
        // Audio Rally: Neon synth top-down road reacting to audio
        // init
        if (this.j === 1) {
            this.rally_carx = 0;
            this.rally_speed = 1;
            this.rally_cd = 0;
            this.rally_ti = 0;
            this.rdx0 = 0;
            this.rdx1 = 0;
            this.rdx2 = 0;
            this.rdx3 = 0;
            this.rdx4 = 0;
            this.obsmask = 0;
            this.prevavg = this.totalavg;
        }
        // enhanced neon palette cycling for more dynamic feel
        if ((this.j % 8) === 0 && this.totalavg > 8) {
            // Palette changes with speed (match Spin semantics) unless locked
            if (!this.gr || !this.gr.paletteLocked) {
                const pal = 36 + Math.floor(this.rally_speed / 8);
                // Clamp to available palettes 0..29 per request
                const clamped = Math.max(0, Math.min(29, pal));
                if (this.gr && typeof this.gr.setAreaColor === 'function') {
                    this.gr.setAreaColor(0, 0, 7, 5, clamped);
                }
            }
        }
        // speed and steering
        this.rally_speed = Math.max(10, Math.min(42, 10 + this.totalavg * 8));
        this.rally_carx = Math.floor(((this.scalar_l - this.scalar_r) * 3 + this.rally_carx * 2) / 3); // smoothed steering
        if (this.rally_carx < -50) {
            this.rally_carx = -50;
        }
        if (this.rally_carx > 50) {
            this.rally_carx = 50;
        }
        // push new road center at top (rdx4 is top, rdx0 bottom)
        if ((this.j % 2) === 0) {
            const tmp = this.rdx0; // save current bottom value
            this.rdx4 = this.rdx3;
            this.rdx3 = this.rdx2;
            this.rdx2 = this.rdx1;
            this.rdx1 = this.rdx0;
            this.rdx0 = Math.max(-40, Math.min(40, tmp + (this.scalar_l - this.scalar_r) * 2)); // use saved value to prevent feedback
        }
        // draw road edges from top to bottom bands
        this.gr.colorwidth(3, 0);
        this.gr.width(6);
        // top bands
        this.gr.plot(this.rdx4 - 12, -40);
        this.gr.line(0, 16);
        this.gr.plot(this.rdx4 + 12, -40);
        this.gr.line(0, 16);
        this.gr.plot(this.rdx3 - 14, -24);
        this.gr.line(0, 16);
        this.gr.plot(this.rdx3 + 14, -24);
        this.gr.line(0, 16);
        this.gr.plot(this.rdx2 - 16, -8);
        this.gr.line(0, 16);
        this.gr.plot(this.rdx2 + 16, -8);
        this.gr.line(0, 16);
        this.gr.plot(this.rdx1 - 18, 8);
        this.gr.line(0, 16);
        this.gr.plot(this.rdx1 + 18, 8);
        this.gr.line(0, 16);
        this.gr.plot(this.rdx0 - 20, 24);
        this.gr.line(0, 16);
        this.gr.plot(this.rdx0 + 20, 24);
        this.gr.line(0, 16);
        // center lane dashes with speed-reactive frequency and beat flash
        if ((Math.floor(this.j / Math.max(1, (5 - Math.floor(this.rally_speed / 12)))) % 2) === 0) { // faster dashes at higher speed, prevent div by 0
            this.gr.width(4 + Math.floor(this.totalavg / 4)); // pulse with audio
            this.gr.pix(this.rdx1, 8, 0, 'pixdefhollow1');
            this.gr.pix(this.rdx3, -24, 0, 'pixdefhollow1');
            // add more dashes for speed effect
            if (this.rally_speed > 25) {
                this.gr.pix(this.rdx0, 24, 0, 'pixdefhollow1');
                this.gr.pix(this.rdx2, -8, 0, 'pixdefhollow1');
            }
        }
        // obstacles on moderate beats with cooldown and chance
        if (this.rally_cd > 0) {
            this.rally_cd = this.rally_cd - 1;
        }
        if (this.totalavg > this.prevavg + 4 && this.totalavg > 8 && this.rally_cd === 0 && (this.randomgen(2) === 1)) {
            // spawn up to 3 obstacles cycling slots 0..2
            const p = this.rally_ti % 3;
            if (p === 0) {
                this.obsx0 = this.rdx4 + ((this.randomgen(3) - 2) * 12);
                this.obsy0 = -36;
                this.obsmask = this.obsmask | 0x01; // %001
            } else if (p === 1) {
                this.obsx1 = this.rdx4 + ((this.randomgen(3) - 2) * 12);
                this.obsy1 = -36;
                this.obsmask = this.obsmask | 0x02; // %010
            } else {
                this.obsx2 = this.rdx4 + ((this.randomgen(3) - 2) * 12);
                this.obsy2 = -36;
                this.obsmask = this.obsmask | 0x04; // %100
            }
            this.rally_cd = 12;
            this.rally_ti = this.rally_ti + 1;
        }
        this.prevavg = this.totalavg; // Fix missing beat detection update
        // move/draw obstacles neon style
        this.gr.width(10 + Math.floor(this.totalavg / 2));
        if (this.obsmask & 0x01) { // %001
            this.obsy0 = this.obsy0 + this.rally_speed / 6;
            this.gr.pix(this.obsx0, this.obsy0, 0, 'pixdefhollow3');
            if (this.obsy0 > 40) {
                this.obsmask = this.obsmask & 0x06; // %110
            }
        }
        if (this.obsmask & 0x02) { // %010
            this.obsy1 = this.obsy1 + this.rally_speed / 6;
            this.gr.pix(this.obsx1, this.obsy1, 0, 'pixdefhollow2');
            if (this.obsy1 > 40) {
                this.obsmask = this.obsmask & 0x05; // %101
            }
        }
        if (this.obsmask & 0x04) { // %100
            this.obsy2 = this.obsy2 + this.rally_speed / 6;
            this.gr.pix(this.obsx2, this.obsy2, 0, 'pixdefhollow1');
            if (this.obsy2 > 40) {
                this.obsmask = this.obsmask & 0x03; // %011
            }
        }
        // collision-like visual: if obstacle near car x at y ~ 28, flash and jitter car
        if ((this.obsmask & 0x01) && (this.obsy0 > 24 && this.obsy0 < 32) && (this.obsx0 > this.rally_carx - 10 && this.obsx0 < this.rally_carx + 10)) {
            this.gr.width(18);
            this.gr.pix(this.rally_carx, 28, 0, 'pixdeftriclear1');
            this.rally_carx = Math.max(-50, Math.min(50, this.rally_carx + ((this.randomgen(2) * 2 - 3) * 4))); // proper jitter with bounds
        }
        if ((this.obsmask & 0x02) && (this.obsy1 > 24 && this.obsy1 < 32) && (this.obsx1 > this.rally_carx - 10 && this.obsx1 < this.rally_carx + 10)) {
            this.gr.width(18);
            this.gr.pix(this.rally_carx, 28, 0, 'pixdeftriclear2');
            this.rally_carx = Math.max(-50, Math.min(50, this.rally_carx + ((this.randomgen(2) * 2 - 3) * 4))); // proper jitter with bounds
        }
        if ((this.obsmask & 0x04) && (this.obsy2 > 24 && this.obsy2 < 32) && (this.obsx2 > this.rally_carx - 10 && this.obsx2 < this.rally_carx + 10)) {
            this.gr.width(18);
            this.gr.pix(this.rally_carx, 28, 0, 'pixdeftriclear3');
            this.rally_carx = Math.max(-50, Math.min(50, this.rally_carx + ((this.randomgen(2) * 2 - 3) * 4))); // proper jitter with bounds
        }
        // tire tracks: volume-dependent persistence (more volume = thicker/longer)
        this.tt15 = this.tt14;
        this.tt14 = this.tt13;
        this.tt13 = this.tt12;
        this.tt12 = this.tt11;
        this.tt11 = this.tt10;
        this.tt10 = this.tt9;
        this.tt9 = this.tt8;
        this.tt8 = this.tt7;
        this.tt7 = this.tt6;
        this.tt6 = this.tt5;
        this.tt5 = this.tt4;
        this.tt4 = this.tt3;
        this.tt3 = this.tt2;
        this.tt2 = this.tt1;
        this.tt1 = this.tt0;
        this.tt0 = this.rally_carx;
        // draw tracks with decay
        for (let r = 0; r <= (8 + Math.floor(this.totalavg / 2)); r++) {
            this.gr.width(2 + Math.floor(this.totalavg / 5));
            this.gr.pix(this.tt0 - 2 + (r % 3), 30 - r * 2, 0, 'pixdefhollow1');
        }
        // draw car with speed-reactive effects
        this.gr.width(16 + Math.floor(this.totalavg / 2));
        this.gr.pix(this.rally_carx, 28, 0, 'pixdefsmall2');
        // add speed lines/exhaust at high speed
        if (this.rally_speed > 30) {
            this.gr.width(6);
            this.gr.colorwidth(2, 0);
            this.gr.plot(this.rally_carx - 3, 32);
            this.gr.line(0, 4 + Math.floor(this.rally_speed / 8)); // exhaust length scales with speed
            this.gr.plot(this.rally_carx + 3, 32);
            this.gr.line(0, 4 + Math.floor(this.rally_speed / 8));
        }
        // beat-reactive boost flash
        if (this.totalavg > this.prevavg + 6 && this.totalavg > 12) {
            this.gr.width(20);
            this.gr.pix(this.rally_carx, 28, 0, 'pixdeftriclear2');
        }
    }
    displayRoutine53() {
        // Spin 53: SkiFree - Flow
        const gr = this.gr;
        if (this.j === 1) {
            this.p53_xs = 0; this.p53_ys = -46; this.p53_r = 0; this.p53_q = 0; this.p53_t_init = 0;
            this.obsmask = 0; this.rally_cd = 0; this.p53_t_x = this.p53_xs; this.p53_yeti_state = 0; this.p53_yeti_timer = 0; this.prevavg = this.totalavg;
        }
        if ((this.j % 16) === 0 && this.totalavg > 8 && !gr.paletteLocked) gr.setAreaColor(0, 0, 7, 5, 36 + (Math.floor(this.j / 32) % 8));
        if (this.totalavg > this.prevavg + 6 && this.totalavg > 12) { gr.width(32); gr.colorwidth(3, 0); gr.arc(0, 0, this.totalavg * 4, this.totalavg * 4, this.k * 30, 0x40, 360, 2); }
        const speed = Math.max(10, Math.min(38, 10 + this.totalavg * 6));
        this.p53_xs = Math.floor(((this.scalar_l - this.scalar_r) * 3 + this.p53_xs * 3) / 4);
        if ((this.j % 2) === 0) { this.p53_ys += Math.floor(speed / 10); if (this.p53_ys > 30) this.p53_ys = -46; }
        // Trail
        this.tt15 = this.tt14; this.tt14 = this.tt13; this.tt13 = this.tt12; this.tt12 = this.tt11; this.tt11 = this.tt10; this.tt10 = this.tt9; this.tt9 = this.tt8; this.tt8 = this.tt7; this.tt7 = this.tt6; this.tt6 = this.tt5; this.tt5 = this.tt4; this.tt4 = this.tt3; this.tt3 = this.tt2; this.tt2 = this.tt1; this.tt1 = this.tt0; this.tt0 = this.p53_xs;
        for (let r = 0; r <= (12 + Math.floor(this.totalavg / 2)); r++) { gr.width(3 + Math.floor(this.totalavg / 4)); gr.pix(this.tt0 + Math.floor(r / 3), this.p53_ys - r * 2, 0, 'pixdefhollow1'); }
        // Edges
        gr.width(4); gr.plot(-52 + (this.scalar_l - 8), -48); gr.line(0, 96); gr.plot(52 + (8 - this.scalar_r), -48); gr.line(0, 96);
        // Obstacles
        if (this.rally_cd > 0) this.rally_cd--; if (this.totalavg > this.prevavg + 4 && this.totalavg > 8 && this.rally_cd === 0 && (this.randomgen(2) === 1)) {
            if (!(this.obsmask & 0x01)) { this.obsx0 = this.p53_xs + ((this.randomgen(3) - 2) * 20); this.obsy0 = -46; this.obsmask |= 0x01; }
            else if (!(this.obsmask & 0x02)) { this.obsx1 = this.p53_xs + ((this.randomgen(3) - 2) * 20); this.obsy1 = -46; this.obsmask |= 0x02; }
            else { this.obsx2 = this.p53_xs + ((this.randomgen(3) - 2) * 20); this.obsy2 = -46; this.obsmask |= 0x04; }
            this.rally_cd = 12;
        }
        this.prevavg = this.totalavg;
        gr.width(10 + Math.floor(this.totalavg / 2));
        if (this.obsmask & 0x01) { this.obsy0 += Math.floor(speed / 12); gr.pix(this.obsx0, this.obsy0, 0, 'pixdefhollow2'); if (Math.abs(this.obsx0 - this.p53_xs) < 10 && Math.abs(this.obsy0 - this.p53_ys) < 6) { gr.width(16); gr.pix(this.p53_xs, this.p53_ys, 0, 'pixdeftriclear2'); } if (this.obsy0 > 40) this.obsmask &= 0x06; }
        if (this.obsmask & 0x02) { this.obsy1 += Math.floor(speed / 12); gr.pix(this.obsx1, this.obsy1, 0, 'pixdefhollow3'); if (Math.abs(this.obsx1 - this.p53_xs) < 10 && Math.abs(this.obsy1 - this.p53_ys) < 6) { gr.width(16); gr.pix(this.p53_xs, this.p53_ys, 0, 'pixdeftriclear3'); } if (this.obsy1 > 40) this.obsmask &= 0x05; }
        if (this.obsmask & 0x04) { this.obsy2 += Math.floor(speed / 12); gr.pix(this.obsx2, this.obsy2, 0, 'pixdefhollow1'); if (Math.abs(this.obsx2 - this.p53_xs) < 10 && Math.abs(this.obsy2 - this.p53_ys) < 6) { gr.width(16); gr.pix(this.p53_xs, this.p53_ys, 0, 'pixdeftriclear1'); } if (this.obsy2 > 40) this.obsmask &= 0x03; }
        // Skier
        gr.width(14 + Math.floor(this.totalavg / 3)); gr.pix(this.p53_xs, this.p53_ys, 0, 'pixdefsmall2');
        // Yeti logic
        if (this.p53_yeti_state === 0) { if (this.p53_t_init < 600) this.p53_t_init++; else { this.p53_yeti_state = 1; this.p53_t_x = this.p53_xs + ((this.randomgen(2) * 2 - 3) * 40); } }
        else if (this.p53_yeti_state === 1) { gr.width(12); const t_y = -40 + (this.j & 7); this.p53_t_x = Math.floor((this.p53_t_x * 3 + this.p53_xs) / 4); gr.pix(this.p53_t_x, t_y, 0, 'pixdefhollow3'); if (Math.abs(this.p53_t_x - this.p53_xs) < 10 && this.p53_ys < -20) { this.p53_yeti_state = 2; this.p53_yeti_timer = 0; } }
        else { gr.width(16); gr.pix(this.p53_t_x, -20, 0, 'pixdeftriclear3'); if ((this.j % 4) === 0) { gr.width(12); gr.pix(this.p53_t_x, -16, 0, 'pixdefhollow1'); } gr.width(0); gr.textmode(1,1,6,0b0101); gr.color(3); gr.text(this.p53_t_x - 8, -12, "HA!"); this.p53_yeti_timer++; if (this.p53_yeti_timer > 120) { this.p53_yeti_state = 0; this.p53_t_init = 0; } }
    }
    displayRoutine54() {
        // Spin 54: SkiFree - Slalom
        const gr = this.gr;
        if (this.j === 1) { this.p54_xs = 0; this.p54_ys = -46; this.p54_r = 0; this.p54_q = 0; this.p54_t_init = 0; this.obsmask = 0; this.rally_cd = 0; this.p54_t_x = this.p54_xs; this.p54_yeti_state = 0; this.p54_yeti_timer = 0; this.prevavg = this.totalavg; }
        if ((this.j % 16) === 0 && this.totalavg > 8 && !gr.paletteLocked) gr.setAreaColor(0, 0, 7, 5, 36 + (Math.floor(this.j / 32) % 8));
        if (this.totalavg > this.prevavg + 5 && this.totalavg > 10) { gr.width(28); gr.colorwidth(2, 0); gr.arc(this.p54_xs, this.p54_ys, this.totalavg * 3, this.totalavg * 3, this.k * 45, 0x60, 360, 2); }
        const speed = Math.max(12, Math.min(40, 12 + this.totalavg * 7));
        this.p54_xs = Math.floor(((this.scalar_l - this.scalar_r) * 4 + this.p54_xs * 2) / 3);
        if ((this.j % 2) === 0) { this.p54_ys += Math.floor(speed / 9); if (this.p54_ys > 30) this.p54_ys = -46; }
        if ((this.j % 6) === 0) { gr.width(6); gr.pix(-30 + (this.scalar_l - 8), this.p54_ys - 20, 0, 'pixdefhollow2'); gr.pix(30 + (8 - this.scalar_r), this.p54_ys - 20, 0, 'pixdefhollow2'); }
        this.tt15 = this.tt14; this.tt14 = this.tt13; this.tt13 = this.tt12; this.tt12 = this.tt11; this.tt11 = this.tt10; this.tt10 = this.tt9; this.tt9 = this.tt8; this.tt8 = this.tt7; this.tt7 = this.tt6; this.tt6 = this.tt5; this.tt5 = this.tt4; this.tt4 = this.tt3; this.tt3 = this.tt2; this.tt2 = this.tt1; this.tt1 = this.tt0; this.tt0 = this.p54_xs;
        for (let r = 0; r <= (14 + Math.floor(this.totalavg / 2)); r++) { gr.width(2 + Math.floor(this.totalavg / 6)); gr.pix(this.tt0, this.p54_ys - Math.floor(r * 3 / 2), 0, 'pixdefhollow1'); }
        if (this.rally_cd > 0) this.rally_cd--; if (this.totalavg > this.prevavg + 3 && this.totalavg > 7 && this.rally_cd === 0) { if (!(this.obsmask & 0x01)) { this.obsx0 = this.p54_xs + ((this.randomgen(5) - 3) * 16); this.obsy0 = -46; this.obsmask |= 0x01; } else if (!(this.obsmask & 0x02)) { this.obsx1 = this.p54_xs + ((this.randomgen(5) - 3) * 16); this.obsy1 = -46; this.obsmask |= 0x02; } else if (!(this.obsmask & 0x04)) { this.obsx2 = this.p54_xs + ((this.randomgen(5) - 3) * 16); this.obsy2 = -46; this.obsmask |= 0x04; } this.rally_cd = 10; }
        this.prevavg = this.totalavg;
        gr.width(10 + Math.floor(this.totalavg / 2));
        if (this.obsmask & 0x01) { this.obsy0 += Math.floor(speed / 10); gr.pix(this.obsx0, this.obsy0, 0, 'pixdefhollow3'); if (Math.abs(this.obsx0 - this.p54_xs) < 10 && Math.abs(this.obsy0 - this.p54_ys) < 6) { gr.width(16); gr.pix(this.p54_xs, this.p54_ys, 0, 'pixdeftriclear2'); } if (this.obsy0 > 40) this.obsmask &= 0x06; }
        if (this.obsmask & 0x02) { this.obsy1 += Math.floor(speed / 10); gr.pix(this.obsx1, this.obsy1, 0, 'pixdefhollow1'); if (Math.abs(this.obsx1 - this.p54_xs) < 10 && Math.abs(this.obsy1 - this.p54_ys) < 6) { gr.width(16); gr.pix(this.p54_xs, this.p54_ys, 0, 'pixdeftriclear3'); } if (this.obsy1 > 40) this.obsmask &= 0x05; }
        if (this.obsmask & 0x04) { this.obsy2 += Math.floor(speed / 10); gr.pix(this.obsx2, this.obsy2, 0, 'pixdefhollow2'); if (Math.abs(this.obsx2 - this.p54_xs) < 10 && Math.abs(this.obsy2 - this.p54_ys) < 6) { gr.width(16); gr.pix(this.p54_xs, this.p54_ys, 0, 'pixdeftriclear1'); } if (this.obsy2 > 40) this.obsmask &= 0x03; }
        gr.width(14 + Math.floor(this.totalavg / 3)); gr.pix(this.p54_xs, this.p54_ys, 0, 'pixdefsmall2');
        if (this.p54_yeti_state === 0) { if (this.p54_t_init < 600) this.p54_t_init++; else { this.p54_yeti_state = 1; this.p54_t_x = this.p54_xs + ((this.randomgen(2) * 2 - 3) * 40); } }
        else if (this.p54_yeti_state === 1) { gr.width(12); const t_y = -40 + (this.j & 7); this.p54_t_x = Math.floor((this.p54_t_x * 3 + this.p54_xs) / 4); gr.pix(this.p54_t_x, t_y, 0, 'pixdefhollow3'); if (Math.abs(this.p54_t_x - this.p54_xs) < 10 && this.p54_ys < -20) { this.p54_yeti_state = 2; this.p54_yeti_timer = 0; } }
        else { gr.width(16); gr.pix(this.p54_t_x, -20, 0, 'pixdeftriclear3'); if ((this.j % 4) === 0) { gr.width(12); gr.pix(this.p54_t_x, -16, 0, 'pixdefhollow1'); } gr.width(0); gr.textmode(1,1,6,0b0101); gr.color(3); gr.text(this.p54_t_x - 8, -12, "HA!"); this.p54_yeti_timer++; if (this.p54_yeti_timer > 120) { this.p54_yeti_state = 0; this.p54_t_init = 0; } }
    }
    displayRoutine55() {
        // Spin 55: Tetris-like falling blocks
        const gr = this.gr;
        if (this.j === 1) {
            this.p55_xs = 0; this.p55_ys = -45; this.p55_tmp = 0; this.p55_r = 0; this.p55_q = 0; this.prevavg = this.totalavg; this.p55_drift = (this.randomgen(2) === 1) ? 1 : -1;
        }
        if (this.totalavg > this.prevavg + 3 && this.totalavg > 4) {
            if (this.p55_ys > 20) {
                this.p55_ys = -45; this.p55_xs = Math.max(-50, Math.min(50, (this.randomgen(7) - 3) * 15)); this.p55_tmp = (this.randomgen(6) - 1); this.p55_r = (this.randomgen(4) - 1); this.p55_q = 0; this.p55_drift = (this.randomgen(2) === 1) ? 1 : -1;
            }
        }
        this.prevavg = this.totalavg;
        if ((this.j % 3) === 0) {
            this.p55_q += 2 + Math.floor(this.totalavg / 6);
            if (this.p55_q >= 8) { this.p55_ys += Math.floor(this.p55_q / 8); this.p55_q = this.p55_q % 8; }
            this.p55_xs += this.p55_drift * Math.floor(this.scalar_r / 6);
            if (this.p55_xs > 50) { this.p55_xs = 50; this.p55_drift = -this.p55_drift; }
            else if (this.p55_xs < -50) { this.p55_xs = -50; this.p55_drift = -this.p55_drift; }
            if (this.p55_ys > 40) {
                gr.width(18); gr.colorwidth(3, 0); gr.pix(this.p55_xs, 38, 0, 'pixdefhollow1');
                this.p55_ys = -45; this.p55_xs = Math.max(-50, Math.min(50, (this.randomgen(7) - 3) * 15)); this.p55_tmp = (this.randomgen(6) - 1); this.p55_r = (this.randomgen(4) - 1); this.p55_q = 0; this.p55_drift = (this.randomgen(2) === 1) ? 1 : -1;
            }
        }
        // Draw current piece
        gr.width(14 + Math.floor(this.scalar_l / 2));
        switch (this.p55_tmp) {
            case 0: // I
                gr.colorwidth(2, 0);
                if ((this.p55_r & 1) === 0) { gr.plot(this.p55_xs, this.p55_ys - 12); gr.line(0, 24); }
                else { gr.plot(this.p55_xs - 12, this.p55_ys); gr.line(24, 0); }
                break;
            case 1: // O
                gr.pix(this.p55_xs, this.p55_ys, 0, 'pixdefhollow3');
                break;
            case 2: // L
                if (this.p55_r === 0) { gr.pix(this.p55_xs - 8, this.p55_ys, 0, 'pixdeftriclear2'); gr.pix(this.p55_xs + 8, this.p55_ys, 0, 'pixdefsmall1'); gr.pix(this.p55_xs + 8, this.p55_ys - 8, 0, 'pixdefsmall1'); }
                else if (this.p55_r === 1) { gr.pix(this.p55_xs, this.p55_ys - 8, 0, 'pixdeftriclear2'); gr.pix(this.p55_xs, this.p55_ys + 8, 0, 'pixdefsmall1'); gr.pix(this.p55_xs + 8, this.p55_ys + 8, 0, 'pixdefsmall1'); }
                else if (this.p55_r === 2) { gr.pix(this.p55_xs - 8, this.p55_ys, 0, 'pixdeftriclear2'); gr.pix(this.p55_xs + 8, this.p55_ys, 0, 'pixdefsmall1'); gr.pix(this.p55_xs - 8, this.p55_ys + 8, 0, 'pixdefsmall1'); }
                else { gr.pix(this.p55_xs, this.p55_ys - 8, 0, 'pixdeftriclear2'); gr.pix(this.p55_xs, this.p55_ys + 8, 0, 'pixdefsmall1'); gr.pix(this.p55_xs - 8, this.p55_ys + 8, 0, 'pixdefsmall1'); }
                break;
            case 3: // T
                if (this.p55_r === 0) { gr.pix(this.p55_xs, this.p55_ys, 0, 'pixdefsmall2'); gr.pix(this.p55_xs - 12, this.p55_ys, 0, 'pixdefsmall1'); gr.pix(this.p55_xs + 12, this.p55_ys, 0, 'pixdefsmall1'); gr.pix(this.p55_xs, this.p55_ys - 8, 0, 'pixdefsmall1'); }
                else if (this.p55_r === 1) { gr.pix(this.p55_xs, this.p55_ys, 0, 'pixdefsmall2'); gr.pix(this.p55_xs + 8, this.p55_ys - 8, 0, 'pixdefsmall1'); gr.pix(this.p55_xs + 8, this.p55_ys + 8, 0, 'pixdefsmall1'); gr.pix(this.p55_xs + 16, this.p55_ys, 0, 'pixdefsmall1'); }
                else if (this.p55_r === 2) { gr.pix(this.p55_xs, this.p55_ys, 0, 'pixdefsmall2'); gr.pix(this.p55_xs - 12, this.p55_ys, 0, 'pixdefsmall1'); gr.pix(this.p55_xs + 12, this.p55_ys, 0, 'pixdefsmall1'); gr.pix(this.p55_xs, this.p55_ys + 8, 0, 'pixdefsmall1'); }
                else { gr.pix(this.p55_xs, this.p55_ys, 0, 'pixdefsmall2'); gr.pix(this.p55_xs - 8, this.p55_ys - 8, 0, 'pixdefsmall1'); gr.pix(this.p55_xs - 8, this.p55_ys + 8, 0, 'pixdefsmall1'); gr.pix(this.p55_xs - 16, this.p55_ys, 0, 'pixdefsmall1'); }
                break;
            case 4: // S
                if ((this.p55_r & 1) === 0) { gr.pix(this.p55_xs - 8, this.p55_ys, 0, 'pixdefsmall1'); gr.pix(this.p55_xs, this.p55_ys, 0, 'pixdefsmall1'); gr.pix(this.p55_xs, this.p55_ys - 8, 0, 'pixdefsmall1'); gr.pix(this.p55_xs + 8, this.p55_ys - 8, 0, 'pixdefsmall1'); }
                else { gr.pix(this.p55_xs, this.p55_ys - 8, 0, 'pixdefsmall1'); gr.pix(this.p55_xs, this.p55_ys, 0, 'pixdefsmall1'); gr.pix(this.p55_xs + 8, this.p55_ys, 0, 'pixdefsmall1'); gr.pix(this.p55_xs + 8, this.p55_ys + 8, 0, 'pixdefsmall1'); }
                break;
            default: // Z
                if ((this.p55_r & 1) === 0) { gr.pix(this.p55_xs - 8, this.p55_ys - 8, 0, 'pixdefsmall1'); gr.pix(this.p55_xs, this.p55_ys - 8, 0, 'pixdefsmall1'); gr.pix(this.p55_xs, this.p55_ys, 0, 'pixdefsmall1'); gr.pix(this.p55_xs + 8, this.p55_ys, 0, 'pixdefsmall1'); }
                else { gr.pix(this.p55_xs + 8, this.p55_ys - 8, 0, 'pixdefsmall1'); gr.pix(this.p55_xs + 8, this.p55_ys, 0, 'pixdefsmall1'); gr.pix(this.p55_xs, this.p55_ys, 0, 'pixdefsmall1'); gr.pix(this.p55_xs, this.p55_ys + 8, 0, 'pixdefsmall1'); }
        }
        // Stacked pieces effect at bottom
        gr.width(10 + Math.floor(this.scalar_r / 3));
        for (let l = -3; l <= 3; l++) { if (Math.floor((this.j + l) / 6) < 5) gr.pix(l * 15, 38 - Math.floor((this.j + l) / 12), 0, 'pixdefhollow1'); }
        if (this.totalavg > 8) { gr.width(32); gr.colorwidth(3, 0); gr.arc(this.p55_xs, this.p55_ys, this.totalavg * 3, this.totalavg * 3, this.k * 50, 0x1F, 360, 2); }
    }
    displayRoutine56() {
        const gr = this.gr;
        // Gibson wireframe data city (Hackers 1995 aesthetic)
        if (this.j === 1) {
            this.prevavg = this.totalavg;
            this.p56_rally_cd = 0;     // reuse as glitch cooldown
            this.p56_gate1 = 0;        // scroll offset for grid
            this.p56_i = 36;           // default palette (green-ish)
        }
        // choose green or amber every few seconds
        if ((this.j % 64) === 0) {
            if (this.randomgen(2) === 1) {
                this.p56_i = 36;  // green phosphor
            } else {
                this.p56_i = 20;  // amber
            }
            gr.setAreaColor(0, 0, 7, 5, this.p56_i);
        }
        // perspective grid: lines converge toward horizon
        gr.colorwidth(1, 0);
        gr.width(2);
        // animate forward motion
        this.p56_gate1 = Math.max(0, Math.min(96, this.p56_gate1 + 2));
        for (let r = 0; r <= 7; r++) {
            const h = 46 - Math.max(0, Math.min(46, r * 6 + this.p56_gate1));
            gr.plot(-62, h);
            gr.line(124, 0);
        }
        // vertical grid lines (simple perspective to center)
        for (let r = -4; r <= 4; r++) {
            const p = r * 12;
            gr.plot(p, 46);
            gr.line(Math.floor(-p / 2), -92);  // slant toward center
        }
        // towers: 5 rectangles with base heights + audio
        gr.colorwidth(1, 0);
        gr.width(2);
        // optional glitch: 1/32 chance to skip one tower for 1 frame
        if (this.p56_rally_cd === 0 && this.randomgen(32) === 1) {
            this.p56_rally_cd = this.randomgen(5);  // which tower index 0..4
        } else {
            this.p56_rally_cd = 0;
        }
        // tower 0
        if (this.p56_rally_cd !== 1) {
            let q = 30 + this.scalar_l * 2;
            gr.plot(-40, 46);
            gr.line(0, -q);
            gr.line(12, 0);
            gr.line(0, q);
        }
        // tower 1
        if (this.p56_rally_cd !== 2) {
            let q = 40 + this.scalar_r * 2;
            gr.plot(-20, 46);
            gr.line(0, -q);
            gr.line(12, 0);
            gr.line(0, q);
        }
        // tower 2 (avg)
        if (this.p56_rally_cd !== 3) {
            let q = 35 + this.totalavg * 2;
            gr.plot(0, 46);
            gr.line(0, -q);
            gr.line(12, 0);
            gr.line(0, q);
        }
        // tower 3 (L variant)
        if (this.p56_rally_cd !== 4) {
            let q = 45 + Math.floor(this.scalar_l * 3 / 2);
            gr.plot(20, 46);
            gr.line(0, -q);
            gr.line(12, 0);
            gr.line(0, q);
        }
        // tower 4 (R variant)
        if (this.p56_rally_cd !== 5) {
            let q = 30 + Math.floor(this.scalar_r * 3 / 2);
            gr.plot(40, 46);
            gr.line(0, -q);
            gr.line(12, 0);
            gr.line(0, q);
        }
        // bass-hit vertical shoots
        if (this.totalavg > 12) {
            gr.width(3);
            gr.colorwidth(3, 0);
            let q = this.totalavg * 3;  // bass-responsive height
            gr.plot(-34, 46); gr.line(0, -q);
            gr.plot(-14, 46); gr.line(0, -q);
            gr.plot(6, 46); gr.line(0, -q);
            gr.plot(26, 46); gr.line(0, -q);
            gr.plot(46, 46); gr.line(0, -q);
        }
        // top flashes every 16 frames
        if ((this.j % 16) === 0) {
            gr.width(0); gr.textmode(1, 1, 6, 0b0101); gr.color(1);
            if (this.randomgen(2) === 1) gr.text(-10, -44, "ACCESS");
            else gr.text(-14, -44, "0x7F3A");
        }
    }
    displayRoutine57() {
        // Hacker terminal style text scope with scrolling system lines
        if (this.j === 1) {
            this.prevavg = this.totalavg;
            this.tt0 = 62; // scroll X position (right to left)
            this.tt1 = 0;  // message index
        }
        // Monospace style
        this.gr.textmode(1, 1, 6, 0b0101);
        // Pulse brightness with level
        if (this.totalavg > this.prevavg + 4) {
            this.gr.color(3);
        } else {
            this.gr.color(1);
        }
        // ASCII scope across width
        for (let r = -10; r <= 10; r++) {
            const p = r * 6; // x
            const h = ((this.scalar_l - this.scalar_r) * 2) + (((this.k >> 4) & 31) - 16);
            const y = Math.max(-46, Math.min(46, h));
            switch (((r + (this.k >> 2)) & 7)) {
                case 0: this.gr.text(p, y, "|"); break;
                case 1: this.gr.text(p, y, "/"); break;
                case 2: this.gr.text(p, y, "\\"); break;
                case 3: this.gr.text(p, y, "-"); break;
                case 4: this.gr.text(p, y, "_"); break;
                case 5: this.gr.text(p, y, "^"); break;
                case 6: this.gr.text(p, y, "v"); break;
                case 7: this.gr.text(p, y, (this.totalavg > 8) ? "*" : "."); break;
            }
        }
        // Scrolling status line
        if ((this.j & 3) === 0) this.tt0 -= 2;
        if (this.tt0 < -62) {
            this.tt0 = 62;
            this.tt1 = Math.floor(Math.random() * 8);
        }
        this.gr.color(1);
        this.gr.text(this.tt0 - 40, 34, "SYS: LINK OK RX=### TX=###");
        switch (this.tt1) {
            case 0: this.gr.text(this.tt0, 42, "IP 127.0.0.1:31337"); break;
            case 1: this.gr.text(this.tt0, 42, "IP 192.168.1.337:1337"); break;
            case 2: this.gr.text(this.tt0, 42, "IP 10.0.0.42:2600"); break;
            case 3: this.gr.text(this.tt0, 42, "IP 172.16.13.37:8080"); break;
            case 4: this.gr.text(this.tt0, 42, "IP 192.168.0.1:22"); break;
            case 5: this.gr.text(this.tt0, 42, "IP 10.10.10.10:1234"); break;
            case 6: this.gr.text(this.tt0, 42, "IP 192.168.1.1:80"); break;
            default: this.gr.text(this.tt0, 42, "IP 172.31.33.7:443"); break;
        }
        // Static blocks
        this.gr.text(-60, -30, "AUTH OK [PWD: ****]");
        this.gr.text(-60, -20, "PROC: 0x1F3C 0x2A8E 0x7D00");
        this.gr.text(-60, -10, "PKT: SYN ACK FIN RST");
        if (this.totalavg > this.prevavg + 8 && this.totalavg > 12) {
            this.gr.text(-38, -44, (Math.random() < 0.5) ? "HACK THE PLANET!" : "ELITE");
        }
        this.prevavg = this.totalavg;
    }
    displayRoutine58() {
        const gr = this.gr;
        if (this.j === 1) {
            this.tt0 = this.tt1 = this.tt2 = this.tt3 = 0;
            this.tt4 = this.tt5 = this.tt6 = this.tt7 = 0;
        }
        const i = (this.k & 0xFF);
        const p = Math.floor((this.scalar_l + this.scalar_r + this.totalavg) / 3);
        // current bands 0..46
        this.tt8  = Math.max(0, Math.min(46, this.scalar_l * 3 + (i & 7)));
        this.tt9  = Math.max(0, Math.min(46, this.scalar_r * 3 + ((i >> 1) & 7)));
        this.tt10 = Math.max(0, Math.min(46, this.totalavg * 3 + ((i >> 2) & 7)));
        this.tt11 = Math.max(0, Math.min(46, (this.scalar_l * 2 + this.scalar_r) * 2));
        this.tt12 = Math.max(0, Math.min(46, (this.scalar_r * 2 + this.scalar_l) * 2));
        this.tt13 = Math.max(0, Math.min(46, (this.totalavg + this.scalar_l) * 2));
        this.tt14 = Math.max(0, Math.min(46, (this.totalavg + this.scalar_r) * 2));
        this.tt15 = Math.max(0, Math.min(46, p * 3 + Math.floor(this.k / 32)));
        // decay peaks ~1s
        if ((this.j % 32) === 0) {
            if (this.tt0 > 0 && this.tt8  < this.tt0) this.tt0--;
            if (this.tt1 > 0 && this.tt9  < this.tt1) this.tt1--;
            if (this.tt2 > 0 && this.tt10 < this.tt2) this.tt2--;
            if (this.tt3 > 0 && this.tt11 < this.tt3) this.tt3--;
            if (this.tt4 > 0 && this.tt12 < this.tt4) this.tt4--;
            if (this.tt5 > 0 && this.tt13 < this.tt5) this.tt5--;
            if (this.tt6 > 0 && this.tt14 < this.tt6) this.tt6--;
            if (this.tt7 > 0 && this.tt15 < this.tt7) this.tt7--;
        }
        // raise peaks
        if (this.tt8  > this.tt0) this.tt0 = this.tt8;
        if (this.tt9  > this.tt1) this.tt1 = this.tt9;
        if (this.tt10 > this.tt2) this.tt2 = this.tt10;
        if (this.tt11 > this.tt3) this.tt3 = this.tt11;
        if (this.tt12 > this.tt4) this.tt4 = this.tt12;
        if (this.tt13 > this.tt5) this.tt5 = this.tt13;
        if (this.tt14 > this.tt6) this.tt6 = this.tt14;
        if (this.tt15 > this.tt7) this.tt7 = this.tt15;
        // draw bars
        gr.colorwidth(3, 0);
        gr.width(6);
        const xs = [-56,-42,-28,-14,0,14,28,42];
        const curr = [this.tt8,this.tt9,this.tt10,this.tt11,this.tt12,this.tt13,this.tt14,this.tt15];
        for (let idx = 0; idx < 8; idx++) { gr.plot(xs[idx], 46); gr.line(0, -curr[idx]); }
        // peak caps
        gr.width(2);
        const peaks = [this.tt0,this.tt1,this.tt2,this.tt3,this.tt4,this.tt5,this.tt6,this.tt7];
        for (let idx = 0; idx < 8; idx++) { if (peaks[idx] > 0) { gr.plot(xs[idx], 46 - peaks[idx]); gr.line(8, 0); } }
    }
    displayRoutine59() {
        const gr = this.gr;
        if (this.j === 1) {
            this.tt0=this.tt1=this.tt2=this.tt3=this.tt4=this.tt5=this.tt6=this.tt7=0;
            this.tt8=this.tt9=this.tt10=this.tt11=this.tt12=this.tt13=this.tt14=this.tt15=0;
        }
        // shift history
        this.tt8=this.tt0; this.tt9=this.tt1; this.tt10=this.tt2; this.tt11=this.tt3;
        this.tt12=this.tt4; this.tt13=this.tt5; this.tt14=this.tt6; this.tt15=this.tt7;
        // compute new current spectrum (0..36)
        const i = (this.k & 0xFF);
        this.tt0 = Math.max(0, Math.min(36, this.scalar_l * 3 + (i & 7)));
        this.tt1 = Math.max(0, Math.min(36, this.scalar_r * 3 + ((i>>1) & 7)));
        this.tt2 = Math.max(0, Math.min(36, this.totalavg * 3 + ((i>>2) & 7)));
        this.tt3 = Math.max(0, Math.min(36, (this.scalar_l*2 + this.scalar_r) * 2));
        this.tt4 = Math.max(0, Math.min(36, (this.scalar_r*2 + this.scalar_l) * 2));
        this.tt5 = Math.max(0, Math.min(36, (this.totalavg + this.scalar_l) * 2));
        this.tt6 = Math.max(0, Math.min(36, (this.totalavg + this.scalar_r) * 2));
        this.tt7 = Math.max(0, Math.min(36, (this.scalar_l + this.scalar_r + this.totalavg) * 2));
        // draw waterfall
        gr.colorwidth(3, 0);
        gr.width(4);
        const xs = [-56,-42,-28,-14,0,14,28,42];
        const cur = [this.tt0,this.tt1,this.tt2,this.tt3,this.tt4,this.tt5,this.tt6,this.tt7];
        for (let idx = 0; idx < 8; idx++) { gr.plot(xs[idx], -10); gr.line(0, -cur[idx]); }
        // previous spectrum middle
        gr.colorwidth(2, 0);
        gr.width(3);
        const prev = [this.tt8,this.tt9,this.tt10,this.tt11,this.tt12,this.tt13,this.tt14,this.tt15];
        for (let idx = 0; idx < 8; idx++) { gr.plot(xs[idx], 10); gr.line(0, -prev[idx]); }
        // connecting lines
        gr.colorwidth(1, 0);
        gr.width(1);
        for (let r = 0; r < 8; r++) {
            const p = -56 + r * 14;
            const h = cur[r];
            const l = prev[r];
            gr.plot(p, -10 - h);
            gr.line(0, 20 + h - l);
        }
    }
    
    displayRoutine60() {
        const gr = this.gr;
        // Frequency Cityscape - 8 buildings with lit windows for peaks
        if (this.j === 1) {
            // initialize building heights and window states
            this.tt0 = 0;  // building 0 height
            this.tt1 = 0;  // building 1 height
            this.tt2 = 0;  // building 2 height
            this.tt3 = 0;  // building 3 height
            this.tt4 = 0;  // building 4 height
            this.tt5 = 0;  // building 5 height
            this.tt6 = 0;  // building 6 height
            this.tt7 = 0;  // building 7 height
            this.tt8 = 0;  // window timer 0
            this.tt9 = 0;  // window timer 1
            this.tt10 = 0; // window timer 2
            this.tt11 = 0; // window timer 3
            this.tt12 = 0; // window timer 4
            this.tt13 = 0; // window timer 5
            this.tt14 = 0; // window timer 6
            this.tt15 = 0; // window timer 7
        }
        // compute building heights from audio (8 bands)
        const i = (this.k & 0xFF);
        this.tt0 = Math.max(5, Math.min(40, this.scalar_l * 2 + (i & 3)));
        this.tt1 = Math.max(5, Math.min(40, this.scalar_r * 2 + ((i >> 1) & 3)));
        this.tt2 = Math.max(5, Math.min(40, this.totalavg * 2 + ((i >> 2) & 3)));
        this.tt3 = Math.max(5, Math.min(40, (this.scalar_l + this.scalar_r) * 2));
        this.tt4 = Math.max(5, Math.min(40, (this.scalar_l * 2 + this.totalavg)));
        this.tt5 = Math.max(5, Math.min(40, (this.scalar_r * 2 + this.totalavg)));
        this.tt6 = Math.max(5, Math.min(40, (this.totalavg + this.scalar_l) * 2));
        this.tt7 = Math.max(5, Math.min(40, (this.totalavg + this.scalar_r) * 2));
        // update window timers (light up on peaks, fade over ~2 seconds)
        if (this.totalavg > 8) {
            this.tt8 = 60;  // light up windows for 60 frames (~2s at 35fps)
            this.tt9 = 60;
            this.tt10 = 60;
            this.tt11 = 60;
            this.tt12 = 60;
            this.tt13 = 60;
            this.tt14 = 60;
            this.tt15 = 60;
        } else {
            // decay window brightness
            if (this.tt8 > 0) this.tt8 = this.tt8 - 1;
            if (this.tt9 > 0) this.tt9 = this.tt9 - 1;
            if (this.tt10 > 0) this.tt10 = this.tt10 - 1;
            if (this.tt11 > 0) this.tt11 = this.tt11 - 1;
            if (this.tt12 > 0) this.tt12 = this.tt12 - 1;
            if (this.tt13 > 0) this.tt13 = this.tt13 - 1;
            if (this.tt14 > 0) this.tt14 = this.tt14 - 1;
            if (this.tt15 > 0) this.tt15 = this.tt15 - 1;
        }
        // draw cityscape silhouettes
        gr.colorwidth(1, 0);
        gr.width(10);
        // building 0
        gr.plot(-56, 46);
        gr.line(0, -this.tt0);
        gr.line(12, 0);
        gr.line(0, this.tt0);
        // building 1
        gr.plot(-42, 46);
        gr.line(0, -this.tt1);
        gr.line(12, 0);
        gr.line(0, this.tt1);
        // building 2
        gr.plot(-28, 46);
        gr.line(0, -this.tt2);
        gr.line(12, 0);
        gr.line(0, this.tt2);
        // building 3
        gr.plot(-14, 46);
        gr.line(0, -this.tt3);
        gr.line(12, 0);
        gr.line(0, this.tt3);
        // building 4
        gr.plot(0, 46);
        gr.line(0, -this.tt4);
        gr.line(12, 0);
        gr.line(0, this.tt4);
        // building 5
        gr.plot(14, 46);
        gr.line(0, -this.tt5);
        gr.line(12, 0);
        gr.line(0, this.tt5);
        // building 6
        gr.plot(28, 46);
        gr.line(0, -this.tt6);
        gr.line(12, 0);
        gr.line(0, this.tt6);
        // building 7
        gr.plot(42, 46);
        gr.line(0, -this.tt7);
        gr.line(12, 0);
        gr.line(0, this.tt7);
        // draw lit windows (small rectangles) when timers > 0
        gr.width(2);
        if (this.tt8 > 0) {
            gr.colorwidth(3, 0);
            gr.pix(-52, 46 - Math.floor(this.tt0 / 3), 0, 'pixdefsmall1');
            gr.pix(-48, 46 - Math.floor(this.tt0 / 2), 0, 'pixdefsmall1');
        }
        if (this.tt9 > 0) {
            gr.colorwidth(3, 0);
            gr.pix(-38, 46 - Math.floor(this.tt1 / 3), 0, 'pixdefsmall1');
            gr.pix(-34, 46 - Math.floor(this.tt1 / 2), 0, 'pixdefsmall1');
        }
        if (this.tt10 > 0) {
            gr.colorwidth(3, 0);
            gr.pix(-24, 46 - Math.floor(this.tt2 / 3), 0, 'pixdefsmall1');
            gr.pix(-20, 46 - Math.floor(this.tt2 / 2), 0, 'pixdefsmall1');
        }
        if (this.tt11 > 0) {
            gr.colorwidth(3, 0);
            gr.pix(-10, 46 - Math.floor(this.tt3 / 3), 0, 'pixdefsmall1');
            gr.pix(-6, 46 - Math.floor(this.tt3 / 2), 0, 'pixdefsmall1');
        }
        if (this.tt12 > 0) {
            gr.colorwidth(3, 0);
            gr.pix(4, 46 - Math.floor(this.tt4 / 3), 0, 'pixdefsmall1');
            gr.pix(8, 46 - Math.floor(this.tt4 / 2), 0, 'pixdefsmall1');
        }
        if (this.tt13 > 0) {
            gr.colorwidth(3, 0);
            gr.pix(18, 46 - Math.floor(this.tt5 / 3), 0, 'pixdefsmall1');
            gr.pix(22, 46 - Math.floor(this.tt5 / 2), 0, 'pixdefsmall1');
        }
        if (this.tt14 > 0) {
            gr.colorwidth(3, 0);
            gr.pix(32, 46 - Math.floor(this.tt6 / 3), 0, 'pixdefsmall1');
            gr.pix(36, 46 - Math.floor(this.tt6 / 2), 0, 'pixdefsmall1');
        }
        if (this.tt15 > 0) {
            gr.colorwidth(3, 0);
            gr.pix(46, 46 - Math.floor(this.tt7 / 3), 0, 'pixdefsmall1');
            gr.pix(50, 46 - Math.floor(this.tt7 / 2), 0, 'pixdefsmall1');
        }
        // add "moon" that changes size with bass
        gr.colorwidth(2, 0);
        gr.width(0);
        const q = Math.floor(this.totalavg / 4) + 3;
        gr.arc(50, -35, q, q, 0, 0xFF, 360, 2);
    }
    displayRoutine61() {
        const gr = this.gr;
        // ASCII Skull/Mask Strobe (sprite-based)
        if (this.j === 1) {
            this.prevavg = this.totalavg;
            this.tt0 = 0;            // blink counter
            this.tt1 = 0;            // mask index (0/1)
            const i = 36;
            gr.setAreaColor(0, 0, 7, 5, i);
        }
        // transient triggers (bass rises or L/R asymmetry)
        if ((this.totalavg > this.prevavg + 8 && this.totalavg > 12) || Math.abs(this.scalar_l - this.scalar_r) > 10) {
            this.tt1 = 1 - this.tt1;
            this.tt0 = 3;
        }
        // draw skull centered with strobe effect
        if (this.tt0 > 0) {
            // strobe: bright color, larger size
            gr.colorwidth(3, 6);
            this.tt0 = this.tt0 - 1;
        } else {
            // normal: dim color, normal size
            gr.colorwidth(1, 3);
        }
        if (this.tt1 === 0) {
            gr.pix(0, 0, 0, 'skull_a');
        } else {
            gr.pix(0, 0, 0, 'skull_b');
        }
        this.prevavg = this.totalavg;
    }
    displayRoutine62() {
        // Initialize columns and speeds
        if (this.j === 1) {
            for (let i = 0; i < 8; i++) {
                this[`tt${i}`] = -46 - (Math.floor(Math.random() * 16)) * 6;
                this[`tt${8 + i}`] = 1 + Math.floor(Math.random() * 3); // speed 1..3
            }
        }
        // Audio reactive speed boost
        const speed_boost = Math.max(0, Math.min(3, this.totalavg >> 3));
        // Render 8 columns
        this.gr.textmode(1, 1, 6, 0b0101);
        for (let r = 0; r < 8; r++) {
            const x = -56 + r * 14;
            let y = this[`tt${r}`];
            let spd = this[`tt${8 + r}`] + speed_boost;
            // advance
            y += spd;
            if (y > 52) {
                y = -46 - Math.floor(Math.random() * 24) * 6;
                spd = 1 + Math.floor(Math.random() * 3);
            }
            this[`tt${r}`] = y;
            this[`tt${8 + r}`] = spd;
            // draw tail
            const tail_len = Math.max(5, Math.min(10, 5 + (this.totalavg >> 4)));
            for (let t = 0; t < tail_len; t++) {
                const char_y = y - t * 6;
                if (char_y < -46 || char_y > 46) continue;
                if (t === 0) this.gr.color(3); else if (t === 1) this.gr.color(2); else this.gr.color(1);
                const char_idx = (this.k + r + t) & 0x1F;
                switch (char_idx & 15) {
                    case 0: this.gr.text(x, char_y, "0"); break;
                    case 1: this.gr.text(x, char_y, "1"); break;
                    case 2: this.gr.text(x, char_y, "2"); break;
                    case 3: this.gr.text(x, char_y, "3"); break;
                    case 4: this.gr.text(x, char_y, "7"); break;
                    case 5: this.gr.text(x, char_y, "Z"); break;
                    case 6: this.gr.text(x, char_y, "@"); break;
                    case 7: this.gr.text(x, char_y, "#"); break;
                    case 8: this.gr.text(x, char_y, "%"); break;
                    case 9: this.gr.text(x, char_y, "$"); break;
                    default: this.gr.text(x, char_y, "*"); break;
                }
            }
        }
        // occasional phrase
        if ((this.k & 0x3F) === 0) {
            this.gr.color(3);
            this.gr.text(-40, -20, "WAKE UP NEO");
        }
    }
    
    // Control methods
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.gr.log("VidPix Main Loop started");
        this.loop();
    }
    
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.gr.log("VidPix Main Loop stopped");
    }
    
    // Animation loop
    loop() {
        if (!this.isRunning) return;
        const now = performance.now();
        if (now - this.lastFrameTime >= this.targetFrameMs) {
            this.lastFrameTime = now;
            this.update();
        }
        this.animationId = requestAnimationFrame(() => this.loop());
    }
    
    // Manual pattern selection
    setDisplayRoutine(routine) {
        if (routine >= 0 && routine <= 62) {
            this.displayroutine = routine;
            this.gr.log(`Display routine set to ${routine}`);
        } else {
            this.gr.log(`Invalid display routine: ${routine}. Must be 0-62.`);
        }
    }
    
    // Cycle through patterns
    nextPattern() {
        this.displayroutine = (this.displayroutine + 1) % 63;
        this.gr.log(`Next pattern: ${this.displayroutine}`);
    }
    
    previousPattern() {
        this.displayroutine = (this.displayroutine - 1 + 63) % 63;
        this.gr.log(`Previous pattern: ${this.displayroutine}`);
    }
    
    // Set audio sensitivity
    setAudioSensitivity(sensitivity) {
        this.audioSensitivity = Math.min(3.0, Math.max(0.1, sensitivity));
        this.gr.log(`Audio sensitivity set to ${this.audioSensitivity.toFixed(1)}x`);
        
        // Update the display value in the UI
        const sensitivitySpan = document.getElementById('sensitivityValue');
        if (sensitivitySpan) {
            sensitivitySpan.textContent = this.audioSensitivity.toFixed(1);
        }
    }

    setBeatMode(mode) {
        this.beatMode = mode || 'edm';
        this.gr.log(`Beat mode: ${this.beatMode}`);
    }

    // Frame rate selection (approximate Spin's common ADC_AVG frame pacing)
    setFrameRateMode(mode) {
        switch (mode) {
            case 'fast':
                this.frameRateMode = 'fast';
                this.targetFrameMs = 1000/60; // ~60 fps, ADC_AVG≈35
                this.ADC_AVG = 35;
                break;
            case 'medium':
                this.frameRateMode = 'medium';
                this.targetFrameMs = 1000/30; // ~30 fps, ADC_AVG≈75
                this.ADC_AVG = 75;
                break;
            case 'slow':
                this.frameRateMode = 'slow';
                this.targetFrameMs = 1000/20; // ~20 fps, ADC_AVG≈105
                this.ADC_AVG = 105;
                break;
            default:
                this.frameRateMode = 'fast';
                this.targetFrameMs = 1000/60;
                this.ADC_AVG = 35;
        }
        this.gr.log(`Frame rate: ${this.frameRateMode} (~${Math.round(1000/this.targetFrameMs)} fps)`);
    }

    // Toggle auto pattern behavior
    setAutoPattern(enabled) {
        this.autoPattern = !!enabled;
        this.lastAutoSwitch = performance.now();
        
        if (this.autoPattern) {
            // Initialize delay system like Spin startup: delayflag:=0, cognew(delay(@delayflag, 8), @delayStack)
            this.delayflag = 0;
            this.startDelayTimer();
        } else {
            // Clear delay timer when turning off AUTO
            if (this.delayTimerId) {
                clearTimeout(this.delayTimerId);
                this.delayTimerId = null;
            }
            this.delayflag = 0;
        }
        
        this.gr.log(`Auto pattern: ${this.autoPattern ? 'ON' : 'OFF'}`);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VidPixMainLoop;
}
