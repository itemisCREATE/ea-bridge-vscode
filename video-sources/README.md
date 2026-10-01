# EA Bridge feature video

A 60-second promo video showing EA Bridge's features: browsing, diagrams, the 1,000-diagram SVG export, the AI assistant, and CLI/codegen. The video is an HTML/GSAP animation. Headless Chrome captures it frame by frame, ffmpeg encodes the frames to MP4, and a Node script synthesizes the soundtrack.

Two outputs:
- `ea-bridge-features.mp4` (1920×1080, 30 fps, H.264 + AAC),
- the website in `../docs/`, which plays the animation live with sound (see [Website](#website)).

Folder layout: this folder (`video-sources/`) holds the sources and build scripts. `docs/` holds the generated website. It is committed and served by GitHub Pages, so rebuild it with `npm run site` and commit the result together with source changes.

## Prerequisites

- Node.js 18+
- A Chromium-based browser: Chrome, Edge, or Chromium. The renderer finds it automatically; to use a different one, set `CHROME_PATH`.
- Network access for the first `npm ci`, which downloads gsap, puppeteer-core, ffmpeg and fonts.

## Build

Run from this folder:

```bash
npm run build
```

This single command:
- installs dependencies if they're missing,
- regenerates the music and mixes the final soundtrack (`build/audio.wav`),
- renders the MP4.

It takes about 4 minutes.

| Command | What it does |
|---------|--------------|
| `npm run build` | Full build → `ea-bridge-features.mp4` |
| `npm run stills` | One review PNG per scene in `build/stills/`, in seconds. Pass timestamps for specific frames: `npm run stills -- 12.5 31` |
| `npm run preview` | Serves the source folder and prints two URLs: the website player (`video.html`) and the dev preview with scrubber (`video.html?dev`). Ctrl+C to stop |
| `npm run site` | Builds the static website into `../docs/` (see [Website](#website)) |
| `npm run site -- --serve` | Builds the website, then serves it locally (Ctrl+C to stop) |
| `npm run build -- --assets` | Re-exports the real diagram and query answer first (see below), then builds |

## Editing

| File | Purpose |
|------|---------|
| `timing.json` | **Single source of timing.** Scene windows plus every cue the music hits (cuts, clicks, typing, drop, final hit). Change a scene's length here and both picture and sound follow. |
| `video.html` | Stage layout and styles for all scenes, plus the website player's overlay and controls |
| `video.js` | Timeline and animations. Times are relative to each scene's start. Picks the mode: `?render`, `?dev`, or the website player |
| `player.js` | Website player: play overlay, audio-driven clock, click-to-pause, mute, fullscreen, replay, Marketplace link |
| `music.mjs` | Procedural soundtrack: 120 BPM, Am–F–C–G, no dependencies → `build/music.wav` |
| `mix.mjs` | Final mix: music plus optional voice-over, with ducking and loudness normalisation → `build/audio.wav` |
| `render.mjs` | Static server → headless Chrome → PNG frames → ffmpeg (muxes `build/audio.wav`) |
| `site.mjs` | Assembles the self-contained website bundle in `../docs/`. Only replaces its own generated files, so the hand-placed `docs/.nojekyll` survives |
| `build.mjs` | The one-call pipeline behind the npm scripts: music → mix → render or site |
| `prepare-assets.mjs` | Refreshes `assets/` from the EA Bridge dev repo |

## Website

`npm run site` builds the website into `../docs/` (about 1.6 MB), a static folder with no build-time or network dependencies:

```
docs/
  index.html          video.html, pointed at the bundled files below
  video.js  player.js  assets/
  data.js             timing.json, data.json and the diagram SVG embedded as a script
  lib/                gsap.min.js
  fonts/              Inter + JetBrains Mono (latin woff2), fonts.css, OFL licences
  audio.m4a           build/audio.wav encoded as AAC, 160 kbps
  .nojekyll           tells GitHub Pages to serve the files as they are (hand-placed, not generated)
```

The website also works when you open `docs/index.html` from disk (double-click). `data.js` carries the three files the player would otherwise `fetch()`, and browsers block `fetch()` on `file://`. The source `video.html` still needs HTTP: use `npm run preview`, or `npm run site -- --serve` for the built site.

`docs/` is committed. With GitHub Pages set to deploy the `main` branch from `/docs` (Settings → Pages), it is served at `https://itemiscreate.github.io/ea-bridge-vscode/`. To embed it:

```html
<iframe src="https://itemiscreate.github.io/ea-bridge-vscode/" allow="fullscreen; autoplay" width="960" height="540" style="border:0"></iframe>
```

**How the player behaves**
- It shows the intro frame behind a play button. Browsers block autoplay with sound, so one click starts the video.
- Click anywhere or press Space to pause and resume.
- During the outro, the in-video "Get it on the VS Code Marketplace" button is a real link.
- When the video ends, a replay button and a Marketplace link appear.
- Bottom-right buttons: mute and fullscreen. They hide after 2.5 s without mouse movement while playing.
- The audio drives the picture, so sound and animation stay in sync after a pause or a hidden tab. If the audio can't play, the animation runs silently on a clock.

**URL modes**

| URL | Mode |
|-----|------|
| `video.html` or `docs/index.html` | Website player |
| `video.html?dev` | Dev preview with scrubber and time readout |
| `video.html?render` | Frame renderer used by `render.mjs`; no UI |

`#t=57` on the player URL makes the first play start at 57 s, which is handy for reviewing the ending. The click on play is still needed for sound.

## Voice-over

Narration is optional. While the `voice` list in `timing.json` is empty, `mix.mjs` passes the music through unchanged.

The script, ready for ElevenLabs, is in [voiceover.md](voiceover.md). It has one clip per scene with file names, pronunciation-safe input text, recommended voice settings and a ready-to-paste cue list.

To add narration:

1. Put one clip per scene in `voice/` (WAV or MP3).
2. List the clips in `timing.json`:

   ```json
   "voice": [
     { "file": "voice/03-browse.wav", "scene": "browse", "offset": 0.3 },
     { "file": "voice/08-outro.wav",  "at": 56.2 }
   ]
   ```

   - `scene` + `offset`: the clip starts `offset` seconds after the scene start. If you lengthen an earlier scene in `timing.json`, the clip moves with it.
   - `at`: an absolute time in seconds, used instead of `scene` and `offset`.
3. Run `npm run build` (MP4) or `npm run site` (website). Both run the mix first.

What the mix does:
- every clip is delayed to its cue and summed into one voice track,
- the music is ducked under the voice (about 8:1, 20 ms attack, 400 ms release),
- voice and music are loudness-normalised to about −16 LUFS (−1 dBTP) and trimmed or padded to exactly `duration`.

`mix.mjs` fails on a missing clip file and warns when a clip runs past the end of its scene.

**Speaking budget:** plan for about 2.3 words per second. A 10 s scene fits roughly 23 words. If the narration needs more time, lengthen the scene in `timing.json`; picture, music and voice follow.

## Real assets

The content in `assets/` comes from `fixtures/SampleEAModel.qea`:
- `ClassDiagram.svg`, rendered by the extension's own headless renderer through the bundled MCP server,
- the AI scene's query answer in `data.json`,
- the logo and UML icons.

These files are committed, so a plain `npm run build` doesn't need the dev repo.

To refresh them, for example after diagram-renderer changes, run `npm run build -- --assets`. This needs:
- the EA Bridge dev repo with a built extension (`extension/dist/assets/`),
- the repo's location: two levels up by default (`ea-vsc-bmad/`), or wherever the `EA_BRIDGE_REPO` environment variable points.

`node_modules/` and `build/` are git-ignored; the generated website in `docs/` is not.
