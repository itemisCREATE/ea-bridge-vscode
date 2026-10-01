'use strict';
/*
 * Timeline for video.html.
 *
 * Every visual state is a pure function of the time t (seconds):
 *   - DOM tweens live on one paused GSAP timeline (tl.time(t))
 *   - typing, counters and canvas drawing are "procs" evaluated at t
 * so the renderer (render.mjs) can grab any frame deterministically via window.__seek(t).
 *
 * Scene windows and every cue the soundtrack must hit (cuts, clicks, typing, drop, final hit)
 * come from timing.json, which music.mjs reads too. Times inside a scene are relative to the
 * scene start, so scenes can be moved or lengthened by editing timing.json alone.
 *
 * Three modes, chosen by the inline script in video.html (html[data-mode]):
 *   render → ?render  frame-exact capture by render.mjs, no UI
 *   dev    → ?dev     scrubber preview (startDevPreview below)
 *   site   → default  website player with sound and overlay controls (player.js)
 */
const MODE = document.documentElement.dataset.mode;
const RENDER = MODE === 'render';
// Soundtrack for the two interactive modes: build/audio.wav (music + optional voice-over) in the
// source folder; site.mjs sets data-audio="audio.m4a" in the built page.
const AUDIO_SRC = document.body.dataset.audio || 'build/audio.wav';

// The built website embeds timing.json, assets/data.json and assets/ClassDiagram.svg in data.js (window.__SITE_DATA),
// so index.html also works when opened from disk, where fetch() is blocked. The source folder (render, ?dev,
// npm run preview) has no data.js and fetches them.
const SITE_DATA = window.__SITE_DATA;
const loadJson = async (url) => (SITE_DATA ? SITE_DATA[url] : (await fetch(url)).json());
const loadText = async (url) => (SITE_DATA ? SITE_DATA[url] : (await fetch(url)).text());

let TM;          // timing.json
let DURATION;    // TM.duration

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut2 = gsap.parseEase('power2.inOut'), easeOutBack = gsap.parseEase('back.out(1.8)');

