// Builds the website bundle → ../docs/ (static files, ~1.5 MB; committed, served by GitHub Pages from /docs).
//
//   node site.mjs        (normally via `npm run site`, which also regenerates music + mix first)
//
// docs/index.html is video.html with the dev-time node_modules paths swapped for bundled copies and
// the soundtrack set to audio.m4a. Needs build/audio.wav (node music.mjs && node mix.mjs).
//
// docs/ also holds hand-placed files (.nojekyll), so only the generated entries listed in GENERATED are
// cleaned and counted — never wipe OUT as a whole.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '..', 'docs');
// Everything this script writes into OUT; the rest of OUT (.nojekyll) is not ours.
const GENERATED = ['index.html', 'video.js', 'player.js', 'data.js', 'audio.m4a', 'assets', 'lib', 'fonts'];
const AUDIO = path.join(here, 'build', 'audio.wav');
const nm = (...p) => path.join(here, 'node_modules', ...p);

function fail(msg) { console.error(`✖ site: ${msg}`); process.exit(1); }
if (!fs.existsSync(AUDIO)) fail('build/audio.wav is missing — run `node music.mjs && node mix.mjs` first (or `npm run site`)');

for (const entry of GENERATED) fs.rmSync(path.join(OUT, entry), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'lib'), { recursive: true });

// ------------------------------------------------------------------ index.html
// Each rewrite must match, so a layout change in video.html can't silently ship a broken page.
let html = fs.readFileSync(path.join(here, 'video.html'), 'utf8');
function rewrite(re, replacement, what) {
    if (!re.test(html)) fail(`video.html no longer contains ${what} — update site.mjs`);
    html = html.replace(re, replacement);
}
let firstFont = true;
rewrite(/^<link rel="stylesheet" href="node_modules\/@fontsource\/[^"]+">\n/gm,
        () => (firstFont ? ((firstFont = false), '<link rel="stylesheet" href="fonts/fonts.css">\n') : ''),
        'the @fontsource <link> tags');
rewrite(/node_modules\/gsap\/dist\/gsap\.min\.js/, 'lib/gsap.min.js', 'the gsap <script> path');
rewrite(/<body>/, '<body data-audio="audio.m4a">', '<body>');
rewrite(/<script src="video\.js"><\/script>/, '<script src="data.js"></script>\n<script src="video.js"></script>', 'the video.js <script> tag');
rewrite(/(<meta name="viewport"[^>]*>\n)/,
        '$1<meta name="description" content="A one-minute tour of EA Bridge, the Visual Studio Code extension that browses Enterprise Architect models, renders diagrams, answers AI questions and generates code — without Enterprise Architect.">\n',
        'the viewport <meta> tag');
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// ------------------------------------------------------------------ scripts, data, assets
for (const f of ['video.js', 'player.js']) fs.copyFileSync(path.join(here, f), path.join(OUT, f));
fs.cpSync(path.join(here, 'assets'), path.join(OUT, 'assets'), { recursive: true });

// The three files video.js would fetch(), embedded as a script: <script src> works from file://, fetch() does not,
// so index.html runs from a double-click as well as from a web server. "<" is escaped so the SVG can't end the script.
const readSrc = (f) => fs.readFileSync(path.join(here, f), 'utf8');
const embedded = {
    'timing.json': JSON.parse(readSrc('timing.json')),
    'assets/data.json': JSON.parse(readSrc('assets/data.json')),
    'assets/ClassDiagram.svg': readSrc('assets/ClassDiagram.svg'),
};
fs.writeFileSync(path.join(OUT, 'data.js'), `window.__SITE_DATA = ${JSON.stringify(embedded).replaceAll('<', String.raw`\x3c`)};\n`);

// gsap ships no licence file (its terms are in the header of the .min.js, which is kept verbatim).
fs.copyFileSync(nm('gsap', 'dist', 'gsap.min.js'), path.join(OUT, 'lib', 'gsap.min.js'));
fs.writeFileSync(path.join(OUT, 'lib', 'GSAP-LICENSE.txt'),
    `GSAP ${JSON.parse(fs.readFileSync(nm('gsap', 'package.json'), 'utf8')).version} (gsap.min.js)\n` +
    'Copyright GreenSock. Used under the GSAP "Standard no charge" license: https://gsap.com/standard-license\n');

// ------------------------------------------------------------------ fonts (latin subset only, self-hosted)
const FONTS = [
    { pkg: 'inter', family: 'Inter', weights: [400, 500, 600, 700, 800, 900], licence: 'Inter-OFL.txt' },
    { pkg: 'jetbrains-mono', family: 'JetBrains Mono', weights: [400, 600], licence: 'JetBrainsMono-OFL.txt' },
];
let css = '/* Self-hosted copies of the fonts video.html uses (latin subset). Licences: *-OFL.txt */\n';
for (const { pkg, family, weights, licence } of FONTS) {
    for (const w of weights) {
        const file = `${pkg}-latin-${w}-normal.woff2`;
        fs.copyFileSync(nm('@fontsource', pkg, 'files', file), path.join(OUT, 'fonts', file));
        // font-display: block — the animation must not start in a fallback font and then reflow.
        css += `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${w}; font-display: block; src: url(${file}) format('woff2'); }\n`;
    }
    fs.copyFileSync(nm('@fontsource', pkg, 'LICENSE'), path.join(OUT, 'fonts', licence));
}
fs.writeFileSync(path.join(OUT, 'fonts', 'fonts.css'), css);

// ------------------------------------------------------------------ audio: wav → AAC (plays in Chrome, Firefox, Safari, Edge)
const enc = spawnSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-i', AUDIO,
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', path.join(OUT, 'audio.m4a')], { stdio: 'inherit' });
if (enc.status !== 0) fail(`ffmpeg exited ${enc.status}`);

// ------------------------------------------------------------------ summary
let total = 0;
const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else total += fs.statSync(p).size; } };
for (const entry of GENERATED) {
    const p = path.join(OUT, entry);
    if (fs.statSync(p).isDirectory()) walk(p); else total += fs.statSync(p).size;
}
console.log(`site: wrote ${path.relative(here, OUT)}/ (${(total / 1048576).toFixed(2)} MB; audio.m4a ${(fs.statSync(path.join(OUT, 'audio.m4a')).size / 1048576).toFixed(2)} MB)`);
