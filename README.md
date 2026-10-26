# HDROLED v1.2 — Lighter

**Simple manual YouTube picture and sound enhancement.** Created by **Harsh Mohan Sahani**, made with **Codex**.

Lighter is the compact v1 edition: independent picture/sound switches, manual strength sliders, honest processing dots and one Show original comparison. It does the core job with fewer moving parts and no playback-performance sampler or automatic changes. Preferences apply across YouTube tabs in the browser profile. Fewer features do not guarantee a particular CPU saving.

[Download Lighter](https://github.com/harsh-mohan-99/hdroled-youtube/releases/tag/v1.2.0) · [Compare with v2.0 Featured](https://github.com/harsh-mohan-99/hdroled-youtube) · [Installation tutorial](INSTALL.md)

Featured adds a movable page popup, true 0.1% controls, separate video/tab settings and automatic quality handling. Choose whichever workflow you prefer; install one edition at a time. Both remain free. **If HDROLED helps your watching, click ☆ Star on the repository.**

![Lighter interface with simulated playback](docs/visuals/interface-1.2-lighter.jpg)

This is an actual interface render with simulated player status, not live YouTube enhancement evidence.

## Install

Download the Chromium or Firefox ZIP from this release, then follow [INSTALL.md](INSTALL.md). Chromium uses Developer mode → Load unpacked. Firefox temporary installation uses about:debugging; permanent installation requires Mozilla signing. Refresh YouTube after installing or updating.

## Scope

Only accessible YouTube page colors and supported player audio are processed. No microphone, recording, uploads, system display/audio settings, drivers, power plans or battery policy changes. The SDR appearance effect cannot create genuine HDR or physical OLED blacks. Processing still uses resources.

## Develop

```sh
npm test
python scripts/package.py
```

Runtime has no external package dependencies. 20 automated checks exercise browser/media boundaries with stand-ins; live cross-browser viewing/listening remains a separate check. [Privacy](PRIVACY.md) · [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE).
