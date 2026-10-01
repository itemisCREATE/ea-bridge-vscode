// Procedural music bed for the feature video → build/music.wav (48 kHz, 16-bit stereo).
// No dependencies: oscillators, filters, reverb and delay are written out below.
//
// 120 BPM (beat = 0.5 s, bar = 2 s), A-minor progression Am–F–C–G.
// All cue times (cuts, clicks, typing, build/drop, final hit) come from timing.json,
// the same file video.js reads — so picture and sound stay in sync.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const TM = JSON.parse(fs.readFileSync(path.join(here, 'timing.json'), 'utf8'));
const SR = 48000;
const DUR = TM.duration;
const N = SR * DUR;
const BEAT = 60 / TM.bpm;

const CUTS = TM.cuts;                                  // scene transitions (whoosh + flash)
const LOGO_LOCK = TM.logoLock;                         // intro logo bars snap together
const CLICKS = TM.clicks;                              // cursor clicks in the VS Code scene
const BUILD = [TM.scenes.thousand[0], TM.drop];        // 1,000-tile wave; drop + impact at its end
const FINAL_HIT = TM.finalHit;
const TYPING = [TM.typing.question, TM.typing.command]; // human typing gets key ticks (not the AI's tool call)
const S2 = TM.scenes;
const GROOVE = S2.why[0];                              // drums enter after the intro
const drumsOn = (t) => (t >= GROOVE && t < BUILD[0]) || (t >= BUILD[1] && t < FINAL_HIT);
const buildProgress = (t) => Math.max(0, Math.min(1, (t - BUILD[0]) / (BUILD[1] - BUILD[0])));
const accentsAt = (t) => t >= BUILD[1];   // after the drop: open hats, octave-jumping arp

// ------------------------------------------------------------------ buffers & helpers
const dryL = new Float32Array(N), dryR = new Float32Array(N);
const revL = new Float32Array(N), revR = new Float32Array(N);  // reverb send
const dlyL = new Float32Array(N), dlyR = new Float32Array(N);  // ping-pong delay send
const S = (t) => Math.round(t * SR);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const TAU = Math.PI * 2;

let seed = 1234567;
const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };

/** Zavalishin/Simper state-variable filter; call with a per-sample cutoff. */
function svf(q = 0.7) {
    let ic1 = 0, ic2 = 0; const k = 1 / q;
    return (x, fc) => {
        const g = Math.tan(Math.PI * Math.min(fc, SR * 0.45) / SR);
        const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
        const v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
        ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
        return { lp: v2, bp: v1, hp: x - k * v1 - v2 };
    };
}
/** Band-limited sawtooth (polyBLEP). */
function sawOsc() {
    let ph = 0;
    return (f) => {
        const dt = f / SR; ph += dt; if (ph >= 1) ph -= 1;
        let v = 2 * ph - 1;
        if (ph < dt) { const x = ph / dt; v -= x + x - x * x - 1; }
        else if (ph > 1 - dt) { const x = (ph - 1) / dt; v -= x * x + x + x + 1; }
        return v;
    };
}
function add(i, l, r, send = 0, delaySend = 0) {
    if (i < 0 || i >= N) return;
    dryL[i] += l; dryR[i] += r;
    if (send) { revL[i] += l * send; revR[i] += r * send; }
    if (delaySend) { dlyL[i] += l * delaySend; dlyR[i] += r * delaySend; }
}

// ------------------------------------------------------------------ harmony
const CHORDS = [
    { root: 45, notes: [57, 60, 64, 69] },   // Am
    { root: 41, notes: [57, 60, 65, 69] },   // F  (A C F A — smooth voice leading)
    { root: 48, notes: [55, 60, 64, 67] },   // C
    { root: 43, notes: [55, 59, 62, 67] },   // G
];
const chordAt = (t) => CHORDS[Math.floor(t / 2) % 4];

