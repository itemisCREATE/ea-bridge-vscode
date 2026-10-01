// Renders video.html frame-by-frame with headless Chrome and pipes the frames into ffmpeg.
//
//   node render.mjs                 → ea-bridge-features.mp4 (1920x1080, 30 fps, + build/audio.wav if present)
//   node render.mjs --stills [t…]   → build/stills/still-<t>.png (default: one still per scene, from timing.json)
//   node render.mjs --preview       → serve the source folder and print the player + dev-preview URLs
//   node render.mjs --serve         → serve the built website (../docs/, see site.mjs) and print its URL
//
// video.html is served over a throwaway local HTTP server because it fetch()es its assets
// (file:// would block that). Browser: CHROME_PATH env var, else the first Chrome/Edge/Chromium found
// (only needed for rendering and stills, not for --preview / --serve).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';

const here = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const W = 1920, H = 1080;
const CHROME = process.env.CHROME_PATH ?? [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => fs.existsSync(p));
const OUT = path.join(here, 'ea-bridge-features.mp4');
const AUDIO = path.join(here, 'build', 'audio.wav'); // mix.mjs: music + optional voice-over

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
               '.svg': 'image/svg+xml', '.gif': 'image/gif', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff',
               '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.txt': 'text/plain' };

/** Static server for `root`. Honours Range requests: a browser can only seek (pause/resume, replay) in an <audio> file that is served in ranges. */
function serve(root = here, index = 'video.html') {
    const server = http.createServer((req, res) => {
        const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
        const file = path.resolve(root, rel || index);
        if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
        const size = fs.statSync(file).size;
        const headers = { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes' };
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
        if (range && (range[1] || range[2])) {
            const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2])); // "bytes=-N" = last N bytes
            const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
            if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
            res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
            fs.createReadStream(file, { start, end }).pipe(res);
        } else {
            res.writeHead(200, { ...headers, 'Content-Length': size });
            fs.createReadStream(file).pipe(res);
        }
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function openPage(port) {
    if (!CHROME) throw new Error('No Chrome/Edge/Chromium found — set CHROME_PATH to a Chromium-based browser executable.');
    const browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: true,
        args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'],
        defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
    });
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') console.log(`[page ${m.type()}]`, m.text()); });
    page.on('pageerror', (e) => console.log('[page error]', e.message));
    await page.goto(`http://127.0.0.1:${port}/video.html?render`, { waitUntil: 'networkidle0' });
    await page.waitForFunction('window.__ready === true || window.__error', { timeout: 60_000 });
    const err = await page.evaluate('window.__error');
    if (err) throw new Error(`video.html failed to initialise:\n${err}`);
    return { browser, page };
}

/** Seek the timeline to t, then capture one PNG frame through CDP. */
async function grab(page, cdp, t) {
    await page.evaluate((tt) => window.__seek(tt), t);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 }, optimizeForSpeed: true });
    return Buffer.from(data, 'base64');
}

const args = process.argv.slice(2);
const serveSite = args.includes('--serve');
const siteRoot = path.resolve(here, '..', 'docs'); // the committed website bundle (site.mjs output)
if (serveSite && !fs.existsSync(path.join(siteRoot, 'index.html'))) throw new Error('The website (../docs/index.html) has not been built — run `npm run site` first.');
const server = await serve(serveSite ? siteRoot : here, serveSite ? 'index.html' : 'video.html');
const port = server.address().port;

if (serveSite) {
    console.log(`Website: http://127.0.0.1:${port}/  (Ctrl+C to stop)`);
} else if (args.includes('--preview')) {
    console.log(`Player:      http://127.0.0.1:${port}/video.html`);
    console.log(`Dev preview: http://127.0.0.1:${port}/video.html?dev  (scrubber; Ctrl+C to stop)`);
} else {
    const { browser, page } = await openPage(port);
    const cdp = await page.createCDPSession();
    const duration = await page.evaluate('window.__duration');
    try {
        if (args.includes('--stills')) {
            const times = args.filter((a) => !a.startsWith('--')).map(Number);
            // Default: one still per scene, 80 % of the way through (after its animations have settled).
            const scenes = Object.values(JSON.parse(fs.readFileSync(path.join(here, 'timing.json'), 'utf8')).scenes);
            const list = times.length ? times : scenes.map(([a, b]) => +(a + (b - a) * 0.8).toFixed(2));
            const dir = path.join(here, 'build', 'stills');
            fs.mkdirSync(dir, { recursive: true });
            for (const t of list) {
                const file = path.join(dir, `still-${t.toFixed(2)}.png`);
                fs.writeFileSync(file, await grab(page, cdp, t));
                console.log('wrote', path.relative(here, file));
            }
        } else {
            const frames = Math.round(duration * FPS);
            const hasAudio = fs.existsSync(AUDIO);
            const ff = spawn(ffmpegPath, [
                '-y', '-loglevel', 'error',
                '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
                ...(hasAudio ? ['-i', AUDIO] : []),
                // sRGB screenshots → BT.709 limited range so colours match in players.
                '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-tune', 'animation',
                '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
                ...(hasAudio ? ['-c:a', 'aac', '-b:a', '192k'] : []),
                '-t', String(duration), '-movflags', '+faststart', OUT,
            ], { stdio: ['pipe', 'inherit', 'inherit'] });
            const done = new Promise((resolve, reject) => ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));
            const t0 = Date.now();
            for (let i = 0; i < frames; i++) {
                const png = await grab(page, cdp, i / FPS);
                if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
                if (i % 30 === 0) process.stdout.write(`\rframe ${i}/${frames}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
            }
            ff.stdin.end();
            await done;
            console.log(`\nwrote ${path.relative(here, OUT)}${hasAudio ? ' (with audio)' : ' (silent — run `node music.mjs && node mix.mjs` first for audio)'}`);
        }
    } finally {
        await browser.close();
        server.close();
    }
}
