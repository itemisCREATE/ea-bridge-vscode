# Voice-over script (ElevenLabs)

Narration for the 99-second EA Bridge feature video. The script is split into **one clip per scene**, so a single clip can be re-generated or re-timed without touching the others. `mix.mjs` places each clip at its cue and mixes it over the music, which stays at one constant low level (no ducking).

The pacing is deliberately slow: each phrase gets its own beat on screen, with long `<break>` pauses between phrases. Keep those pauses as written, because the visuals in `video.js` are pinned to the phrase onsets listed below.

## Workflow

1. In ElevenLabs **Text to Speech**, use **one voice, one model and the same settings for all eight clips** (recommendations below).
2. For each clip, paste the **ElevenLabs input** block, generate, and download the result as MP3 under the listed **file name** into `video-sources/voice/`.
3. Check that `timing.json` has the cue list from the end of this file under `"voice"` (it already does unless you changed it).
4. Run `npm run build` (website) and/or `npm run video` (MP4). `mix.mjs` prints a warning for any clip that runs past the end of its scene.
5. Measure each take's phrase onsets and compare them with the table below, for example `ffmpeg -i voice/03-browse.mp3 -af silencedetect=noise=-30dB:d=0.3 -f null -`. Where a take drifts by more than about 0.3 s, nudge the clip's `offset` in `timing.json` or the matching visual beat in `video.js`.

## Recommended ElevenLabs settings

| Setting | Value |
|---|---|
| Model | **Eleven Multilingual v2**: stable, consistent across clips, supports the `<break>` pauses used below (up to 3 s each). With **Eleven v3**, replace each `<break …/>` with an ellipsis (`…`); the pauses become much shorter than written, so the offsets and visual beats need re-tuning. |
| Voice | Confident, friendly, modern tech-promo narrator (Voice Library, e.g. search "narration" / "commercial"). Neutral English accent.<br>I took: **Todd - Clear, Engaging, and Educational** |
| Stability | about 50 %. Raise it (60–70 %) if a take with several breaks sounds unstable. |
| Similarity | about 75 % |
| Style exaggeration | 10–20 % |
| Speaker boost | on |
| Speed | 1.0. Raise to 1.05–1.1 if a clip runs too long. |
| Output | MP3 44.1 kHz, 128 kbps or better. WAV also works. |

**Pauses:** every `<break time="…" />` must be **3 s or shorter** (ElevenLabs rejects longer ones). A take with several breaks can get unstable (speed changes, odd artefacts around a pause). If that happens, regenerate it, or raise Stability.

**Pronunciation:** the *ElevenLabs input* blocks already spell these out, so the voice doesn't guess:

| Term | Written in the input as |
|---|---|
| EA (Bridge) | `E-A` |
| UML | `U-M-L` |
| VS Code | `V-S Code` |
| SVG | `S-V-G` |
| CLI | `C-L-I` |
| C++ | `C plus plus` |
| JSON | `JSON` (reads as "Jason") |

## Timing overview

Each clip has a start (scene start + offset) and must end before its "max length" runs out. The **phrase onsets** are estimates for the new takes, worked out from the phrase lengths of the previous takes plus the new breaks; the numbers are seconds in video time. The visual beats in `video.js` are pinned to them, a few tenths of a second early so that the picture leads the word. Measure the real takes (workflow step 5) and adjust if they differ.