// Kick times drive both the kick drum and the sidechain ducking of bass / pad.
const KICKS = [];
for (let t = 0; t < DUR; t += BEAT) if (drumsOn(t) || (t >= BUILD[0] && t < BUILD[1] - 1)) KICKS.push(t);
// Per-sample sidechain gain: dips after every kick.
const DUCK = new Float32Array(N);
{ let ki = 0; for (let i = 0; i < N; i++) { const t = i / SR; while (ki + 1 < KICKS.length && KICKS[ki + 1] <= t) ki++; const a = KICKS.length && KICKS[ki] <= t ? t - KICKS[ki] : 9; DUCK[i] = a < 0.3 ? 1 - 0.6 * Math.exp(-a / 0.07) : 1; } }

// ------------------------------------------------------------------ instruments
function kick(t0, g = 0.9) {
    let ph = 0; const i0 = S(t0);
    for (let n = 0; n < S(0.45); n++) {
        const tt = n / SR;
        const f = 44 + 120 * Math.exp(-tt * 28);
        ph += TAU * f / SR;
        const v = Math.sin(ph) * Math.exp(-tt * 6.5) + noise() * 0.25 * Math.exp(-tt * 260);
        add(i0 + n, v * g, v * g);
    }
}
function hat(t0, g = 0.12, open = false, pan = 0) {
    const f = svf(0.8); const i0 = S(t0);
    for (let n = 0; n < S(open ? 0.3 : 0.08); n++) {
        const tt = n / SR;
        const v = f(noise(), 7500).hp * Math.exp(-tt * (open ? 14 : 55)) * g;
        add(i0 + n, v * (1 - pan), v * (1 + pan), 0.08);
    }
}
function clap(t0, g = 0.32) {
    const f = svf(1.2); const i0 = S(t0);
    for (let n = 0; n < S(0.35); n++) {
        const tt = n / SR;
        const env = (tt < 0.03 ? (Math.exp(-((tt % 0.01) * 400)) * 0.8) : 0) + Math.exp(-tt * 16);
        const v = f(noise(), 1600).bp * env * g * 2.2;
        add(i0 + n, v, v, 0.35);
    }
}
function snare(t0, g = 0.2) {
    const f = svf(0.9); const i0 = S(t0); let ph = 0;
    for (let n = 0; n < S(0.18); n++) {
        const tt = n / SR; ph += TAU * 190 / SR;
        const v = (f(noise(), 3000).bp * 1.6 + Math.sin(ph) * 0.5 * Math.exp(-tt * 30)) * Math.exp(-tt * 22) * g;
        add(i0 + n, v, v, 0.25);
    }
}
function bassNote(t0, dur, midi, g = 0.26) {
    const osc = sawOsc(), f = svf(1.1); const i0 = S(t0); const fr = mtof(midi);
    for (let n = 0; n < S(dur); n++) {
        const tt = n / SR;
        const env = Math.min(1, tt / 0.004) * Math.exp(-tt * 3.5) * Math.min(1, (dur - tt) / 0.01);
        const cut = 220 + 1300 * Math.exp(-tt * 14);
        const v = (f(osc(fr), cut).lp + Math.sin(TAU * fr * 0.5 * tt) * 0.5) * env * g * DUCK[Math.min(N - 1, i0 + n)];
        add(i0 + n, v, v);
    }
}
function pluck(t0, midi, g = 0.1, pan = 0, bright = 2600) {
    const o1 = sawOsc(), o2 = sawOsc(), f = svf(1.4); const i0 = S(t0); const fr = mtof(midi);
    for (let n = 0; n < S(0.4); n++) {
        const tt = n / SR;
        const env = Math.min(1, tt / 0.002) * Math.exp(-tt * 11);
        const v = f(o1(fr) * 0.6 + o2(fr * 1.004) * 0.4, bright * (0.35 + Math.exp(-tt * 18))).lp * env * g;
        add(i0 + n, v * (1 - pan), v * (1 + pan), 0.25, 0.4);
    }
}
function impact(t0, g = 0.9, crash = false) {
    const i0 = S(t0); let ph = 0; const f = svf(0.7), fc = svf(0.7);
    for (let n = 0; n < S(crash ? 2.6 : 1.4); n++) {
        const tt = n / SR;
        const fr = 34 + 46 * Math.exp(-tt * 6);
        ph += TAU * fr / SR;
        let v = Math.sin(ph) * Math.exp(-tt * 2.6) * 1.1;
        v += f(noise(), 900).lp * Math.exp(-tt * 9) * 0.9;
        let l = v, r = v;
        if (crash) { const c = fc(noise(), 5200).hp * Math.exp(-tt * 1.6) * 0.32; l += c * 1.1; r += c * 0.9; }
        add(i0 + n, l * g, r * g, 0.45);
    }
}
/** Rising noise whoosh that peaks on the cut and falls away right after. */
function whoosh(tc, g = 0.3, pre = 0.5) {
    const f = svf(1.6); const i0 = S(tc - pre);
    const total = pre + 0.35;
    for (let n = 0; n < S(total); n++) {
        const tt = n / SR - pre; // < 0 before the cut
        const u = tt < 0 ? 1 + tt / pre : 1;
        const env = tt < 0 ? Math.pow(u, 2.4) : Math.exp(-tt * 13);
        const fc = tt < 0 ? 400 * Math.pow(12, u) : 4800 * Math.exp(-tt * 4);
        const v = f(noise(), fc).bp * env * g * 1.8;
        const pan = Math.max(-1, Math.min(1, tt * 2.5));
        add(i0 + n, v * (1 - pan * 0.6), v * (1 + pan * 0.6), 0.3);
    }
}
function riser(t0, t1, g = 0.22) {
    const f = svf(2.2); const i0 = S(t0);
    for (let n = 0; n < S(t1 - t0); n++) {
        const u = n / S(t1 - t0);
        const v = f(noise(), 300 * Math.pow(30, u)).bp * Math.pow(u, 1.8) * g * 2;
        add(i0 + n, v, v, 0.3);
    }
}
function tick(t0, g = 0.05) {
    const f = svf(2); const i0 = S(t0);
    for (let n = 0; n < S(0.025); n++) { const tt = n / SR; const v = f(noise(), 5200).bp * Math.exp(-tt * 260) * g * 3; add(i0 + n, v, v); }
}

