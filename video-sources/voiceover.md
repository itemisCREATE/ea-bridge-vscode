# Voice-over script (ElevenLabs)

Narration for the 60-second EA Bridge feature video. The script is split into **one clip per scene**, so a single clip can be re-generated or re-timed without touching the others. `mix.mjs` places each clip at its cue and ducks the music under it.

## Workflow

1. In ElevenLabs **Text to Speech**, use **one voice, one model and the same settings for all eight clips** (recommendations below).
2. For each clip, paste the **ElevenLabs input** block, generate, and download the result as MP3 under the listed **file name** into `video-sources/voice/`.
3. Paste the cue list from the end of this file into `timing.json` (replacing `"voice": []`).
4. Run `npm run build` (MP4) and/or `npm run site` (website). `mix.mjs` prints a warning for any clip that runs past the end of its scene.

## Recommended ElevenLabs settings

| Setting | Value |
|---|---|
| Model | **Eleven Multilingual v2**: stable, consistent across clips, supports the `<break>` pauses used below. With **Eleven v3**, replace each `<break …/>` with an ellipsis (`…`). |
| Voice | Confident, friendly, modern tech-promo narrator (Voice Library, e.g. search "narration" / "commercial"). Neutral English accent. |
| Stability | about 50 % |
| Similarity | about 75 % |
| Style exaggeration | 10–20 % |
| Speaker boost | on |
| Speed | 1.0. Raise to 1.05–1.1 if a clip runs too long. |
| Output | MP3 44.1 kHz, 128 kbps or better. WAV also works. |

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

Each clip has a start (scene start + offset) and must end before its "max length" runs out. The budget assumes roughly 2.3–2.6 spoken words per second.

| # | Scene (window) | File | Starts at | Max length | Words |
|---|---|---|---|---|---|
| 1 | intro (0–5 s) | `voice/01-intro.mp3` | 1.0 s | 3.7 s | 8 |
| 2 | why (5–12 s) | `voice/02-why.mp3` | 5.3 s | 6.3 s | 13 |
| 3 | browse (12–22 s) | `voice/03-browse.mp3` | 12.4 s | 9.1 s | 19 |
| 4 | diagrams (22–27 s) | `voice/04-diagrams.mp3` | 22.3 s | 4.0 s | 8 |
| 5 | thousand (27–34 s) | `voice/05-thousand.mp3` | 28.0 s | 5.6 s | 10 |
| 6 | ai (34–45 s) | `voice/06-ai.mp3` | 34.5 s | 10.0 s | 22 |
| 7 | cli (45–55 s) | `voice/07-cli.mp3` | 45.4 s | 9.1 s | 21 |
| 8 | outro (55–60 s) | `voice/08-outro.mp3` | 55.4 s | 4.3 s | 10 |

---

## 1 · Intro: `voice/01-intro.mp3`

*On screen:* the logo snaps together, "EA Bridge" appears, then the tagline and file-type chips. The clip starts right after the logo hit.

**Script:** Meet EA Bridge: your Enterprise Architect models, anywhere.

ElevenLabs input:
```text
Meet E-A Bridge: your Enterprise Architect models, anywhere.
```

## 2 · Why: `voice/02-why.mp3`

*On screen:* "EA models — without EA." Three rows: Windows only → Windows · macOS · Linux, EA installation required → No EA needed, Slow COM API → Rust backend.

**Script:** Windows, Mac or Linux. No EA installation needed. And fast — powered by Rust.

ElevenLabs input:
```text
Windows, Mac or Linux. <break time="0.3s" /> No E-A installation needed. <break time="0.3s" /> And fast — powered by Rust.
```

## 3 · Browse: `voice/03-browse.mp3`

*On screen:* VS Code with the EA Model Explorer. "Account" is clicked and its properties appear; then the class diagram is opened.

**Script:** Browse the full UML model right inside VS Code — with all properties, tagged values and relationships at a click.

ElevenLabs input:
```text
Browse the full U-M-L model right inside V-S Code — with all properties, tagged values and relationships at a click.
```

## 4 · Diagrams: `voice/04-diagrams.mp3`

*On screen:* the real class diagram builds up: boxes, connectors, labels.

**Script:** Diagrams render natively — and export straight to SVG.