| # | Scene (window) | File | Starts at | Max length | Words | Expected phrase onsets |
|---|---|---|---|---|---|---|
| 1 | intro (0–8 s) | `voice/01-intro.mp3` | 1.0 s | 7.0 s | 8 | "Meet E-A Bridge" 1.0 · "Your Enterprise Architect models" ≈ 2.8 · "anywhere" ≈ 4.6 |
| 2 | why (8–20 s) | `voice/02-why.mp3` | 9.3 s | 10.7 s | 13 | "Windows, Mac or Linux" 9.3 · "No E-A installation needed" ≈ 12.4 · "And fast" ≈ 15.5 · "powered by Rust" ≈ 16.5 |
| 3 | browse (20–34 s) | `voice/03-browse.mp3` | 20.8 s | 13.2 s | 19 | "Browse the full U-M-L model…" 20.8 · "With all properties" ≈ 25.5 · "tagged values" ≈ 26.8 · "relationships" ≈ 28.1 · "at a click" ≈ 29.5 |
| 4 | diagrams (34–46 s) | `voice/04-diagrams.mp3` | 35.0 s | 11.0 s | 8 | "Diagrams render natively" 35.0 · "And export straight to S-V-G images" ≈ 38.2 ("export" ≈ 38.6) |
| 5 | thousand (46–58 s) | `voice/05-thousand.mp3` | 46.6 s | 11.4 s | 10 | "Export a thousand diagrams to S-V-G files" 46.6 · "in just five seconds" ≈ 51.0 (on the drop) |
| 6 | ai (58–73 s) | `voice/06-ai.mp3` | 58.6 s | 14.4 s | 22 | "Ask your model anything" 58.6 · "With Claude Code or GitHub Copilot" ≈ 62.1 · "E-A Bridge turns questions…" ≈ 64.7 · "And your data stays local" ≈ 68.9 |
| 7 | cli (73–88 s) | `voice/07-cli.mp3` | 73.6 s | 14.4 s | 21 | "A cross-platform C-L-I…" 73.6 · "As versioned JSON" ≈ 78.5 · "or Java, Python and C plus plus code" ≈ 80.5 |
| 8 | outro (88–99 s) | `voice/08-outro.mp3` | 89.0 s | 10.0 s | 10 | "E-A Bridge for V-S Code" 89.0 · "Get it on the Marketplace" ≈ 92.1 |

---

## 1 · Intro: `voice/01-intro.mp3`

*On screen:* the logo snaps together and "EA Bridge" appears. The tagline and the file-type chips land with the second phrase.

**Script:** Meet EA Bridge. Your Enterprise Architect models, anywhere.

ElevenLabs input:
```text
Meet E-A Bridge. <break time="0.8s" /> Your Enterprise Architect models, <break time="0.3s" /> anywhere.
```

## 2 · Why: `voice/02-why.mp3`

*On screen:* "EA models — without EA." Three rows, one per phrase: Windows only → Windows · macOS · Linux, EA installation required → No EA needed, Slow COM API → Rust backend.

**Script:** Windows, Mac or Linux. No EA installation needed. And fast — powered by Rust.

ElevenLabs input:
```text
Windows, Mac or Linux. <break time="1.5s" /> No E-A installation needed. <break time="1.5s" /> And fast — <break time="0.4s" /> powered by Rust.
```

## 3 · Browse: `voice/03-browse.mp3`

*On screen:* VS Code with the EA Model Explorer fills in. "Account" is clicked just before "With all properties…" and its properties appear; then the class diagram is opened with a double-click.

**Script:** Browse the full UML model right inside VS Code. With all properties, tagged values and relationships — at a click.

ElevenLabs input:
```text
Browse the full U-M-L model right inside V-S Code. <break time="1.5s" /> With all properties, tagged values and relationships — <break time="0.4s" /> at a click.
```

## 4 · Diagrams: `voice/04-diagrams.mp3`

*On screen:* the real class diagram builds up over about 4 s: boxes, connectors, labels. The "Export SVG" button pulses on the word "export".

**Script:** Diagrams render natively. And export straight to SVG images.

ElevenLabs input:
```text
Diagrams render natively. <break time="2.0s" /> And export straight to S-V-G images.
```

## 5 · 1,000 diagrams: `voice/05-thousand.mp3`

*On screen:* tiles ripple out while the counter runs to 1,000. At 51.0 s, on the music drop, "in just 5 seconds" slams in; a footnote ("\* with an additional script batching the export") fades in below the grid shortly after. Aim for "in just" to start right around the drop.

**Script:** By the way, exporting a thousand diagrams to svg files just takes - five seconds.

ElevenLabs input:
```text
By the way <break time="0.5s" /> exporting a thousand diagrams to svg files just takes <break time="1s" /> FIVE seconds.
```

## 6 · AI assistant: `voice/06-ai.mp3`