// ------------------------------------------------------------------ pad (rendered continuously)
{
    const voices = [0, 1, 2, 3].map(() => [sawOsc(), sawOsc(), sawOsc(), sawOsc()]);
    const fL = svf(0.9), fR = svf(0.9);
    for (let i = 0; i < N; i++) {
        const t = i / SR;
        const bar = Math.floor(t / 2), inBar = t - bar * 2;
        const cur = chordAt(t), prev = chordAt(Math.max(0, t - 2));
        // 0.25 s crossfade into each new chord
        const x = Math.min(1, inBar / 0.25);
        let l = 0, r = 0;
        for (let v = 0; v < 4; v++) {
            const [a, b, c, d] = voices[v];
            const fr = mtof(cur.notes[v]) * x + mtof(prev.notes[v]) * (1 - x);
            l += a(fr * 0.996) + b(fr * 1.003);
            r += c(fr * 1.004) + d(fr * 0.997);
        }
        // Swell in from silence, brighter during the build, open on the outro.
        const level = Math.min(1, t / 1.6) * (t > DUR - 1.6 ? Math.max(0, (DUR - t) / 1.6) : 1);
        const bright = 900 + 700 * Math.sin(t * 0.7) ** 2 + (t >= BUILD[0] && t < BUILD[1] ? 2600 * buildProgress(t) : 0) + (t >= FINAL_HIT ? 1200 : 0);
        const duck = drumsOn(t) ? DUCK[i] : 1;
        const g = 0.045 * level * duck;
        const L = fL(l, bright).lp * g, R = fR(r, bright).lp * g;
        dryL[i] += L; dryR[i] += R; revL[i] += L * 0.5; revR[i] += R * 0.5;
    }
}