ElevenLabs input:
```text
Diagrams render natively — and export straight to S-V-G.
```

## 5 · 1,000 diagrams: `voice/05-thousand.mp3`

*On screen:* tiles ripple out while the counter runs to 1,000. At 31.0 s, on the music drop, "in just 5 seconds" slams in. Aim for "in just five seconds" to start right around that moment.

**Script:** Export a thousand diagrams to SVG — in just five seconds.

ElevenLabs input:
```text
Export a thousand diagrams to S-V-G <break time="0.4s" /> in just five seconds.
```

## 6 · AI assistant: `voice/06-ai.mp3`

*On screen:* a chat asks "Which classes inherit from NamedElement?", a tool call runs `ea-bridge query`, the four answers appear, then the badge "Your model stays local".

**Script:** Ask your model anything. With Claude Code or GitHub Copilot, EA Bridge turns questions into precise queries — and your data stays local.

ElevenLabs input:
```text
Ask your model anything. <break time="0.4s" /> With Claude Code or GitHub Copilot, E-A Bridge turns questions into precise queries — and your data stays local.
```

## 7 · CLI · CI/CD · Codegen: `voice/07-cli.mp3`

*On screen:* a terminal pipes `ea-bridge export` into the Java generator; Java, Python and C++ code cards fan out; chips for Versioned JSON schema, Jinja templates, CI/CD-ready CLI and SQL console.

**Script:** A cross-platform CLI brings your model into any pipeline — as versioned JSON, or Java, Python and C++ code.

ElevenLabs input:
```text
A cross-platform C-L-I brings your model into any pipeline — as versioned JSON, or Java, Python and C plus plus code.
```

## 8 · Outro: `voice/08-outro.mp3`

*On screen:* the logo, "EA Bridge for Visual Studio Code", and the "Get it on the VS Code Marketplace" button.

**Script:** EA Bridge for VS Code. Get it on the Marketplace.

ElevenLabs input:
```text
E-A Bridge for V-S Code. <break time="0.3s" /> Get it on the Marketplace.
```

---

## Full script (for review)

> Meet EA Bridge: your Enterprise Architect models, anywhere.
> Windows, Mac or Linux. No EA installation needed. And fast — powered by Rust.
> Browse the full UML model right inside VS Code — with all properties, tagged values and relationships at a click.
> Diagrams render natively — and export straight to SVG.
> Export a thousand diagrams to SVG — in just five seconds.
> Ask your model anything. With Claude Code or GitHub Copilot, EA Bridge turns questions into precise queries — and your data stays local.
> A cross-platform CLI brings your model into any pipeline — as versioned JSON, or Java, Python and C++ code.
> EA Bridge for VS Code. Get it on the Marketplace.

## Cue list for `timing.json`

Replace `"voice": []` with:

```json
"voice": [
  { "file": "voice/01-intro.mp3",    "scene": "intro",    "offset": 1.0 },
  { "file": "voice/02-why.mp3",      "scene": "why",      "offset": 0.3 },
  { "file": "voice/03-browse.mp3",   "scene": "browse",   "offset": 0.4 },
  { "file": "voice/04-diagrams.mp3", "scene": "diagrams", "offset": 0.3 },
  { "file": "voice/05-thousand.mp3", "scene": "thousand", "offset": 1.0 },
  { "file": "voice/06-ai.mp3",       "scene": "ai",       "offset": 0.5 },
  { "file": "voice/07-cli.mp3",      "scene": "cli",      "offset": 0.4 },
  { "file": "voice/08-outro.mp3",    "scene": "outro",    "offset": 0.4 }
]
```

## If a clip is too long

`mix.mjs` warns, for example: `⚠ voice[5] … runs 0.80 s past the end of scene "ai"`. Fixes, in order of effort:

1. **Speed:** regenerate with Speed 1.05–1.1.
2. **Offset:** start earlier. Lower the clip's `offset`, keeping it after the scene's own entrance (about 0.2 s).
3. **Text:** drop a few words; the *Script* line is the shortest place to cut.
4. **Scene length:** lengthen the scene in `timing.json`. This shifts everything after it, so the later scene windows and the absolute cue times (`cuts`, `clicks`, `wave`, `drop`, `finalHit`, `typing`, `duration`) all need the same shift.