// Seeded PRNG so particles / jitter are identical in every render.
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const LOGO_PATHS = [
  'M 9 41 Q 127.5 8 246 43 L 246 89 Q 127.5 59 9 89 Z',
  'M 56 100 L 98 95 L 98 230 L 56 230 Z',
  'M 157 95 L 199 101 L 199 230 L 157 230 Z',
];
function fillLogo(svg, prefix, c1 = '#00AFFF', c2 = '#006ECD') {
  svg.innerHTML = `<defs><linearGradient id="${prefix}g" gradientUnits="userSpaceOnUse" x1="20" y1="20" x2="236" y2="236">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>`
    + LOGO_PATHS.map((d, i) => `<path id="${prefix}b${i}" d="${d}" fill="url(#${prefix}g)"/>`).join('');
}
function splitWord(el) {
  el.innerHTML = [...el.dataset.split].map((ch) => `<span>${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
  return $$('span', el);
}

const tl = gsap.timeline({ paused: true });
const procs = [];

/** Scene visibility + default zoom-through enter/exit around the cut times. */
function scene(id, tIn, tOut, { enter = true, exit = true, exitVars = {} } = {}) {
  const el = document.getElementById(id);
  tl.set(el, { visibility: 'visible' }, Math.max(0, tIn - 0.2));
  if (enter) tl.fromTo(el, { opacity: 0, scale: 0.94, filter: 'blur(10px)' },
                        { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.55, ease: 'power3.out' }, tIn - 0.2);
  if (tOut < DURATION) {
    if (exit) tl.to(el, { opacity: 0, scale: 1.12, filter: 'blur(14px)', duration: 0.45, ease: 'power2.in', ...exitVars }, tOut - 0.45);
    tl.set(el, { visibility: 'hidden' }, tOut + 0.05);
  }
  return el;
}
/** Short light flash on each cut (lines up with the whooshes in music.mjs). */
function flashAt(t, peak = 0.28) {
  tl.to('#flash', { opacity: peak, duration: 0.12, ease: 'power1.in' }, t - 0.12);
  tl.to('#flash', { opacity: 0, duration: 0.5, ease: 'power2.out' }, t);
}
/** Typewriter proc: reveals `text` from t0 at `cps` characters per second. */
function typer(el, text, t0, cps, { caret = null, html = (s) => s, hideCaretAfter = Infinity } = {}) {
  procs.push((t) => {
    const n = clamp(Math.floor((t - t0) * cps), 0, text.length);
    el.innerHTML = html(text.slice(0, n));
    if (caret) caret.style.visibility = (t >= t0 - 0.4 && t < hideCaretAfter && (n < text.length || Math.floor(t * 2.5) % 2 === 0)) ? 'visible' : 'hidden';
  });
}
/** Typewriter that fills exactly the [t0, t1] window from timing.json (the music ticks over it). */
const typeWindow = (el, text, [t0, t1], opts) => typer(el, text, t0, text.length / (t1 - t0), opts);
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------- background
const bgCtx = $('#bg').getContext('2d');
const PARTICLES = (() => { const r = mulberry32(7); return Array.from({ length: 150 }, () => ({ x: r() * 1920, y: r() * 1080, s: 0.6 + r() * 1.9, v: 8 + r() * 26, ph: r() * 6.283, a: 0.12 + r() * 0.5 })); })();
function drawBg(t) {
  const c = bgCtx;
  c.clearRect(0, 0, 1920, 1080);
  // Perspective grid floor drifting towards the viewer.
  const vy = 520, vx = 960, top = 600;
  const g = c.createLinearGradient(0, top, 0, 1080);
  g.addColorStop(0, 'rgba(0,175,255,0)'); g.addColorStop(1, 'rgba(0,175,255,.20)');
  c.strokeStyle = g; c.lineWidth = 1.2;
  c.beginPath();
  for (let x = -3200; x <= 5120; x += 170) {
    const k = (top - vy) / (1080 - vy);
    c.moveTo(vx + (x - vx) * k, top); c.lineTo(x, 1080);
  }
  const N = 14;
  for (let i = 0; i < N; i++) {
    const z = ((i + t * 0.55) % N) / N;
    const y = top + (1080 - top) * Math.pow(z, 2.3);
    c.moveTo(0, y); c.lineTo(1920, y);
  }
  c.stroke();
  // Floating particles with a soft twinkle.
  for (const p of PARTICLES) {
    const y = ((p.y - t * p.v) % 1080 + 1080) % 1080;
    const a = p.a * (0.55 + 0.45 * Math.sin(t * 2.2 + p.ph));
    c.fillStyle = `rgba(150,215,255,${a.toFixed(3)})`;
    c.beginPath(); c.arc(p.x + Math.sin(t * 0.7 + p.ph) * 14, y, p.s, 0, 6.283); c.fill();
  }
}
function buildGlobal() {
  procs.push(drawBg);
  procs.push((t) => { $('#progress').style.width = `${(t / DURATION) * 100}%`; });
  // Glow blobs wander slowly over the whole video.
  const path1 = [[700, 120], [150, 380], [820, 250], [560, 320], [260, 160], [760, 360], [420, 140], [560, 320]];
  const path2 = [[-900, -300], [-200, -500], [-560, -180], [-760, -420], [-300, -260], [-620, -500], [-400, -200], [-560, -180]];
  const seg = DURATION / path1.length;
  path1.forEach(([x, y], k) => tl.to('#glow1', { x, y, duration: seg, ease: 'sine.inOut' }, k * seg));
  path2.forEach(([x, y], k) => tl.to('#glow2', { x, y, duration: seg, ease: 'sine.inOut' }, k * seg));
  TM.cuts.forEach((c) => flashAt(c, c === TM.finalHit ? 0.45 : 0.26));
}

// ===================================================== 1 · INTRO
function buildIntro() {
  const [a, b] = TM.scenes.intro, L = TM.logoLock;
  scene('s1', a, b, { enter: false });
  fillLogo($('#s1logo'), 's1');
  const letters = splitWord($('#s1word'));
  tl.from('#s1b0', { y: -260, opacity: 0, duration: 0.55, ease: 'expo.out' }, L - 0.68)
    .from('#s1b1', { x: -200, y: 240, opacity: 0, duration: 0.55, ease: 'expo.out' }, L - 0.56)
    .from('#s1b2', { x: 200, y: 240, opacity: 0, duration: 0.55, ease: 'expo.out' }, L - 0.46)
    .to('#s1logo', { scale: 1.1, duration: 0.12, ease: 'power2.out' }, L - 0.02)
    .to('#s1logo', { scale: 1, duration: 0.4, ease: 'elastic.out(1,.5)' }, L + 0.1)
    .fromTo('#s1ring', { scale: 0.4, opacity: 0.9 }, { scale: 2.4, opacity: 0, duration: 0.9, ease: 'power2.out', immediateRender: false }, L)
    .from('#s1kick', { opacity: 0, y: 12, letterSpacing: '1.2em', duration: 0.7, ease: 'power3.out' }, L + 0.1)
    .from(letters, { opacity: 0, y: 90, rotateX: -70, duration: 0.7, ease: 'back.out(1.6)', stagger: 0.06 }, L + 0.2)
    .from('#s1tag', { opacity: 0, y: 26, duration: 0.7, ease: 'power3.out' }, L + 0.9);
  const r = mulberry32(3);
  $$('#s1chips .chip').forEach((chip, i) => {
    const ang = r() * Math.PI * 2;
    tl.from(chip, { x: Math.cos(ang) * 900, y: Math.sin(ang) * 500, rotate: (r() - 0.5) * 90, opacity: 0, scale: 0.4,
                    duration: 0.8, ease: 'expo.out' }, L + 1.5 + i * 0.1);
  });
}

// ===================================================== 2 · WHY
function buildWhy() {
  const [a, b] = TM.scenes.why;
  scene('s2', a, b);
  tl.from('#s2kick', { opacity: 0, x: -30, duration: 0.5, ease: 'power3.out' }, a - 0.18)
    .from('#s2head', { opacity: 0, y: 40, duration: 0.7, ease: 'power3.out' }, a - 0.14);
  const rowT0 = (i) => a + 0.5 + i * 1.15;
  ['#r1', '#r2', '#r3'].forEach((row, i) => {
    const t0 = rowT0(i);
    tl.from(row, { opacity: 0, x: -60, duration: 0.45, ease: 'power3.out' }, t0)
      .to(`${row} .strike`, { width: '104%', duration: 0.35, ease: 'power2.inOut' }, t0 + 0.35)
      .to(`${row} .bt`, { color: '#56667F', duration: 0.3 }, t0 + 0.45)
      .from(`${row} .arr`, { opacity: 0, x: -20, duration: 0.35, ease: 'power2.out' }, t0 + 0.5)
      .from(`${row} .cmp-after`, { opacity: 0, x: 40, duration: 0.45, ease: 'power3.out' }, t0 + 0.6)
      .from(`${row} .check`, { scale: 0, rotate: -90, duration: 0.5, ease: 'back.out(2.4)' }, t0 + 0.72);
  });
  tl.from('#r3 .pill-fast', { scale: 0, duration: 0.4, ease: 'back.out(3)' }, rowT0(2) + 1.0);
  // Speed lines streak past while the "fast" row lands.
  const host = $('#speed'); const r = mulberry32(11);
  for (let i = 0; i < 34; i++) {
    const d = document.createElement('i'); d.className = 'sl';
    const w = 180 + r() * 520;
    d.style.width = `${w}px`; d.style.top = `${120 + r() * 860}px`; d.style.opacity = (0.25 + r() * 0.6).toFixed(2);
    host.appendChild(d);
    tl.fromTo(d, { x: 1920 + r() * 400 }, { x: -w - 200, duration: 0.45 + r() * 0.35, ease: 'none' }, rowT0(2) + 0.5 + r() * 0.9);
  }
}

// ===================================================== 3 · BROWSE
const TREE = [
  { d: 0, tw: '▾', ic: 'Package', n: 'eabridge' },
  { d: 1, tw: '▾', ic: 'Package', n: 'example' },
  { d: 2, ic: 'Diagram', n: 'ClassDiagram', id: 'rowDiag' },
  { d: 2, ic: 'Class', n: 'Account', id: 'rowAccount' },
  { d: 2, ic: 'Class', n: 'AddressBook' },
  { d: 2, ic: 'Class', n: 'Contact' },
  { d: 2, ic: 'Class', n: 'ContactGroup' },
  { d: 2, ic: 'Class', n: '<i>NamedElement</i>' },
  { d: 2, ic: 'Interface', n: 'INamedElement' },
  { d: 2, ic: 'DataType', n: 'Address' },
  { d: 2, ic: 'Enumeration', n: 'Gender' },
];
// Same rows the real Properties view builds for "Account" (extension/src/propview/propviewConnector.ts).
const PROPS = [
  ['Name', 'Account'], ['Type', 'Class'], ['GUID', '{AA5DB81A-A7FA-43ec-8EFB-298AE43DDB22}', 'mono'],
  ['Visibility', 'Public'], ['Notes', 'An Account has a name and an email address and may use address books.'],
  ['Author', 'pkoenemann'],
  ['Tagged Values'], ['my', 'tag'],
  ['Operations'], ['getEmailAddress', '(): String'], ['setEmailAddress', '(email: String): void'],
  ['Relationships'], ['Generalization', '→ <span class="lnk">NamedElement</span>'], ['Association', '→ <span class="lnk">AddressBook</span>  <span style="color:#8B8B8B">Uses 0..*</span>'],
];
function buildBrowse() {
  const [a, b] = TM.scenes.browse;
  const [cAcc, cD1, cD2] = TM.clicks; // click "Account", double-click "ClassDiagram"
  const s3 = scene('s3', a, b, { exitVars: { scale: 2.1, filter: 'blur(10px)', duration: 0.5 } });
  gsap.set(s3, { transformOrigin: '1309px 656px' }); // zoom-through into the editor's diagram
  fillLogo($('#actLogo'), 'act', '#FFFFFF', '#CFE8FF');
  fillLogo($('#watermark'), 'wm', '#FFFFFF', '#FFFFFF');
  $('#tree').innerHTML = TREE.map((r) => `<div class="trow" ${r.id ? `id="${r.id}"` : ''} style="padding-left:${14 + r.d * 26}px">
      <span class="tw">${r.tw ?? ''}</span><img src="assets/icons/${r.ic}.gif" alt="">${r.n}</div>`).join('');
  $('#props').innerHTML = PROPS.map(([k, v, cls]) => v === undefined
      ? `<div class="prow h">${k}</div>`
      : `<div class="prow"><span class="k">${k}</span><span class="v ${cls ?? ''}">${v}</span></div>`).join('');

  tl.from('#s3kick', { opacity: 0, x: -30, duration: 0.5, ease: 'power3.out' }, a - 0.05)
    .from('#s3head', { opacity: 0, y: 30, duration: 0.7, ease: 'power3.out' }, a)
    .from('#win', { rotateX: 24, y: 160, opacity: 0, duration: 0.9, ease: 'power3.out' }, a - 0.15)
    .from('#tree .trow', { opacity: 0, x: -24, duration: 0.35, ease: 'power2.out', stagger: 0.09 }, a + 0.45)
    .set('#props .prow', { opacity: 0 }, 0)
    .set('#tabDiag', { opacity: 0 }, 0)
    .set('#edDiag', { opacity: 0, scale: 0.9 }, 0);

  // Cursor path (stage coordinates): row centres = win top + titlebar + header + padding + i × row height.
  const rowY = (i) => 214 + 40 + 36 + 2 + i * 31 + 15;
  const accY = rowY(3), diagY = rowY(2);
  gsap.set('#cursor', { x: 1240, y: 980, opacity: 0 });
  tl.to('#cursor', { opacity: 1, duration: 0.25 }, cAcc - 0.85)
    .to('#cursor', { x: 330, y: accY - 4, duration: 0.72, ease: 'power2.inOut' }, cAcc - 0.8)
    .to('#cursor', { scale: 0.85, duration: 0.08, yoyo: true, repeat: 1 }, cAcc - 0.02)
    .fromTo('#rip1', { x: 334, y: accY, scale: 0.3, opacity: 1 }, { scale: 1.4, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, cAcc)
    .set('#rowAccount', { attr: { class: 'trow sel' } }, cAcc + 0.02)
    .to('#props .prow', { opacity: 1, duration: 0.2, stagger: 0.09 }, cAcc + 0.1)
    .from('#props .prow', { x: -18, duration: 0.35, ease: 'power2.out', stagger: 0.09 }, cAcc + 0.1)
    .to('#cursor', { x: 360, y: diagY - 4, duration: 0.65, ease: 'power2.inOut' }, cD1 - 0.75)
    .to('#cursor', { scale: 0.85, duration: 0.07, yoyo: true, repeat: 3 }, cD1 - 0.02)
    .fromTo('#rip2', { x: 364, y: diagY, scale: 0.3, opacity: 1 }, { scale: 1.3, opacity: 0, duration: 0.45, ease: 'power2.out', immediateRender: false }, cD1)
    .fromTo('#rip3', { x: 364, y: diagY, scale: 0.3, opacity: 1 }, { scale: 1.6, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, cD2)
    .set('#rowAccount', { attr: { class: 'trow' } }, cD2 + 0.02)
    .set('#rowDiag', { attr: { class: 'trow sel' } }, cD2 + 0.02)
    .to('#tabDiag', { opacity: 1, duration: 0.15 }, cD2 + 0.07)
    .to('#watermark', { opacity: 0, duration: 0.2 }, cD2 + 0.07)
    .to('#edDiag', { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' }, cD2 + 0.12)
    .to('#cursor', { opacity: 0, duration: 0.25 }, cD2 + 0.5);
}

// ===================================================== 4a · DIAGRAMS
/** Inline the real ClassDiagram SVG (exported by the extension's headless renderer) and
 *  regroup its render passes so bodies, connectors and labels can animate separately. */
async function mountDiagram() {
  let src = await loadText('assets/ClassDiagram.svg');
  src = src.replace(/<\?xml[^>]*\?>/, '');
  $('#diagHost').innerHTML = src;
  const svg = $('#diagHost svg');
  svg.removeAttribute('width'); svg.removeAttribute('height');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const passes = { bodies: [], note: [], conns: [], labels: [], deco: [] };
  let pass = null;
  for (const node of [...svg.childNodes]) {
    if (node.nodeType === Node.COMMENT_NODE) {
      const c = node.textContent;
      pass = c.includes('Pass 1b') ? 'note' : c.includes('Pass 1') ? 'bodies' : c.includes('Pass 2') ? 'conns'
           : c.includes('Pass 3') ? 'labels' : c.includes('decorations') ? 'deco' : pass;
      continue;
    }
    if (node.nodeType === Node.ELEMENT_NODE && pass && node.tagName !== 'clipPath') passes[pass].push(node);
  }
  const NS = 'http://www.w3.org/2000/svg';
  // One <g> per element body: its rect plus the compartment lines inside it.
  const bodyGroups = [];
  for (const n of passes.bodies) {
    if (n.tagName === 'rect') {
      const g = document.createElementNS(NS, 'g'); n.before(g); g.appendChild(n);
      bodyGroups.push({ g, x: +n.getAttribute('x'), y: +n.getAttribute('y'), w: +n.getAttribute('width'), h: +n.getAttribute('height') });
    } else if (n.tagName === 'line') {
      const y = +n.getAttribute('y1'), x = +n.getAttribute('x1');
      const owner = bodyGroups.find((b) => x >= b.x - 1 && x <= b.x + b.w + 1 && y >= b.y - 1 && y <= b.y + b.h + 1);
      if (owner) owner.g.appendChild(n);
    }
  }
  const noteG = document.createElementNS(NS, 'g'); passes.note[0]?.before(noteG); passes.note.forEach((n) => noteG.appendChild(n));
  return {
    bodies: [...bodyGroups.map((b) => b.g), noteG],
    lines: passes.conns.filter((n) => n.tagName === 'polyline' || n.tagName === 'line'),
    heads: passes.conns.filter((n) => n.tagName === 'g'),
    labels: passes.labels,
    deco: passes.deco,
  };
}
function buildDiagrams(parts) {
  const [a] = TM.scenes.diagrams, w0 = TM.wave[0];
  // No default exit: the card collapses into the first tile of the 1,000-diagram wave.
  scene('s4a', a, w0 + 0.1, { enter: true, exit: false });
  tl.from('#s4kick', { opacity: 0, x: -30, duration: 0.5, ease: 'power3.out' }, a - 0.05)
    .from('#s4head', { opacity: 0, y: 36, duration: 0.7, ease: 'power3.out' }, a)
    .from('#s4sub', { opacity: 0, y: 20, duration: 0.5, ease: 'power3.out' }, a + 0.3)
    .from('#s4types .chip', { opacity: 0, y: 20, scale: 0.8, duration: 0.45, ease: 'back.out(2)', stagger: 0.1 }, a + 0.6)
    .from('#diagCard', { opacity: 0, scale: 0.86, rotateY: -14, duration: 0.7, ease: 'power3.out' }, a - 0.15);
  tl.from(parts.bodies, { opacity: 0, scale: 0.4, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(1.7)', stagger: 0.1 }, a + 0.1);
  parts.lines.forEach((ln, i) => {
    const t0 = a + 0.8 + i * 0.09;
    if (ln.hasAttribute('stroke-dasharray')) { tl.from(ln, { opacity: 0, duration: 0.35 }, t0); return; }
    const len = ln.getTotalLength();
    gsap.set(ln, { strokeDasharray: len, strokeDashoffset: len });
    tl.to(ln, { strokeDashoffset: 0, duration: 0.55, ease: 'power2.inOut' }, t0);
  });
  tl.from(parts.heads, { opacity: 0, duration: 0.3, stagger: 0.05 }, a + 1.7)
    .from(parts.labels, { opacity: 0, duration: 0.35, stagger: { amount: 1.0 } }, a + 1.0)
    .from(parts.deco, { opacity: 0, duration: 0.35 }, a + 1.8);
  // "Export SVG" press, then the diagram collapses into the centre tile.
  tl.to('#expBtn', { scale: 1.18, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' }, w0 - 1.05)
    .to('#expBtn', { boxShadow: '0 0 30px #00AFFF', duration: 0.2 }, w0 - 1.05)
    .to(['#s4kick', '#s4head', '#s4sub', '#s4types'], { opacity: 0, x: -40, duration: 0.4, ease: 'power2.in' }, w0 - 0.75)
    .to('#diagCard', { x: 960 - 1320, y: 0, scale: 0.05, rotate: 0, duration: 0.55, ease: 'power3.in' }, w0 - 0.55)
    .to('#diagCard', { opacity: 0, duration: 0.1 }, w0 - 0.05);
}

// ===================================================== 4b · 1,000 DIAGRAMS
const GRID = { cols: 40, rows: 25, w: 40, h: 30, gx: 8, gy: 8 };
GRID.ox = (1920 - (GRID.cols * (GRID.w + GRID.gx) - GRID.gx)) / 2;
GRID.oy = (1080 - (GRID.rows * (GRID.h + GRID.gy) - GRID.gy)) / 2;
let TILES = [];
const VARIANTS = [];
/** Pre-render small diagram thumbnails: the real ClassDiagram + procedural look-alikes. */
async function buildTileVariants() {
  const [w0, w1] = TM.wave;
  const img = new Image(); img.src = 'assets/ClassDiagram.svg'; await img.decode();
  const fills = ['#FDFAF7', '#F1ECFA', '#FAF9E6', '#E8FDE3', '#E5F2FE', '#FEF2DD'];
  const r = mulberry32(42);
  for (let v = 0; v < 18; v++) {
    const cv = document.createElement('canvas'); cv.width = GRID.w * 2; cv.height = GRID.h * 2;
    const c = cv.getContext('2d'); c.scale(2, 2);
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, GRID.w, GRID.h);
    if (v === 0) { c.drawImage(img, 1, 1, GRID.w - 2, GRID.h - 2); }
    else {
      const n = 3 + Math.floor(r() * 4); const boxes = [];
      for (let i = 0; i < n; i++) boxes.push({ x: 3 + r() * (GRID.w - 14), y: 3 + r() * (GRID.h - 11), w: 7 + r() * 6, h: 5 + r() * 4 });
      c.strokeStyle = '#69738C'; c.lineWidth = 0.6; c.beginPath();
      for (let i = 1; i < n; i++) { const p = boxes[i - 1], q = boxes[i]; c.moveTo(p.x + p.w / 2, p.y + p.h / 2); c.lineTo(p.x + p.w / 2, q.y + q.h / 2); c.lineTo(q.x + q.w / 2, q.y + q.h / 2); }
      c.stroke();
      for (const bx of boxes) { c.fillStyle = fills[Math.floor(r() * fills.length)]; c.fillRect(bx.x, bx.y, bx.w, bx.h); c.strokeStyle = '#9A8484'; c.lineWidth = 0.7; c.strokeRect(bx.x, bx.y, bx.w, bx.h); }
    }
    VARIANTS.push(cv);
  }
  // Appear times: a ripple radiating from the centre tile (where the real diagram landed).
  const cx = (GRID.cols - 1) / 2, cy = (GRID.rows - 1) / 2;
  const rj = mulberry32(5);
  const raw = [];
  for (let row = 0; row < GRID.rows; row++) for (let col = 0; col < GRID.cols; col++) {
    const d = Math.hypot(col - cx, (row - cy) * 1.3);
    raw.push({ col, row, d: d + rj() * 2.2, v: (row * 7 + col * 13) % VARIANTS.length });
  }
  const dmax = Math.max(...raw.map((x) => x.d));
  TILES = raw.map((x) => ({ ...x, t: w0 + (w1 - w0) * Math.pow(x.d / dmax, 0.85) }));
  const centre = TILES.reduce((p, q) => (Math.hypot(q.col - cx, q.row - cy) < Math.hypot(p.col - cx, p.row - cy) ? q : p));
  centre.v = 0; centre.t = w0;
}
function drawTiles(t) {
  const [, b] = TM.scenes.thousand, [w0, w1] = TM.wave;
  const c = $('#tiles').getContext('2d');
  c.clearRect(0, 0, 1920, 1080);
  if (t < w0 - 0.3 || t > b + 0.2) return;
  let count = 0;
  for (const tile of TILES) {
    const age = t - tile.t;
    if (age < 0) continue;
    count++;
    const x = GRID.ox + tile.col * (GRID.w + GRID.gx) + GRID.w / 2;
    const y = GRID.oy + tile.row * (GRID.h + GRID.gy) + GRID.h / 2;
    const s = age < 0.28 ? easeOutBack(age / 0.28) : 1;
    // Landing flash, plus a diagonal light sweep across the full grid once all 1,000 are in.
    const sweepX = -300 + ((t - w1) / 0.75) * 2600;
    const sweep = t > w1 ? Math.max(0, 1 - Math.abs(x - sweepX + (y - 540) * 0.35) / 140) * 0.85 : 0;
    const glow = Math.max(0, 1 - age / 0.45, sweep);
    c.save(); c.translate(x, y); c.scale(s, s);
    c.globalAlpha = 0.72;
    c.drawImage(VARIANTS[tile.v], -GRID.w / 2, -GRID.h / 2, GRID.w, GRID.h);
    if (glow > 0) {
      c.globalAlpha = glow; c.strokeStyle = '#00AFFF'; c.lineWidth = 2.5; c.shadowColor = '#00AFFF'; c.shadowBlur = 14;
      c.strokeRect(-GRID.w / 2 - 1, -GRID.h / 2 - 1, GRID.w + 2, GRID.h + 2);
    }
    c.restore();
  }
  $('#counter').textContent = count.toLocaleString('en-US');
}
function buildThousand() {
  const [a, b] = TM.scenes.thousand, [, w1] = TM.wave, drop = TM.drop;
  scene('s4b', a, b, { enter: false });
  procs.push(drawTiles);
  tl.from('#tiles', { scale: 1.08, duration: drop - a + 0.5, ease: 'power1.out' }, a)
    .from('#s4bShade', { opacity: 0, duration: 0.4 }, a)
    .from('#s4bKick', { opacity: 0, y: 14, duration: 0.45, ease: 'power3.out' }, a + 0.1)
    .from('#counter', { opacity: 0, scale: 0.6, duration: 0.5, ease: 'back.out(2)' }, a + 0.15)
    .from('#s4bLine', { opacity: 0, y: 20, duration: 0.5, ease: 'power3.out' }, a + 0.45)
    .to('#counter', { scale: 1.12, duration: 0.12, ease: 'power2.out' }, w1)
    .to('#counter', { scale: 1, duration: 0.5, ease: 'elastic.out(1,.45)' }, w1 + 0.12)
    // "in just 5 seconds" lands exactly on the music drop.
    .from('#s4bSlam', { opacity: 0, scale: 1.9, duration: 0.32, ease: 'power4.in' }, drop - 0.32)
    .to('#s4bSlam', { y: -4, duration: 0.08, yoyo: true, repeat: 3 }, drop);
  flashAt(drop, 0.22);
}

// ===================================================== 5 · AI
function buildAI(data) {
  const [a, b] = TM.scenes.ai, q = TM.typing.question, qq = TM.typing.query;
  scene('s5', a, b);
  // Chips must exist before their tween is created below.
  $('#answers').innerHTML = data.answer.map((n) => `<span class="chip"><img src="assets/icons/Class.gif" alt="">${n}</span>`).join('');
  const cmd = `$ ea-bridge query SampleEAModel.qea \\\n  '${data.jq}'`;
  const resText = JSON.stringify(data.answer);
  const send = q[1] + 0.2, done = qq[1];
  tl.from('#s5kick', { opacity: 0, x: -30, duration: 0.5, ease: 'power3.out' }, a - 0.05)
    .from('#s5head', { opacity: 0, y: 36, duration: 0.7, ease: 'power3.out' }, a)
    .from('#s5sub', { opacity: 0, y: 20, duration: 0.5, ease: 'power3.out' }, a + 0.3)
    .from('#chat', { opacity: 0, x: 120, duration: 0.7, ease: 'power3.out' }, a - 0.1)
    .set(['#ububble', '#thinking', '#toolcard', '#lock'], { opacity: 0 }, 0)
    .to('#composer', { opacity: 0, duration: 0.15 }, send)
    .fromTo('#ububble', { opacity: 0, scale: 0.6, y: 520 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)' }, send)
    .to('#thinking', { opacity: 1, duration: 0.1 }, send + 0.35)
    .to('#thinking i', { y: -10, duration: 0.17, yoyo: true, repeat: 3, stagger: 0.08, ease: 'sine.inOut' }, send + 0.35)
    .to('#thinking', { opacity: 0, duration: 0.1 }, qq[0] - 0.2)
    .fromTo('#toolcard', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, qq[0] - 0.15)
    .from('#answers .chip', { opacity: 0, scale: 0.4, y: 20, duration: 0.45, ease: 'back.out(2.2)', stagger: 0.15 }, done + 2.0)
    .fromTo('#lock', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, done + 2.7)
    .to('#lock', { boxShadow: '0 0 40px rgba(79,227,176,.45)', duration: 0.45, yoyo: true, repeat: 1 }, done + 3.1);
  typeWindow($('#composerText'), 'Which classes inherit from NamedElement?', q, { caret: $('#composerCaret'), hideCaretAfter: send });
  typeWindow($('#toolText'), cmd, qq, { html: (s) => escapeHtml(s).replace(/^\$/, '<span style="color:#4FE3B0">$</span>') });
  typer($('#toolRes'), `→ ${resText}`, done + 0.3, 60);
  const pre = `${data.answer.length} classes inherit from `;
  typer($('#reply'), `${pre}NamedElement:`, done + 1.1, 45, { html: (s) => (s.length <= pre.length ? s : `${pre}<b style="color:#7AD7FF">${s.slice(pre.length)}</b>`) });
}

// ===================================================== 6 · CLI / CI / CODEGEN
const TERM_CMD = 'ea-bridge export model.qea | python gen-java.py - ./src-gen';
// Output format of gen-java.py's _print_tree(); file sizes from the real generated sources.
const TERM_OUT = [
  '<span class="dim">Output: ./src-gen</span>',
  '└── eabridge/',
  '    └── example/',
  '        ├── Account.java <span class="dim">(2.1 KB)</span>',
  '        ├── Address.java <span class="dim">(1.2 KB)</span>',
  '        ├── AddressBook.java <span class="dim">(1.9 KB)</span>',
  '        ├── Contact.java <span class="dim">(2.7 KB)</span>',
  '        ├── ContactGroup.java <span class="dim">(1.4 KB)</span>',
  '        ├── INamedElement.java <span class="dim">(1.1 KB)</span>',
  '        └── NamedElement.java <span class="dim">(1.1 KB)</span>',
  '',
  '<span class="ok">Total: 7 files generated.</span>',
];
const JSON_CHIPS = ['"schemaVersion": "1.11"', '"name": "Account"', '"elementType": "Class"', '"attributes": […]',
                    '"operations": […]', '"connectors": {…}', '"taggedValues": […]', '"diagrams": {…}'];
function buildCLI() {
  const [a] = TM.scenes.cli, [c0, c1] = TM.typing.command;
  scene('s6', a, TM.scenes.cli[1]);
  tl.from('#s6kick', { opacity: 0, x: -30, duration: 0.5, ease: 'power3.out' }, a - 0.05)
    .from('#s6head', { opacity: 0, y: 36, duration: 0.7, ease: 'power3.out' }, a)
    .from('#term', { opacity: 0, y: 60, duration: 0.6, ease: 'power3.out' }, a - 0.05);
  const term = $('#termText');
  const cps = TERM_CMD.length / (c1 - c0), out0 = c1 + 0.25;
  procs.push((t) => {
    const n = clamp(Math.floor((t - c0) * cps), 0, TERM_CMD.length);
    let html = `<span class="p">$</span> ${escapeHtml(TERM_CMD.slice(0, n))}`;
    if (t < out0 && (n < TERM_CMD.length || Math.floor(t * 2.5) % 2 === 0)) html += '<span class="caret"></span>';
    const shown = t < out0 ? 0 : clamp(Math.floor((t - out0) / 0.12) + 1, 0, TERM_OUT.length);
    if (shown > 0) html += '\n' + TERM_OUT.slice(0, shown).join('\n');
    term.innerHTML = html;
  });
  // JSON fragments fly from the terminal pipe into the code generator (quadratic Bézier paths).
  const host = $('#jchips');
  JSON_CHIPS.forEach((txt, i) => {
    const el = document.createElement('div'); el.className = 'jchip'; el.textContent = txt; host.appendChild(el);
    const t0 = c1 + 0.1 + i * 0.2, dur = 1.0;
    // From the terminal's right edge (clear of its text) into the Java card's header.
    const p0 = { x: 940, y: 420 + (i % 3) * 40 }, p1 = { x: 1060, y: 250 + (i % 4) * 26 }, p2 = { x: 1250 + (i % 3) * 70, y: 452 };
    procs.push((t) => {
      const u = (t - t0) / dur;
      if (u <= 0 || u >= 1) { el.style.opacity = 0; return; }
      const e = easeInOut2(u);
      const x = (1 - e) ** 2 * p0.x + 2 * (1 - e) * e * p1.x + e * e * p2.x;
      const y = (1 - e) ** 2 * p0.y + 2 * (1 - e) * e * p1.y + e * e * p2.y;
      el.style.opacity = Math.min(1, Math.min(u * 6, (1 - u) * 5));
      el.style.transform = `translate(${x}px, ${y}px) scale(${1 - 0.35 * e})`;
    });
  });
  // Code cards: stacked, then fanned out (Java in front).
  tl.from(['#cardCpp', '#cardPy', '#cardJava'], { opacity: 0, y: 80, scale: 0.85, duration: 0.5, ease: 'power3.out', stagger: 0.12 }, c1 + 1.4)
    .to('#cardCpp', { x: 60, y: -110, rotate: 4, scale: 0.86, duration: 0.8, ease: 'power3.inOut' }, c1 + 2.4)
    .to('#cardPy', { x: 30, y: -55, rotate: 2, scale: 0.93, duration: 0.8, ease: 'power3.inOut' }, c1 + 2.4)
    .to('#cardJava', { x: 0, y: 40, rotate: -2, duration: 0.8, ease: 'power3.inOut' }, c1 + 2.4)
    .from('#s6chips .chip', { opacity: 0, y: 30, scale: 0.8, duration: 0.45, ease: 'back.out(2)', stagger: 0.15 }, c1 + 3.6);
}

// ===================================================== 7 · OUTRO
function buildOutro() {
  const [a, b] = TM.scenes.outro, h = TM.finalHit;
  scene('s7', a, b);
  fillLogo($('#s7logo'), 's7');
  const letters = splitWord($('#s7word'));
  tl.from('#s7b0', { y: -200, opacity: 0, duration: 0.4, ease: 'expo.out' }, h - 0.25)
    .from('#s7b1', { x: -160, y: 180, opacity: 0, duration: 0.4, ease: 'expo.out' }, h - 0.2)
    .from('#s7b2', { x: 160, y: 180, opacity: 0, duration: 0.4, ease: 'expo.out' }, h - 0.15)
    .fromTo('#s7ring', { scale: 0.4, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 0.9, ease: 'power2.out', immediateRender: false }, h + 0.02)
    .from('#s7kick', { opacity: 0, letterSpacing: '1.2em', duration: 0.7, ease: 'power3.out' }, h + 0.15)
    .from(letters, { opacity: 0, y: 80, rotateX: -70, duration: 0.6, ease: 'back.out(1.6)', stagger: 0.05 }, h + 0.25)
    .from('#s7for', { opacity: 0, y: 20, duration: 0.55, ease: 'power3.out' }, h + 0.7)
    .from('#s7feat', { opacity: 0, y: 20, duration: 0.55, ease: 'power3.out' }, h + 1.0)
    .from('#s7cta', { opacity: 0, scale: 0.6, duration: 0.6, ease: 'back.out(2)' }, h + 1.4)
    .fromTo('#s7shine', { x: 0 }, { x: 960, duration: 0.9, ease: 'power2.inOut' }, h + 2.6)
    .fromTo('#s7shine', { x: 0 }, { x: 960, duration: 0.9, ease: 'power2.inOut', immediateRender: false }, h + 3.9)
    .from('#s7url', { opacity: 0, y: 14, duration: 0.55, ease: 'power3.out' }, h + 1.9)
    .from('#s7tm', { opacity: 0, duration: 0.6 }, h + 2.2);
}

// ---------------------------------------------------------------- boot
window.__seek = (t) => { tl.time(t); for (const p of procs) p(t); };

async function init() {
  TM = await loadJson('timing.json');
  DURATION = TM.duration;
  window.__duration = DURATION;
  window.__timing = TM;
  await Promise.all(['400 20px Inter', '500 20px Inter', '600 20px Inter', '700 20px Inter', '800 20px Inter', '900 20px Inter',
                     '400 20px "JetBrains Mono"', '600 20px "JetBrains Mono"'].map((f) => document.fonts.load(f)));
  await document.fonts.ready;
  const data = await loadJson('assets/data.json');
  const parts = await mountDiagram();
  await buildTileVariants();
  buildGlobal();
  buildIntro(); buildWhy(); buildBrowse(); buildDiagrams(parts); buildThousand(); buildAI(data); buildCLI(); buildOutro();
  await Promise.all([...document.images].map((im) => im.decode().catch(() => {})));
  window.__seek(0);
  window.__ready = true;
  if (MODE === 'dev') startDevPreview();
  else if (MODE === 'site') startPlayer(); // player.js
}

/** Letterbox the 1920×1080 stage into the window (keeping `bottomInset` px free) and keep it fitted on resize.
 *  Shared by the dev preview and the website player. */
function fitStage(bottomInset = 0) {
  const stage = $('#stage');
  const fit = () => {
    const h = innerHeight - bottomInset;
    const s = Math.min(innerWidth / 1920, h / 1080);
    stage.style.transform = `scale(${s})`;
    stage.style.left = `${(innerWidth - 1920 * s) / 2}px`;
    stage.style.top = `${(h - 1080 * s) / 2}px`;
  };
  addEventListener('resize', fit); fit();
}

// Dev preview (?dev): fit the stage to the window, play in real time with a scrubber, optional music sync.
function startDevPreview() {
  fitStage(54);
  const audio = new Audio(AUDIO_SRC); let hasAudio = false;
  audio.addEventListener('canplay', () => { hasAudio = true; }, { once: true });
  let playing = true, t = 0, last = performance.now();
  const scrub = $('#scrub'), label = $('#tlabel'), btn = $('#play');
  scrub.max = DURATION;
  const sync = () => { if (!hasAudio) return; audio.currentTime = t; if (playing) audio.play().catch(() => {}); else audio.pause(); };
  btn.onclick = () => { playing = !playing; btn.textContent = playing ? '❚❚ Pause' : '▶ Play'; last = performance.now(); sync(); };
  $('#restart').onclick = () => { t = 0; playing = true; btn.textContent = '❚❚ Pause'; sync(); };
  scrub.oninput = () => { t = +scrub.value; sync(); };
  const loop = (now) => {
    if (playing) { t += (now - last) / 1000; if (t >= DURATION) { t = DURATION; playing = false; btn.textContent = '▶ Play'; audio.pause(); } }
    last = now;
    window.__seek(t); scrub.value = t; label.textContent = `${t.toFixed(2)} s`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  document.addEventListener('click', () => { if (hasAudio && playing && audio.paused) sync(); }, { once: true });
}
init().catch((e) => {
  console.error(e);
  window.__error = String(e && e.stack || e);
  document.documentElement.classList.add('failed'); // website mode: swaps the loading spinner for an error message
});