// ------------------------------------------------------------------ arrangement
// Sections (from timing.json):
//   intro            pad + plucks, logo-lock hit, riser into the groove
//   why              kick, hats, bass — light groove
//   browse/diagrams  + clap, fuller hats
//   thousand         build (snare roll, rising arp) → drop + impact
//   ai               full groove + open-hat accents
//   cli              + high counter-melody (lift towards the finale)
//   outro            final impact, held chord, sparkle, fade
// Intro: reverse swell into the logo lock, soft hit, plucked arpeggio.
riser(0.0, LOGO_LOCK, 0.12);
impact(LOGO_LOCK, 0.5);
for (let t = LOGO_LOCK; t < GROOVE; t += 0.25) {
    const c = chordAt(t), k = Math.round((t - LOGO_LOCK) / 0.25);
    pluck(t, c.notes[k % 4] + 12, 0.05 + 0.03 * (t / GROOVE), k % 2 ? 0.35 : -0.35);
}
riser(GROOVE - 1.1, GROOVE, 0.15);

// Drums + bass groove.
for (let t = GROOVE; t < DUR; t += BEAT / 2) {
    const beatIdx = Math.round(t / BEAT * 2); // 8th-note index
    const onBeat = beatIdx % 2 === 0;
    const quarter = Math.round(t / BEAT);
    const full = t >= S2.browse[0];
    const accents = accentsAt(t);
    if (drumsOn(t)) {
        if (onBeat) kick(t);
        if (!onBeat) hat(t, 0.11, accents && beatIdx % 8 === 7, beatIdx % 4 === 1 ? -0.3 : 0.3);
        else if (full) hat(t, 0.05, false, 0.2);
        if (full && onBeat && quarter % 2 === 1) clap(t);
        bassNote(t, BEAT / 2 - 0.01, chordAt(t).root + (beatIdx % 8 === 6 ? 12 : 0));
    }
}
// Arp: 16ths over the groove (quiet), louder and climbing during the build.
for (let t = GROOVE; t < FINAL_HIT; t += 0.125) {
    const c = chordAt(t), k = Math.round(t / 0.125);
    const inBuild = t >= BUILD[0] && t < BUILD[1];
    const lift = inBuild ? Math.floor((t - BUILD[0]) / BEAT) : 0;            // climbs one step per beat
    const note = c.notes[k % 4] + 12 + (inBuild ? Math.min(12, lift * 2) : 0) + (k % 8 >= 4 ? 12 : 0) * (inBuild || accentsAt(t) ? 1 : 0);
    const g = inBuild ? 0.06 + 0.07 * buildProgress(t) : t < S2.browse[0] ? 0.035 : 0.045;
    pluck(t, note, g, k % 2 ? 0.4 : -0.4, inBuild ? 2600 + 3000 * buildProgress(t) : t < S2.browse[0] ? 1600 : 2000);
}
// CLI section: slow high counter-melody on chord tones for a lift into the finale.
for (let t = S2.cli[0]; t < FINAL_HIT; t += BEAT) {
    const c = chordAt(t), k = Math.round(t / BEAT);
    pluck(t, c.notes[[3, 2, 1, 2][k % 4]] + 24, 0.035, k % 2 ? 0.25 : -0.25, 3800);
}
// Build: kick keeps quarters, snare roll accelerates into the drop.
for (let t = BUILD[0]; t < BUILD[1] - 0.01;) {
    const u = (t - BUILD[0]) / (BUILD[1] - BUILD[0]);
    snare(t, 0.06 + 0.2 * u);
    t += u < 0.4 ? 0.25 : u < 0.75 ? 0.125 : 0.0625;
}
for (let t = BUILD[0]; t < BUILD[1] - 0.6; t += BEAT) kick(t, 0.75);
riser(BUILD[0] + 0.5, BUILD[1], 0.24);
impact(BUILD[1], 0.85, true);