*On screen:* a chat asks "Which classes inherit from NamedElement?", a tool call runs `ea-bridge query`, the four answers appear, then the badge "Your model stays local" lands with the last phrase.

**Script:** Ask your model anything. The EA Bridge AI skill turns questions into precise queries. This way, your data stays local and is not sent to AI servers.

ElevenLabs input:
```text
Ask your model ANYTHING. <break time="0.5s" /> The E-A Bridge A-I skill turns questions into precise queries. <break time="0.3s" /> This way, your data stays local and is not sent to AI servers.
```

## 7 · CLI · CI/CD · Codegen: `voice/07-cli.mp3`

*On screen:* a terminal pipes `ea-bridge export` into the Java generator; JSON fragments fly in on "as versioned JSON"; Java, Python and C++ code cards fan out on "Java, Python and C plus plus"; chips for Versioned JSON schema, Jinja templates, CI/CD-ready CLI and SQL console follow.

**Script:** A cross-platform CLI generates code, in your desired language like C++ or Python, via customizable templates, also in CI pipelines.

ElevenLabs input:
```text
A cross-platform C-L-I can generate code, <break time="0.5s" /> in your desired language like C++ or Python, <break time="0.5s" /> via customizable templates, <break time="0.5s" /> also in CI pipelines.
```

## 8 · Outro: `voice/08-outro.mp3`

*On screen:* the logo, "EA Bridge for Visual Studio Code", and, with "Get it on the Marketplace", the "Get it on the VS Code Marketplace" button.

**Script:** EA Bridge for VS Code. Get it on the Marketplace.

ElevenLabs input:
```text
E-A Bridge for V-S Code. <break time="1.2s" /> Get it on the Marketplace.
```

---

## Full script (for review)

> Meet EA Bridge. Your Enterprise Architect models, anywhere.
> Windows, Mac or Linux. No EA installation needed. And fast — powered by Rust.
> Browse the full UML model right inside VS Code. With all properties, tagged values and relationships — at a click.
> Diagrams render natively. And export straight to SVG.
> Export a thousand diagrams to SVG in just five seconds.
> Ask your model anything. With Claude Code or GitHub Copilot, EA Bridge turns questions into precise queries. And your data stays local.
> A cross-platform CLI brings your model into any pipeline. As versioned JSON, or Java, Python and C++ code.
> EA Bridge for VS Code. Get it on the Marketplace.

## Cue list for `timing.json`

`timing.json` already contains this list. If you changed it, restore it with:

```json
"voice": [
  { "file": "voice/01-intro.mp3",    "scene": "intro",    "offset": 1.0 },
  { "file": "voice/02-why.mp3",      "scene": "why",      "offset": 1.3 },
  { "file": "voice/03-browse.mp3",   "scene": "browse",   "offset": 0.8 },
  { "file": "voice/04-diagrams.mp3", "scene": "diagrams", "offset": 1.0 },
  { "file": "voice/05-thousand.mp3", "scene": "thousand", "offset": 0.6 },
  { "file": "voice/06-ai.mp3",       "scene": "ai",       "offset": 0.6 },
  { "file": "voice/07-cli.mp3",      "scene": "cli",      "offset": 0.6 },
  { "file": "voice/08-outro.mp3",    "scene": "outro",    "offset": 1.0 }
]
```

## If a clip is too long

`mix.mjs` warns, for example: `⚠ voice[5] … runs 0.80 s past the end of scene "ai"`. Fixes, in order of effort:

1. **Speed:** regenerate with Speed 1.05–1.1. The `<break>` pauses keep their length, so the phrases move closer together only a little.
2. **Breaks:** shorten the longest `<break>` in the clip (the 1.5 s and 2.0 s ones). This moves the later phrase onsets earlier, so re-check the visual beats that follow them.
3. **Offset:** start earlier. Lower the clip's `offset`, keeping it after the scene's own entrance (about 0.2 s).
4. **Text:** drop a few words; the *Script* line is the shortest place to cut.
5. **Scene length:** lengthen the scene in `timing.json`. This shifts everything after it, so the later scene windows and the absolute cue times (`cuts`, `clicks`, `wave`, `drop`, `finalHit`, `typing`, `duration`) all need the same shift.
