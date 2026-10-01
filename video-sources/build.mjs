// One-call build of the feature video:
//   dependencies (npm ci, if missing) → [refresh assets] → music → mix → MP4 (or website).
//
//   npm run build                    → ea-bridge-features.mp4
//   npm run build -- --assets        → first re-export diagram + query answer from the EA Bridge dev repo
//   npm run stills [-- 12.5 31 …]    → only review PNGs in build/stills/ (default: one per scene)
//   npm run preview                  → live preview in the browser (player + ?dev scrubber), Ctrl+C to stop
//   npm run site                     → static website bundle in ../docs/
//   npm run site -- --serve          → …and serve it locally, Ctrl+C to stop
//
// Plain Node built-ins only, so it also works on a fresh clone before `npm ci`.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const started = Date.now();

function run(cmd, cmdArgs, { shell = false } = {}) {
    console.log(`\n▶ ${cmd} ${cmdArgs.join(' ')}`);
    const r = spawnSync(cmd, cmdArgs, { cwd: here, stdio: 'inherit', shell });
    if (r.status !== 0) {
        console.error(`\n✖ failed: ${cmd} ${cmdArgs.join(' ')} (exit ${r.status ?? r.signal})`);
        process.exit(r.status ?? 1);
    }
}
const node = (script, scriptArgs = []) => run(process.execPath, [script, ...scriptArgs]);

// 1. Dependencies — npm needs a shell on Windows (npm.cmd).
const deps = ['gsap', 'puppeteer-core', 'ffmpeg-static', '@fontsource/inter', '@fontsource/jetbrains-mono'];
if (deps.some((d) => !fs.existsSync(path.join(here, 'node_modules', d)))) {
    run('npm', [fs.existsSync(path.join(here, 'package-lock.json')) ? 'ci' : 'install', '--no-audit', '--no-fund'], { shell: true });
}
// ffmpeg-static downloads its binary in an install script; npm may skip that (allow-scripts policy).
const { default: ffmpegPath } = await import('ffmpeg-static');
if (!ffmpegPath || !fs.existsSync(ffmpegPath)) node(path.join('node_modules', 'ffmpeg-static', 'install.js'));

// 2. Optional: refresh the real artefacts (diagram SVG, query answer, icons) from the dev repo.
if (args.includes('--assets')) node('prepare-assets.mjs');

// 3. Soundtrack (fast; always regenerated so it matches timing.json), then the final mix
//    (music, plus voice-over from timing.json if any) → build/audio.wav.
node('music.mjs');
node('mix.mjs');

// 4a. Website bundle → ../docs/ (optionally served afterwards).
if (args.includes('--site')) {
    node('site.mjs');
    if (args.includes('--serve')) node('render.mjs', ['--serve']);
    else console.log(`\n✔ done in ${((Date.now() - started) / 1000).toFixed(0)} s`);
    process.exit(0);
}

// 4b. Frames → MP4 (or stills / live preview).
const renderArgs = args.filter((a) => a !== '--assets');
node('render.mjs', renderArgs);

if (!renderArgs.includes('--preview')) console.log(`\n✔ done in ${((Date.now() - started) / 1000).toFixed(0)} s`);