// Cuts, UI sounds, final hit and a held outro chord.
for (const c of CUTS) whoosh(c, c === FINAL_HIT ? 0.22 : 0.3);
for (const c of CLICKS) tick(c, 0.09);
for (const [a, b] of TYPING) { let t = a; let r = 0.37; while (t < b) { tick(t, 0.035); r = (r * 9301 + 49297) % 233280 / 233280; t += 0.055 + r * 0.04; } }
impact(FINAL_HIT, 1.0, true);
for (let k = 0; k < 10; k++) pluck(FINAL_HIT + 0.25 + k * 0.25, [69, 72, 76, 81][k % 4] + (k >= 4 ? 12 : 0), 0.05 * (1 - k / 12), k % 2 ? 0.4 : -0.4, 3200);

// ------------------------------------------------------------------ effects
// Ping-pong delay (dotted 8th) on the delay send.
{
    const d = S(0.375), fb = 0.38;
    const bL = new Float32Array(N), bR = new Float32Array(N);
    for (let i = 0; i < N; i++) {
        const inL = dlyL[i] + (i >= d ? bR[i - d] * fb : 0);
        const inR = dlyR[i] + (i >= d ? bL[i - d] * fb : 0);
        bL[i] = inL; bR[i] = inR;
        if (i >= d) { dryL[i] += bL[i - d] * 0.35; dryR[i] += bR[i - d] * 0.35; }
    }
}
// Small Freeverb-style reverb on the reverb send.
{
    const scale = SR / 44100;
    const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((x) => Math.round(x * scale));
    const apT = [556, 441, 341, 225].map((x) => Math.round(x * scale));
    const run = (input, spread) => {
        const out = new Float32Array(N);
        for (const len0 of combT) {
            const len = len0 + spread; const buf = new Float32Array(len); let idx = 0, store = 0;
            for (let i = 0; i < N; i++) {
                const y = buf[idx];
                store = y * 0.7 + store * 0.3;          // damping
                buf[idx] = input[i] * 0.015 + store * 0.84;
                out[i] += y; idx = (idx + 1) % len;
            }
        }
        for (const len0 of apT) {
            const len = len0 + spread; const buf = new Float32Array(len); let idx = 0;
            for (let i = 0; i < N; i++) { const b = buf[idx]; const y = -out[i] + b; buf[idx] = out[i] + b * 0.5; out[i] = y; idx = (idx + 1) % len; }
        }
        return out;
    };
    const wl = run(revL, 0), wr = run(revR, 23);
    for (let i = 0; i < N; i++) { dryL[i] += wl[i] * 0.9; dryR[i] += wr[i] * 0.9; }
}

// ------------------------------------------------------------------ master
// Scale the raw mix so only the loudest transients touch the soft clipper (keeps dynamics,
// lands around -15 LUFS — a background bed, not a mastered track).
let rawPeak = 0;
for (let i = 0; i < N; i++) rawPeak = Math.max(rawPeak, Math.abs(dryL[i]), Math.abs(dryR[i]));
const drive = 1.0 / rawPeak;
let peak = 0;
for (let i = 0; i < N; i++) {
    const t = i / SR;
    const fade = Math.min(1, t / 0.01) * (t > DUR - 1.4 ? 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - (DUR - 1.4)) / 1.4)) : 1);
    dryL[i] = Math.tanh(dryL[i] * drive) * fade;
    dryR[i] = Math.tanh(dryR[i] * drive) * fade;
    peak = Math.max(peak, Math.abs(dryL[i]), Math.abs(dryR[i]));
}
const norm = 0.89 / peak; // ≈ -1 dBFS

const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8);
out.write('fmt ', 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
    out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, dryL[i] * norm)) * 32767), 44 + i * 4);
    out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, dryR[i] * norm)) * 32767), 46 + i * 4);
}
fs.mkdirSync(path.join(here, 'build'), { recursive: true });
fs.writeFileSync(path.join(here, 'build', 'music.wav'), out);
console.log(`wrote build/music.wav (${DUR} s, peak normalised from ${peak.toFixed(2)})`);
