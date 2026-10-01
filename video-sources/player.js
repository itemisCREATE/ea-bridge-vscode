'use strict';
/*
 * Website player for video.html (default mode; ?render and ?dev never call startPlayer).
 *
 * video.js owns the timeline (window.__seek(t)); this file adds what a website needs on top:
 * a play overlay, click-to-pause, mute, fullscreen, replay and a Marketplace link.
 *
 * States (#player[data-state]):
 *   loading → idle ⇄ playing ⇄ paused, playing → ended → playing (replay)
 *
 * Clock: the audio drives the picture. t = audio.currentTime, smoothed with performance.now()
 * between the audio element's coarse updates (never more than 0.1 s ahead of the last real sample),
 * so picture and sound stay in sync — also after a background tab is shown again. If the audio
 * cannot play, a performance.now() clock takes over and the player shows as muted.
 *
 * Uses globals from video.js: $, clamp, fitStage, AUDIO_SRC, TM, DURATION.
 */
function startPlayer() {
  const root = $('#player');
  const big = $('#plBig'), muteBtn = $('#plMute'), fullBtn = $('#plFull');
  const ctaLink = $('#ctaLink');

  // Idle poster: the intro at the moment logo, title and chips are all visible.
  const POSTER_T = TM.scenes.intro[0] + 3.9;
  // In-video CTA button appears at finalHit + 1.4 (see buildOutro); only then is its hotspot live.
  const CTA_LIVE_T = TM.finalHit + 1.4;
  // Testing hook: "#t=57" makes the first play start there (audio still needs the user's click).
  const START_T = (() => { const m = /[#&]t=(\d+(?:\.\d+)?)/.exec(location.hash); return m ? clamp(+m[1], 0, DURATION) : 0; })();

  let state = 'loading';
  let t = 0;                      // playback position shown, seconds
  let audioOK = true;             // false → pure performance.now() clock, shown as muted
  let raf = 0;
  let tAudio = 0, perfAtAudio = 0, lastAudio = -1;   // last distinct audio.currentTime sample and when we saw it
  let tClock = 0, perfAtClock = 0;                   // origin of the fallback clock
  let hideTimer = 0;

  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = AUDIO_SRC;

  // ---------------------------------------------------------------- clock
  function clock() {
    if (!audioOK) return clamp(tClock + (performance.now() - perfAtClock) / 1000, 0, DURATION);
    const a = audio.currentTime, now = performance.now();
    if (a !== lastAudio) { lastAudio = a; tAudio = a; perfAtAudio = now; }
    // Only extrapolate while the audio is really running; while it buffers the picture waits for it.
    const running = !audio.paused && audio.readyState >= 3;
    const next = running ? tAudio + Math.min((now - perfAtAudio) / 1000, 0.1) : a;
    // The audio clock ticks in coarse steps: ignore small backward corrections instead of jittering.
    return next < t && t - next < 0.1 ? t : next;
  }

  function fallBackToClock() {
    if (!audioOK) return;
    audioOK = false;
    tClock = t; perfAtClock = performance.now();
    syncMuteUi();
  }

  // ---------------------------------------------------------------- state
  function setState(s) {
    state = s;
    root.dataset.state = s;
    big.setAttribute('aria-label', { ended: 'Replay', paused: 'Resume' }[s] ?? 'Play');
    updateCtaLink();
    poke();
  }

  /** Draw the frame for time `tt` (window.__seek is the same entry point the renderer uses). */
  function render(tt) {
    window.__seek(tt);
    updateCtaLink();
  }

  function updateCtaLink() {
    ctaLink.classList.toggle('live', (state === 'playing' || state === 'paused') && t >= CTA_LIVE_T);
  }

  function frame() {
    raf = 0;
    if (state !== 'playing') return;
    t = clock();
    if (t >= DURATION - 0.01) { finish(); return; }
    render(t);
    raf = requestAnimationFrame(frame);
  }

  /** Start or resume at `from`. Always called from a click/key handler: audio.play() has to run in
   *  that gesture to satisfy the autoplay policy (iOS included). */
  function play(from) {
    t = from;
    tClock = from; perfAtClock = performance.now();
    lastAudio = -1;
    if (audioOK) {
      if (Math.abs(audio.currentTime - from) > 0.05) audio.currentTime = from;
      audio.play().catch(fallBackToClock);
    }
    setState('playing');
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function pause() {
    if (state !== 'playing') return;
    if (audioOK) { audio.pause(); t = audio.currentTime; } else t = clock();
    cancelAnimationFrame(raf); raf = 0;
    render(t);
    setState('paused');
  }

  function finish() {
    cancelAnimationFrame(raf); raf = 0;
    audio.pause();
    t = DURATION;
    render(DURATION);
    setState('ended');
  }

  function toggle() {
    if (state === 'playing') pause();
    else if (state === 'paused') play(t);
    else if (state === 'idle') play(START_T);
    else if (state === 'ended') play(0);
  }

  // ---------------------------------------------------------------- audio events
  audio.addEventListener('error', fallBackToClock);
  audio.addEventListener('ended', () => { if (state === 'playing') finish(); }); // fires even if rAF is throttled
  audio.addEventListener('waiting', () => { if (state === 'playing') root.classList.add('buffering'); });
  audio.addEventListener('playing', () => root.classList.remove('buffering'));
  audio.addEventListener('pause', () => root.classList.remove('buffering'));

  // ---------------------------------------------------------------- controls
  function syncMuteUi() {
    const muted = !audioOK || audio.muted;
    muteBtn.dataset.muted = String(muted);
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    muteBtn.disabled = !audioOK;
  }
  muteBtn.addEventListener('click', () => { audio.muted = !audio.muted; syncMuteUi(); });

  // iPhone Safari has no fullscreen API for pages: hide the button there.
  if (!document.fullscreenEnabled) fullBtn.hidden = true;
  fullBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    fullBtn.dataset.on = String(on);
    fullBtn.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Fullscreen');
  });

  big.addEventListener('click', toggle);
  // Click anywhere else on the page (stage or letterbox) toggles pause/resume; real links and buttons keep their own behaviour.
  document.addEventListener('click', (e) => { if (!e.target.closest('button, a')) toggle(); });
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || e.target.closest('button, a')) return;
    e.preventDefault();
    toggle();
  });

  // Controls are always visible unless playing; while playing they hide after 2.5 s without input.
  function poke() {
    root.classList.remove('ui-hidden');
    clearTimeout(hideTimer);
    if (state === 'playing') hideTimer = setTimeout(() => root.classList.add('ui-hidden'), 2500);
  }
  for (const ev of ['mousemove', 'pointerdown', 'touchstart', 'keydown']) addEventListener(ev, poke, { passive: true });

  // ---------------------------------------------------------------- go
  // Testing hook: window.__player.{state,time}
  Object.defineProperty(window, '__player', { value: { get state() { return state; }, get time() { return t; } } });

  fitStage(0);
  document.documentElement.classList.add('ready');
  t = START_T || POSTER_T;
  render(t);
  syncMuteUi();
  setState('idle');
}
