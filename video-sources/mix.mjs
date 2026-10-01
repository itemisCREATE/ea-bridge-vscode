// Final audio mix → build/audio.wav (48 kHz, 16-bit stereo): the one soundtrack render.mjs and site.mjs use.
//
//   node mix.mjs                      → music only (copy of build/music.wav) while timing.json "voice" is empty
//   node mix.mjs --voice cues.json    → use the cue list in cues.json (array, or { "voice": [...] }) instead of timing.json's
//
// Voice-over cues live in timing.json:
//   "voice": [ { "file": "voice/03-browse.wav", "scene": "browse", "offset": 0.3 } ]
//   - "scene" + "offset" (seconds): the clip starts that long after the scene start, so lengthening an
//     earlier scene in timing.json moves the clip with it.
//   - "at": 12.3 (absolute seconds) is accepted instead of scene + offset.
//   - "file" is relative to this folder; WAV or MP3 (anything the bundled ffmpeg reads).
//
// With cues: every clip is delayed to its cue and summed into a voice bus; the music is ducked under
// the voice (sidechain compressor); both are summed, loudness-normalised (~ -16 LUFS, -1 dBTP) and
// trimmed/padded to exactly timing.json "duration".

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const here = path.dirname(fileURLToPath(import.meta.url));
const TM = JSON.parse(fs.readFileSync(path.join(here, 'timing.json'), 'utf8'));
const MUSIC = path.join(here, 'build', 'music.wav');
const OUT = path.join(here, 'build', 'audio.wav');
const SR = 48000;

function fail(msg) { console.error(`✖ mix: ${msg}`); process.exit(1); }

// ------------------------------------------------------------------ cue list
const args = process.argv.slice(2);
let cues = TM.voice ?? [];
const vi = args.indexOf('--voice');
if (vi >= 0) {
    const file = args[vi + 1];
    if (!file) fail('--voice needs a JSON file');
    const j = JSON.parse(fs.readFileSync(path.resolve(here, file), 'utf8'));
    cues = Array.isArray(j) ? j : j.voice ?? [];
}

if (!fs.existsSync(MUSIC)) fail('build/music.wav is missing — run `node music.mjs` first');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

if (cues.length === 0) {
    fs.copyFileSync(MUSIC, OUT); // passthrough until voice clips exist
    console.log('mix: no voice cues — build/audio.wav is the music only');
    process.exit(0);
}

/** Clip length in seconds, read from ffmpeg's "Duration:" line (ffprobe is not bundled). */
function clipDuration(file) {
    const r = spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' });
    const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(r.stderr ?? '');
    return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null;
}

// Resolve every cue to an absolute start time and validate it.
const clips = cues.map((c, i) => {
    const label = `voice[${i}] ${c.file ?? '(no file)'}`;
    if (!c.file) fail(`${label}: "file" is missing`);
    const file = path.resolve(here, c.file);
    if (!fs.existsSync(file)) fail(`${label}: file not found (${file})`);
    let at, limit = TM.duration, limitName = 'the video end';
    if (c.at !== undefined) at = +c.at;
    else if (c.scene !== undefined) {
        const win = TM.scenes[c.scene];
        if (!win) fail(`${label}: unknown scene "${c.scene}" (known: ${Object.keys(TM.scenes).join(', ')})`);
        at = win[0] + (c.offset ?? 0);
        limit = win[1]; limitName = `the end of scene "${c.scene}"`;
    } else fail(`${label}: needs "scene" (+ "offset") or "at"`);
    if (!Number.isFinite(at) || at < 0) fail(`${label}: invalid start time`);
    const dur = clipDuration(file);
    if (dur === null) fail(`${label}: ffmpeg could not read the clip's duration`);
    if (at + dur > limit) console.warn(`⚠ ${label}: runs ${(at + dur - limit).toFixed(2)} s past ${limitName} (starts ${at.toFixed(2)} s, lasts ${dur.toFixed(2)} s) — shorten the text or lengthen the scene in timing.json`);
    return { file, at };
});

// ------------------------------------------------------------------ filter graph
// [0] music, [1..n] clips.
const D = TM.duration;
const f = [];
clips.forEach((c, i) => {
    const ms = Math.round(c.at * 1000);
    // Mono clips are upmixed to stereo; adelay shifts all channels.
    f.push(`[${i + 1}:a]aformat=sample_rates=${SR}:channel_layouts=stereo,adelay=delays=${ms}:all=1[v${i}]`);
});
const ins = clips.map((_, i) => `[v${i}]`).join('');
f.push(clips.length === 1 ? `${ins}anull[voice]` : `${ins}amix=inputs=${clips.length}:normalize=0:duration=longest[voice]`);
f.push('[voice]asplit=2[vmix][vsc]');
// Duck the music ~8:1 while the voice is present (fast attack, slow release so it doesn't pump).
f.push('[0:a]aformat=sample_rates=48000:channel_layouts=stereo[mus]');
f.push('[mus][vsc]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400:makeup=1[ducked]');
f.push('[ducked][vmix]amix=inputs=2:normalize=0:duration=first[sum]');
// loudnorm works at 192 kHz internally → resample back; then force the exact length.
f.push(`[sum]loudnorm=I=-16:TP=-1:LRA=11,aresample=${SR},apad=whole_dur=${D},atrim=end=${D}[out]`);

const ff = spawnSync(ffmpegPath, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', MUSIC, ...clips.flatMap((c) => ['-i', c.file]),
    '-filter_complex', f.join(';'), '-map', '[out]',
    '-c:a', 'pcm_s16le', '-ar', String(SR), '-ac', '2', '-t', String(D), OUT,
], { stdio: 'inherit' });
if (ff.status !== 0) fail(`ffmpeg exited ${ff.status}`);
console.log(`mix: ${clips.length} voice clip${clips.length > 1 ? 's' : ''} + music → build/audio.wav`);
